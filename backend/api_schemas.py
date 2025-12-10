"""Pydantic schemas for API requests and responses"""

from pydantic import BaseModel, Field
from typing import List, Dict, Tuple, Optional


class CoordinateModel(BaseModel):
    """Coordinate pair (longitude, latitude)"""
    longitude: float = Field(..., description="Longitude coordinate")
    latitude: float = Field(..., description="Latitude coordinate")

    @property
    def tuple(self) -> Tuple[float, float]:
        """Convert to (longitude, latitude) tuple"""
        return (self.longitude, self.latitude)


class PubModel(BaseModel):
    """Pub information"""
    id: str
    name: str
    longitude: float
    latitude: float
    address: Optional[Dict] = None

    class Config:
        from_attributes = True


class PlanCrawlRequest(BaseModel):
    """Request to plan a pub crawl"""
    start_point: CoordinateModel = Field(
        ..., description="Starting location (longitude, latitude)"
    )
    end_point: CoordinateModel = Field(
        ..., description="Ending location (longitude, latitude)"
    )
    num_pubs: int = Field(
        ..., ge=1, le=100, description="Number of pubs to visit"
    )
    uniformity_weight: float = Field(
        default=0.2, ge=0, le=1, description="Higher = more uniform spacing"
    )
    include_directions: bool = Field(
        default=True, description="Include turn-by-turn directions in response"
    )
    excluded_pub_ids: Optional[List[str]] = Field(
        default=None, description="Pub IDs to exclude from planning"
    )


class PubInRoute(BaseModel):
    """A pub in a planned route"""
    index: int = Field(..., description="Position in route (0-indexed)")
    pub_id: str
    pub_name: Optional[str] = None
    longitude: float
    latitude: float


class RouteLegModel(BaseModel):
    """Navigation details for one leg of the route"""
    from_index: int = Field(..., description="Index in route (start, pub, or end)")
    to_index: int = Field(..., description="Index in route (start, pub, or end)")
    distance_meters: float
    duration_seconds: float
    geometry_encoded: Optional[str] = Field(
        default=None, description="Polyline-encoded geometry string for efficient transmission"
    )


class PlanCrawlResponse(BaseModel):
    """Response from planning a pub crawl"""
    route_indices: List[int | str] = Field(
        ..., description="List of pub indices in order, with 'start' and 'end' markers"
    )
    pubs: List[PubInRoute] = Field(..., description="Detailed pub information in route")
    total_distance_meters: float
    estimated_time_minutes: float
    num_pubs: int
    legs: Optional[List[RouteLegModel]] = Field(
        default=None, description="Navigation details for each leg"
    )
    share_id: Optional[str] = Field(
        default=None, description="Unique share ID for this route"
    )


class DirectionsRequest(BaseModel):
    """Request for turn-by-turn directions for a planned route"""
    route_indices: List[int | str] = Field(
        ..., description="Route from planning response (with 'start'/'end' markers)"
    )
    start_point: CoordinateModel
    end_point: CoordinateModel


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    osrm_available: bool
    distance_matrix_loaded: bool


class PrecomputeStatusResponse(BaseModel):
    """Status of distance matrix precomputation"""
    is_computing: bool
    progress_percent: Optional[float] = None
    estimated_pubs: int
    matrix_file: str
    last_computed: Optional[str] = None


class CreateSharedRouteRequest(BaseModel):
    """Request to create a shareable route"""
    start_point: CoordinateModel = Field(
        ..., description="Starting location (longitude, latitude)"
    )
    end_point: CoordinateModel = Field(
        ..., description="Ending location (longitude, latitude)"
    )
    route_indices: List[int | str] = Field(
        ..., description="Route from planning response (with 'start'/'end' markers)"
    )
    selected_pub_ids: List[str] = Field(
        ..., description="List of pub IDs in route order"
    )
    num_pubs: int = Field(..., ge=1, le=100)
    uniformity_weight: float = Field(..., ge=0, le=1)
    total_distance_meters: float = Field(..., gt=0)
    estimated_time_minutes: float = Field(..., gt=0)
    legs: Optional[List[RouteLegModel]] = Field(
        default=None, description="Navigation details for each leg with encoded geometry"
    )


class SharedRouteResponse(BaseModel):
    """Response when creating or retrieving a shared route"""
    share_id: str = Field(..., description="Unique identifier for sharing")
    share_url: str = Field(..., description="Full shareable URL")
    created_at: str = Field(..., description="ISO 8601 timestamp")
    expires_at: str = Field(..., description="ISO 8601 timestamp")
    start_point: CoordinateModel
    end_point: CoordinateModel
    route_indices: List[int | str]
    selected_pub_ids: List[str]
    num_pubs: int
    uniformity_weight: float
    total_distance_meters: float
    estimated_time_minutes: float
    legs: Optional[List[RouteLegModel]] = Field(
        default=None, description="Navigation details for each leg with encoded geometry"
    )
    pubs: Optional[List[PubInRoute]] = Field(
        default=None, description="Full pub details (included when retrieving)"
    )


class RouteEstimate(BaseModel):
    """Quick estimate of route metrics"""
    total_distance_meters: float
    estimated_time_minutes: float


class AlternativePub(BaseModel):
    """A suggested alternative pub"""
    pub_id: str
    pub_name: str
    longitude: float
    latitude: float
    added_distance_meters: float = Field(
        ..., description="How much this adds vs. skipping the pub"
    )
    reason: str = Field(
        ..., description="e.g., 'Nearby', 'On path', 'Popular'"
    )


class AlternativePubsRequest(BaseModel):
    """Request for alternative pub suggestions"""
    start_point: CoordinateModel
    end_point: CoordinateModel
    current_route_indices: List[int | str] = Field(
        ..., description="Current route with 'start' and 'end' markers"
    )
    removed_pub_index: int = Field(
        ..., description="Index in current_route_indices of pub being removed"
    )
    excluded_pub_ids: List[str] = Field(
        default_factory=list, description="Already excluded pub IDs"
    )


class AlternativePubsResponse(BaseModel):
    """Response with alternative pub suggestions"""
    alternatives: List[AlternativePub]
    route_without_pub: RouteEstimate = Field(
        ..., description="What the route looks like if we just remove the pub"
    )


class ReplacePubRequest(BaseModel):
    """Request to replace a pub in an existing route"""
    start_point: CoordinateModel
    end_point: CoordinateModel
    current_route_indices: List[int | str] = Field(
        ..., description="Current route with 'start' and 'end' markers"
    )
    removed_pub_index: int = Field(
        ..., description="Index in route being removed"
    )
    replacement_pub_id: Optional[str] = Field(
        default=None, description="None = just remove, don't replace"
    )
    num_pubs: int = Field(
        ..., ge=1, le=100, description="Number of pubs in the route"
    )
    uniformity_weight: float = Field(
        default=0.5, ge=0, le=1, description="Higher = more uniform spacing"
    )
    include_directions: bool = Field(
        default=True, description="Include turn-by-turn directions in response"
    )
