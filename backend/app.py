import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional
import asyncio

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from ulid import ULID

# Load environment variables from .env file
load_dotenv()

from api_schemas import (
    PlanCrawlRequest,
    PlanCrawlResponse,
    PubInRoute,
    DirectionsRequest,
    HealthResponse,
    PrecomputeStatusResponse,
    RouteLegModel,
    PubModel,
    CreateSharedRouteRequest,
    SharedRouteResponse,
    CoordinateModel,
)
from osrm_client import OSRMClient
from planner import PubCrawlPlanner
from precompute_distances import load_distance_matrix, precompute_distance_matrix
from parse import parse_data, load_raw_data
from polyline_utils import encode_polyline
from models import Base, SharedRoute


class PubCrawlPlannerApp:
    """Main application class for the pub crawl planner API"""

    def __init__(
        self,
        osrm_url: str = "http://localhost:5005",
        data_file: Optional[str] = None,
        distances_file: Optional[str] = None,
        raw_data_file: Optional[str] = None,
        database_url: Optional[str] = None,
    ):
        """
        Initialize the application

        Args:
            osrm_url: URL of the OSRM server
            data_file: Path to parsed pubs data file (defaults to DATA_FILE env var or data//data.json)
            distances_file: Path to precomputed distances file (defaults to DISTANCES_FILE env var or data//pub_distances.pkl)
            raw_data_file: Path to raw data file (defaults to RAW_DATA_FILE env var or data//raw.data)
            database_url: SQLAlchemy database URL (defaults to sqlite:///shared_routes.db)
        """
        print("Initializing PubCrawlPlannerApp...")
        self.osrm_url = osrm_url
        # Support both docker (/app/data/) and local (data/) paths
        self.data_file = data_file or os.getenv("DATA_FILE", "data/data.json")
        self.distances_file = distances_file or os.getenv("DISTANCES_FILE", "data/pub_distances.pkl")
        self.raw_data_file = raw_data_file or os.getenv("RAW_DATA_FILE", "data/raw.data")

        # Database configuration
        self.database_url = database_url or os.getenv("DATABASE_URL", "sqlite:///shared_routes.db")
        self.engine = create_engine(self.database_url, echo=False)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        # State
        self.planner: Optional[PubCrawlPlanner] = None
        self.pubs_data: List[PubModel] = []
        self.osrm_client = OSRMClient(base_url=self.osrm_url)
        self.precompute_in_progress = False
        self.cleanup_task: Optional[asyncio.Task] = None

        # Create FastAPI app with lifespan
        self.app = FastAPI(
            title="Pub Crawl Planner API",
            description="Optimize pub crawl routes with distance calculation and uniform spacing",
            version="0.2.0",
            lifespan=self._lifespan,
        )

        # Add CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Register routes
        self._register_routes()

    def _register_routes(self):
        """Register all API endpoints"""
        self.app.get("/api/health", response_model=HealthResponse)(self.health_check)
        self.app.get("/api/pubs", response_model=List[PubModel])(self.list_pubs)
        self.app.get("/api/pubs/{pub_id}", response_model=PubModel)(self.get_pub)
        self.app.post("/api/plan", response_model=PlanCrawlResponse)(self.plan_crawl)
        self.app.post("/api/directions", response_model=List[RouteLegModel])(
            self.get_directions
        )
        self.app.post("/api/precompute", response_model=dict)(self.trigger_precomputation)
        self.app.post("/api/parse", response_model=dict)(self.parse_raw_data)
        self.app.get("/api/status", response_model=PrecomputeStatusResponse)(self.get_status)
        # Shareable routes endpoints
        self.app.post("/api/routes", response_model=SharedRouteResponse)(self.create_shared_route)
        self.app.get("/api/routes/{share_id}", response_model=SharedRouteResponse)(self.get_shared_route)
        self.app.delete("/api/routes/{share_id}", response_model=dict)(self.delete_shared_route)

    @asynccontextmanager
    async def _lifespan(self, app: FastAPI):
        """Startup and shutdown logic"""
        # Startup
        print("Initializing database...")
        Base.metadata.create_all(bind=self.engine)
        print("Database initialized")

        print("Loading pub data...")
        self.load_pubs_data()
        print(f"Loaded {len(self.pubs_data)} pubs")

        print("Loading distance matrix...")
        if self.load_distance_data():
            print("Distance matrix loaded successfully")
        else:
            print(
                "Warning: Distance matrix not found. Run /precompute endpoint first."
            )

        # Start cleanup task for expired routes
        self.cleanup_task = asyncio.create_task(self._cleanup_expired_routes())
        print("Started expired routes cleanup task")

        yield

        # Shutdown
        if self.cleanup_task:
            self.cleanup_task.cancel()
        self.engine.dispose()
        print("Shutting down...")

    def load_pubs_data(self) -> bool:
        """Load pub data from data.json"""
        if os.path.exists(self.data_file):
            with open(self.data_file, "r") as f:
                pd = json.load(f)
                self.pubs_data = [PubModel(**pub) for pub in pd]
            return True
        return False

    def load_distance_data(self) -> bool:
        """Load precomputed distance matrix and initialize planner"""
        if not os.path.exists(self.distances_file):
            return False

        try:
            data = load_distance_matrix(self.distances_file)

            self.planner = PubCrawlPlanner(
                distance_matrix=data["distances"],
                pub_coords=data["pub_coords"],
                pub_ids=data["pub_ids"],
                osrm_client=self.osrm_client,
            )
            return True
        except Exception as e:
            print(f"Error loading distance matrix: {e}")
            return False

    def is_osrm_available(self) -> bool:
        """Check if OSRM server is running"""
        try:
            osrm_client_test = OSRMClient(base_url=self.osrm_url)
            # Try a simple request
            osrm_client_test.get_walking_distance(
                (-2.6061406, 51.4335666), (-2.5818437, 51.4730697)
            )
            return True
        except Exception:
            return False

    async def health_check(self) -> HealthResponse:
        """Check API and OSRM server health"""
        return HealthResponse(
            status="ok",
            osrm_available=self.is_osrm_available(),
            distance_matrix_loaded=self.planner is not None,
        )

    async def list_pubs(
        self, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)
    ) -> List[PubModel]:
        """List available pubs"""
        return self.pubs_data[skip : skip + limit]

    async def get_pub(self, pub_id: str) -> PubModel:
        """Get details for a specific pub"""
        for pub in self.pubs_data:
            if pub.id == pub_id:
                return pub
        raise HTTPException(status_code=404, detail=f"Pub {pub_id} not found")

    async def plan_crawl(self, request: PlanCrawlRequest) -> PlanCrawlResponse:
        """
        Plan an optimal pub crawl route

        Args:
            request: Planning parameters (start, end, num_pubs, uniformity_weight, include_directions)

        Returns:
            Optimized route with pub details and navigation information
        """
        if self.planner is None:
            raise HTTPException(
                status_code=503,
                detail="Distance matrix not loaded. Run /precompute endpoint first.",
            )

        try:
            # Plan the crawl
            result = self.planner.plan_crawl(
                start_point=request.start_point.tuple,
                end_point=request.end_point.tuple,
                num_pubs=request.num_pubs,
                uniformity_weight=request.uniformity_weight,
            )

            # Build pub information list
            pubs_in_route = []
            for i, pub_idx in enumerate(result["route"]):
                if isinstance(pub_idx, int):
                    pub = self.pubs_data[pub_idx]
                    pubs_in_route.append(
                        PubInRoute(
                            index=i,
                            pub_id=pub.id,
                            pub_name=pub.name,
                            longitude=pub.longitude,
                            latitude=pub.latitude,
                        )
                    )

            # Get directions if requested
            legs = None
            if request.include_directions:
                print(f"Fetching directions for route: {result['route']}")
                try:
                    legs = self.get_route_legs(
                        result["route"],
                        request.start_point.tuple,
                        request.end_point.tuple,
                    )
                except Exception as e:
                    print(f"Warning: Failed to get directions: {e}")
                    import traceback
                    traceback.print_exc()
                    # Continue without directions rather than failing completely
                    legs = None

            response = PlanCrawlResponse(
                route_indices=result["route"],
                pubs=pubs_in_route,
                total_distance_meters=result["total_distance"],
                estimated_time_minutes=result["estimated_time_minutes"],
                num_pubs=result["num_pubs"],
                legs=legs,
                share_id=None,
            )

            return response

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error planning route: {str(e)}")

    async def get_directions(self, request: DirectionsRequest) -> List[RouteLegModel]:
        """
        Get turn-by-turn directions for a route

        Args:
            request: Route indices and start/end coordinates

        Returns:
            List of navigation legs with distance, duration, and steps
        """
        if self.osrm_client is None:
            raise HTTPException(
                status_code=503,
                detail="OSRM client not available",
            )

        try:
            legs = self.get_route_legs(
                request.route_indices,
                request.start_point.tuple,
                request.end_point.tuple,
            )
            return legs
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error getting directions: {str(e)}")

    def _store_route_in_database(
        self,
        request: PlanCrawlRequest,
        route_indices: List[int | str],
        pubs_in_route: List[PubInRoute],
        total_distance_meters: float,
        estimated_time_minutes: float,
        legs: Optional[List[RouteLegModel]] = None,
    ) -> str:
        """
        Store a planned route in the database for sharing

        Args:
            request: Original planning request
            route_indices: List of pub indices with 'start' and 'end' markers
            pubs_in_route: List of PubInRoute objects
            total_distance_meters: Total route distance
            estimated_time_minutes: Estimated duration
            legs: Optional navigation legs with encoded geometry

        Returns:
            The generated share_id for the route
        """
        db = self.SessionLocal()
        try:
            # Generate ULID for the route
            share_id = str(ULID())[:8].lower()

            # Convert legs to storable format (complete leg data with all fields)
            legs_data = None
            if legs:
                legs_data = [
                    {
                        "from_index": leg.from_index,
                        "to_index": leg.to_index,
                        "distance_meters": leg.distance_meters,
                        "duration_seconds": leg.duration_seconds,
                        "geometry_encoded": leg.geometry_encoded,
                    }
                    for leg in legs
                ]

            # Extract pub IDs from the route
            selected_pub_ids = [pub.pub_id for pub in pubs_in_route]

            # Create and store the route
            shared_route = SharedRoute(
                share_id=share_id,
                start_longitude=request.start_point.longitude,
                start_latitude=request.start_point.latitude,
                end_longitude=request.end_point.longitude,
                end_latitude=request.end_point.latitude,
                route_indices=route_indices,
                selected_pub_ids=selected_pub_ids,
                num_pubs=len(pubs_in_route),
                uniformity_weight=request.uniformity_weight,
                total_distance_meters=total_distance_meters,
                estimated_time_minutes=estimated_time_minutes,
                legs_data=legs_data,
            )
            db.add(shared_route)
            db.commit()
            print(f"Stored route in database with share_id: {share_id}")
            return share_id
        finally:
            db.close()

    def get_route_legs(
        self, route_indices: List[int | str], start_point: tuple, end_point: tuple
    ) -> List[RouteLegModel]:
        """
        Convert route indices to navigation legs with OSRM directions

        Args:
            route_indices: List of pub indices with 'start' and 'end' markers
            start_point: (longitude, latitude) tuple
            end_point: (longitude, latitude) tuple

        Returns:
            List of RouteLegModel objects
        """
        if self.osrm_client is None:
            raise Exception("OSRM client not initialized")

        legs = []

        for i in range(len(route_indices) - 1):
            from_idx = route_indices[i]
            to_idx = route_indices[i + 1]

            # Convert indices to coordinates
            if from_idx == "start":
                from_coords = start_point
            elif isinstance(from_idx, int):
                from_coords = (
                    self.pubs_data[from_idx].longitude,
                    self.pubs_data[from_idx].latitude,
                )
            else:
                from_coords = from_idx  # type: ignore[assignment]

            if to_idx == "end":
                to_coords = end_point
            elif isinstance(to_idx, int):
                to_coords = (
                    self.pubs_data[to_idx].longitude,
                    self.pubs_data[to_idx].latitude,
                )
            else:
                to_coords = to_idx  # type: ignore[assignment]

            # Get directions from OSRM
            try:
                print(f"Fetching directions from {from_coords} to {to_coords}")
                directions = self.osrm_client.get_directions(from_coords, to_coords)
                print(f"Got directions: distance={directions['distance']}, duration={directions['duration']}")

                # Encode polyline for efficient transmission
                geometry_encoded = None
                if directions.get("geometry") and directions["geometry"].get("coordinates"):
                    geometry_encoded = encode_polyline(directions["geometry"]["coordinates"])

                leg = RouteLegModel(
                    from_index=i,
                    to_index=i + 1,
                    distance_meters=directions["distance"],
                    duration_seconds=directions["duration"],
                    geometry_encoded=geometry_encoded,
                )
                legs.append(leg)
            except Exception as e:
                # Log the error for debugging
                print(f"Error fetching directions from {from_coords} to {to_coords}: {e}")
                raise  # Re-raise to let caller handle

        return legs

    async def trigger_precomputation(self) -> dict:
        """
        Trigger distance matrix precomputation

        Note: This runs synchronously and may take several minutes.
        For production, consider using Celery or similar for async tasks.
        """
        if self.precompute_in_progress:
            raise HTTPException(
                status_code=409,
                detail="Precomputation already in progress",
            )

        if not self.pubs_data:
            raise HTTPException(
                status_code=400,
                detail="No pub data loaded. Run /parse endpoint first.",
            )

        try:
            self.precompute_in_progress = True

            pub_ids = [pub.id for pub in self.pubs_data]
            pub_coords = [
                (pub.longitude, pub.latitude) for pub in self.pubs_data
            ]

            precompute_distance_matrix(
                pub_coords, pub_ids, self.distances_file, self.osrm_url
            )

            # Reload the planner with new data
            if self.load_distance_data():
                return {
                    "status": "success",
                    "message": f"Precomputed distances for {len(self.pubs_data)} pubs",
                    "pubs_count": len(self.pubs_data),
                }
            else:
                raise Exception("Failed to load precomputed data")

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Precomputation failed: {str(e)}")
        finally:
            self.precompute_in_progress = False

    async def parse_raw_data(self) -> dict:
        """
        Parse raw pub data from raw.data file

        Processes raw.data and saves parsed pubs to data.json
        """
        try:
            if not os.path.exists(self.raw_data_file):
                raise HTTPException(
                    status_code=400,
                    detail="raw.data file not found",
                )

            raw_data = load_raw_data()
            parsed_pubs = parse_data(raw_data)

            # Save to data.json
            with open(self.data_file, "w") as f:
                json.dump(parsed_pubs, f, indent=2)

            # Reload pubs data
            self.load_pubs_data()

            return {
                "status": "success",
                "message": f"Parsed {len(parsed_pubs)} pubs",
                "pubs_count": len(parsed_pubs),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")

    async def get_status(self) -> PrecomputeStatusResponse:
        """Get current status of the API"""
        last_computed = None
        if os.path.exists(self.distances_file):
            last_computed = datetime.fromtimestamp(
                os.path.getmtime(self.distances_file)
            ).isoformat()

        return PrecomputeStatusResponse(
            is_computing=self.precompute_in_progress,
            progress_percent=None,
            estimated_pubs=len(self.pubs_data),
            matrix_file=self.distances_file,
            last_computed=last_computed,
        )

    async def _cleanup_expired_routes(self):
        """Background task to clean up expired shared routes every hour"""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                db = self.SessionLocal()
                try:
                    expired_routes = db.query(SharedRoute).filter(
                        SharedRoute.expires_at < datetime.utcnow()
                    ).all()
                    for route in expired_routes:
                        db.delete(route)
                    if expired_routes:
                        db.commit()
                        print(f"Deleted {len(expired_routes)} expired routes")
                finally:
                    db.close()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error during cleanup: {e}")

    async def create_shared_route(self, request: CreateSharedRouteRequest) -> SharedRouteResponse:
        """Create a shareable route and store it in the database"""
        try:
            # Generate a ULID for the share ID (shorter, more URL-friendly than full ULID)
            share_id = str(ULID())[:8].lower()

            # Convert legs to storable format (complete leg data with all fields)
            legs_data = None
            if request.legs:
                legs_data = [
                    {
                        "from_index": leg.from_index,
                        "to_index": leg.to_index,
                        "distance_meters": leg.distance_meters,
                        "duration_seconds": leg.duration_seconds,
                        "geometry_encoded": leg.geometry_encoded,
                    }
                    for leg in request.legs
                ]

            # Create the database record
            db = self.SessionLocal()
            try:
                shared_route = SharedRoute(
                    share_id=share_id,
                    start_longitude=request.start_point.longitude,
                    start_latitude=request.start_point.latitude,
                    end_longitude=request.end_point.longitude,
                    end_latitude=request.end_point.latitude,
                    route_indices=request.route_indices,
                    selected_pub_ids=request.selected_pub_ids,
                    num_pubs=request.num_pubs,
                    uniformity_weight=request.uniformity_weight,
                    total_distance_meters=request.total_distance_meters,
                    estimated_time_minutes=request.estimated_time_minutes,
                    legs_data=legs_data,
                )
                db.add(shared_route)
                db.commit()
                db.refresh(shared_route)

                # Build the response
                return SharedRouteResponse(
                    share_id=share_id,
                    share_url=f"https://example.com/route/{share_id}",
                    created_at=shared_route.created_at.isoformat(),
                    expires_at=shared_route.expires_at.isoformat(),
                    start_point=request.start_point,
                    end_point=request.end_point,
                    route_indices=request.route_indices,
                    selected_pub_ids=request.selected_pub_ids,
                    num_pubs=request.num_pubs,
                    uniformity_weight=request.uniformity_weight,
                    total_distance_meters=request.total_distance_meters,
                    estimated_time_minutes=request.estimated_time_minutes,
                    legs=request.legs,
                )
            finally:
                db.close()

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create shared route: {str(e)}")

    async def get_shared_route(self, share_id: str) -> SharedRouteResponse:
        """Retrieve a shared route by ID"""
        print(f"Attempting to get shared route with ID: {share_id}")
        try:
            db = self.SessionLocal()
            try:
                route = db.query(SharedRoute).filter(SharedRoute.share_id == share_id).first()
                print(f"Query result for share_id={share_id}: {route}")

                if not route:
                    raise HTTPException(status_code=404, detail="Route not found")

                if route.is_expired():
                    db.delete(route)
                    db.commit()
                    raise HTTPException(status_code=410, detail="Route has expired")

                # Update last accessed timestamp
                route.last_accessed_at = datetime.utcnow()  # type: ignore[assignment]
                db.commit()

                # Build the response with full pub details
                pubs_in_route = []
                for i, pub_index in enumerate(route.get_route_indices()):
                    if pub_index == "start" or pub_index == "end":
                        continue
                    if 0 <= pub_index < len(self.pubs_data):
                        pub = self.pubs_data[pub_index]
                        pubs_in_route.append(
                            PubInRoute(
                                index=pub_index,
                                pub_id=pub.id,
                                pub_name=pub.name,
                                longitude=pub.longitude,
                                latitude=pub.latitude,
                            )
                        )

                # Reconstruct legs from stored data
                legs = None
                legs_data = route.get_legs_data()
                if legs_data:
                    legs = []
                    for leg_data in legs_data:
                        legs.append(
                            RouteLegModel(
                                from_index=leg_data["from_index"],
                                to_index=leg_data["to_index"],
                                distance_meters=leg_data["distance_meters"],
                                duration_seconds=leg_data["duration_seconds"],
                                geometry_encoded=leg_data.get("geometry_encoded"),
                            )
                        )

                return SharedRouteResponse(
                    share_id=route.share_id,  # type: ignore[arg-type]
                    share_url=f"https://example.com/route/{route.share_id}",
                    created_at=route.created_at.isoformat(),
                    expires_at=route.expires_at.isoformat(),
                    start_point=CoordinateModel(
                        longitude=route.start_longitude,  # type: ignore[arg-type]
                        latitude=route.start_latitude,  # type: ignore[arg-type]
                    ),
                    end_point=CoordinateModel(
                        longitude=route.end_longitude,  # type: ignore[arg-type]
                        latitude=route.end_latitude,  # type: ignore[arg-type]
                    ),
                    route_indices=route.get_route_indices(),
                    selected_pub_ids=route.get_selected_pub_ids(),
                    num_pubs=route.num_pubs,  # type: ignore[arg-type]
                    uniformity_weight=route.uniformity_weight,  # type: ignore[arg-type]
                    total_distance_meters=route.total_distance_meters,  # type: ignore[arg-type]
                    estimated_time_minutes=route.estimated_time_minutes,  # type: ignore[arg-type]
                    legs=legs,
                    pubs=pubs_in_route,
                )
            finally:
                db.close()

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve route: {str(e)}")

    async def delete_shared_route(self, share_id: str) -> dict:
        """Delete a shared route early"""
        try:
            db = self.SessionLocal()
            try:
                route = db.query(SharedRoute).filter(SharedRoute.share_id == share_id).first()

                if not route:
                    raise HTTPException(status_code=404, detail="Route not found")

                db.delete(route)
                db.commit()

                return {"status": "deleted", "share_id": share_id}
            finally:
                db.close()

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete route: {str(e)}")


def create_app(
    osrm_url: Optional[str] = None,
    data_file: Optional[str] = None,
    distances_file: Optional[str] = None,
    raw_data_file: Optional[str] = None,
) -> FastAPI:
    """
    Factory function to create and configure the FastAPI app

    Args:
        osrm_url: URL of the OSRM server (default from OSRM_URL env var or http://localhost:5005)
        data_file: Path to parsed pubs data file (default from DATA_FILE env var or data/data.json)
        distances_file: Path to precomputed distances file (default from DISTANCES_FILE env var or data/pub_distances.pkl)
        raw_data_file: Path to raw data file (default from RAW_DATA_FILE env var or data/raw.data)

    Returns:
        Configured FastAPI application
    """
    # Use environment variables if not provided
    osrm_url = osrm_url or os.getenv("OSRM_URL", "http://localhost:5005")

    app_instance = PubCrawlPlannerApp(
        osrm_url=osrm_url,
        data_file=data_file,
        distances_file=distances_file,
        raw_data_file=raw_data_file,
    )
    return app_instance.app


# Create the app instance for uvicorn
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
