import requests
import numpy as np
from typing import List, Tuple

class OSRMClient:
    """Client for interacting with OSRM routing server"""

    def __init__(self, base_url: str = 'http://localhost:5005'):
        self.base_url = base_url

    def get_walking_distance(self, from_coords: Tuple[float, float],
                            to_coords: Tuple[float, float]) -> float:
        """
        Get walking distance between two points

        Args:
            from_coords: (longitude, latitude) - NOTE: lon, lat order!
            to_coords: (longitude, latitude)

        Returns:
            Distance in meters
        """
        url = f"{self.base_url}/route/v1/foot/{from_coords[0]},{from_coords[1]};{to_coords[0]},{to_coords[1]}"

        params = {
            'overview': 'false',
            'steps': 'false'
        }

        response = requests.get(url, params=params)
        response.raise_for_status()

        data = response.json()

        if data['code'] != 'Ok':
            raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")

        return data['routes'][0]['distance']  # type: ignore[no-any-return]

    def get_distance_matrix(self, coordinates: List[Tuple[float, float]]) -> np.ndarray:
        """
        Get distance matrix for multiple points (much faster than individual calls)

        Args:
            coordinates: List of (longitude, latitude) tuples

        Returns:
            n×n numpy array of distances in meters
        """
        coords_str = ';'.join([f"{lon},{lat}" for lon, lat in coordinates])

        url = f"{self.base_url}/table/v1/foot/{coords_str}"

        params = {
            'annotations': 'distance'
        }

        response = requests.get(url, params=params)
        response.raise_for_status()

        data = response.json()

        if data['code'] != 'Ok':
            raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")

        distances = np.array(data['distances'], dtype=np.float32)

        return distances

    def get_directions(self, from_coords: Tuple[float, float],
                      to_coords: Tuple[float, float]) -> dict:
        """
        Get full turn-by-turn directions

        Returns:
            Dictionary with distance, duration, steps, and geometry
        """
        url = f"{self.base_url}/route/v1/foot/{from_coords[0]},{from_coords[1]};{to_coords[0]},{to_coords[1]}"

        params = {
            'overview': 'full',
            'steps': 'true',
            'geometries': 'geojson'
        }

        response = requests.get(url, params=params)
        response.raise_for_status()

        data = response.json()

        if data['code'] != 'Ok':
            raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")

        route = data['routes'][0]

        return {
            'distance': route['distance'],
            'duration': route['duration'],
            'steps': route['legs'][0]['steps'],
            'geometry': route['geometry']
        }

    def get_distances_from_point(self, origin: Tuple[float, float], 
                                 destinations: List[Tuple[float, float]]) -> List[float]:
        """
        Get distances from one origin to multiple destinations

        Args:
            origin: (longitude, latitude)
            destinations: List of (longitude, latitude) tuples

        Returns:
            List of distances in meters
        """
        all_coords = [origin] + destinations
        matrix = self.get_distance_matrix(all_coords)

        # Return first row (distances from origin to all destinations)
        return matrix[0, 1:].tolist()  # type: ignore[no-any-return]

    def get_distances_to_point(self, origins: List[Tuple[float, float]], 
                               destination: Tuple[float, float]) -> List[float]:
        """
        Get distances from multiple origins to one destination

        Args:
            origins: List of (longitude, latitude) tuples
            destination: (longitude, latitude)

        Returns:
            List of distances in meters
        """
        all_coords = origins + [destination]
        matrix = self.get_distance_matrix(all_coords)

        # Return last column (distances from all origins to destination)
        return matrix[:-1, -1].tolist()  # type: ignore[no-any-return]
