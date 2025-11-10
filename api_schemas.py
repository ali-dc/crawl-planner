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
    steps: List[Dict] = Field(default_factory=list, description="Turn-by-turn steps")
    geometry: Optional[Dict] = None


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
