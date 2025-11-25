"""Utilities for encoding and decoding polylines"""

import polyline


def encode_polyline(coordinates: list[tuple[float, float]]) -> str:
    """
    Encode a list of (longitude, latitude) coordinates to a polyline string.

    Args:
        coordinates: List of (lng, lat) tuples

    Returns:
        Encoded polyline string
    """
    if not coordinates:
        return ""

    # polyline library expects (lat, lng) order, but we use (lng, lat)
    # So we need to reverse each coordinate pair
    lat_lng_coords = [(lat, lng) for lng, lat in coordinates]
    return polyline.encode(lat_lng_coords, precision=5)


def decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """
    Decode a polyline string to a list of (longitude, latitude) coordinates.

    Args:
        encoded: Encoded polyline string

    Returns:
        List of (lng, lat) tuples
    """
    if not encoded:
        return []

    # polyline.decode returns (lat, lng) tuples
    lat_lng_coords = polyline.decode(encoded, precision=5)
    # Convert to (lng, lat) for consistency with our codebase
    return [(lng, lat) for lat, lng in lat_lng_coords]
