"""Database models for the crawl planner application"""

from datetime import datetime, timedelta
import json
from sqlalchemy import Column, String, Float, Integer, DateTime, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class SharedRoute(Base):
    """Model for storing shareable pub crawl routes"""
    __tablename__ = "shared_routes"

    # Primary key: 6-character ULID (similar to Vercel/Figma)
    share_id = Column(String(26), primary_key=True, unique=True, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)  # created_at + 30 days
    last_accessed_at = Column(DateTime, default=datetime.utcnow)

    # Route coordinates
    start_longitude = Column(Float, nullable=False)
    start_latitude = Column(Float, nullable=False)
    end_longitude = Column(Float, nullable=False)
    end_latitude = Column(Float, nullable=False)

    # Route data (stored as JSON strings for flexibility)
    route_indices = Column(Text, nullable=False)  # JSON-serialized list
    selected_pub_ids = Column(Text, nullable=False)  # JSON-serialized list

    # Route parameters and metrics
    num_pubs = Column(Integer, nullable=False)
    uniformity_weight = Column(Float, nullable=False)
    total_distance_meters = Column(Float, nullable=False)
    estimated_time_minutes = Column(Float, nullable=False)

    # Route legs with encoded geometry (stored as JSON string)
    legs_geometry_encoded = Column(Text, nullable=True)  # JSON-serialized list of leg geometries

    def __init__(
        self,
        share_id: str,
        start_longitude: float,
        start_latitude: float,
        end_longitude: float,
        end_latitude: float,
        route_indices: list,
        selected_pub_ids: list,
        num_pubs: int,
        uniformity_weight: float,
        total_distance_meters: float,
        estimated_time_minutes: float,
        legs_geometry_encoded: list = None,
        ttl_days: int = 30,
    ):
        self.share_id = share_id
        self.start_longitude = start_longitude
        self.start_latitude = start_latitude
        self.end_longitude = end_longitude
        self.end_latitude = end_latitude
        self.route_indices = json.dumps(route_indices)
        self.selected_pub_ids = json.dumps(selected_pub_ids)
        self.num_pubs = num_pubs
        self.uniformity_weight = uniformity_weight
        self.total_distance_meters = total_distance_meters
        self.estimated_time_minutes = estimated_time_minutes
        self.legs_geometry_encoded = json.dumps(legs_geometry_encoded) if legs_geometry_encoded else None

        # Set expiration date
        now = datetime.utcnow()
        self.created_at = now
        self.expires_at = now + timedelta(days=ttl_days)
        self.last_accessed_at = now

    def get_route_indices(self) -> list:
        """Deserialize route_indices from JSON"""
        return json.loads(self.route_indices)

    def get_selected_pub_ids(self) -> list:
        """Deserialize selected_pub_ids from JSON"""
        return json.loads(self.selected_pub_ids)

    def get_legs_geometry_encoded(self) -> list:
        """Deserialize legs_geometry_encoded from JSON"""
        if self.legs_geometry_encoded:
            return json.loads(self.legs_geometry_encoded)
        return None

    def is_expired(self) -> bool:
        """Check if the route has expired"""
        return datetime.utcnow() > self.expires_at
