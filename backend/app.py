import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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
)
from osrm_client import OSRMClient
from planner import PubCrawlPlanner
from precompute_distances import load_distance_matrix, precompute_distance_matrix
from parse import parse_data, load_raw_data


class PubCrawlPlannerApp:
    """Main application class for the pub crawl planner API"""

    def __init__(
        self,
        osrm_url: str = "http://localhost:5005",
        data_file: str = "data.json",
        distances_file: str = "pub_distances.pkl",
        raw_data_file: str = "raw.data",
    ):
        """
        Initialize the application

        Args:
            osrm_url: URL of the OSRM server
            data_file: Path to parsed pubs data file
            distances_file: Path to precomputed distances file
            raw_data_file: Path to raw data file
        """
        print("Initializing PubCrawlPlannerApp...")
        self.osrm_url = osrm_url
        self.data_file = data_file
        self.distances_file = distances_file
        self.raw_data_file = raw_data_file

        # State
        self.planner: Optional[PubCrawlPlanner] = None
        self.pubs_data: List[PubModel] = []
        self.osrm_client = OSRMClient(base_url=self.osrm_url)
        self.precompute_in_progress = False

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
        self.app.get("/health", response_model=HealthResponse)(self.health_check)
        self.app.get("/pubs", response_model=List[PubModel])(self.list_pubs)
        self.app.get("/pubs/{pub_id}", response_model=PubModel)(self.get_pub)
        self.app.post("/plan", response_model=PlanCrawlResponse)(self.plan_crawl)
        self.app.post("/directions", response_model=List[RouteLegModel])(
            self.get_directions
        )
        self.app.post("/precompute", response_model=dict)(self.trigger_precomputation)
        self.app.post("/parse", response_model=dict)(self.parse_raw_data)
        self.app.get("/status", response_model=PrecomputeStatusResponse)(self.get_status)

    @asynccontextmanager
    async def _lifespan(self, app: FastAPI):
        """Startup and shutdown logic"""
        # Startup
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

        yield

        # Shutdown
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
            print(f"include_directions: {request.include_directions}")
            if request.include_directions:
                print(f"Fetching directions for route: {result['route']}")
                try:
                    legs = self.get_route_legs(
                        result["route"],
                        request.start_point.tuple,
                        request.end_point.tuple,
                    )
                    print(f"Successfully fetched {len(legs)} legs")
                except Exception as e:
                    print(f"Warning: Failed to get directions: {e}")
                    import traceback
                    traceback.print_exc()
                    # Continue without directions rather than failing completely
                    legs = None

            return PlanCrawlResponse(
                route_indices=result["route"],
                pubs=pubs_in_route,
                total_distance_meters=result["total_distance"],
                estimated_time_minutes=result["estimated_time_minutes"],
                num_pubs=result["num_pubs"],
                legs=legs,
            )

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
                from_coords = from_idx

            if to_idx == "end":
                to_coords = end_point
            elif isinstance(to_idx, int):
                to_coords = (
                    self.pubs_data[to_idx].longitude,
                    self.pubs_data[to_idx].latitude,
                )
            else:
                to_coords = to_idx

            # Get directions from OSRM
            try:
                print(f"Fetching directions from {from_coords} to {to_coords}")
                directions = self.osrm_client.get_directions(from_coords, to_coords)
                print(f"Got directions: distance={directions['distance']}, duration={directions['duration']}")
                print(f"Geometry type: {type(directions['geometry'])}")
                leg = RouteLegModel(
                    from_index=i,
                    to_index=i + 1,
                    distance_meters=directions["distance"],
                    duration_seconds=directions["duration"],
                    steps=directions["steps"],
                    geometry=directions["geometry"],
                )
                print(f"Created leg {i}: {leg}")
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


def create_app(
    osrm_url: str = None,
    data_file: str = "data.json",
    distances_file: str = "pub_distances.pkl",
    raw_data_file: str = "raw.data",
) -> FastAPI:
    """
    Factory function to create and configure the FastAPI app

    Args:
        osrm_url: URL of the OSRM server (default from OSRM_URL env var or http://localhost:5005)
        data_file: Path to parsed pubs data file
        distances_file: Path to precomputed distances file
        raw_data_file: Path to raw data file

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
