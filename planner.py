import numpy as np
import random
from typing import List, Tuple, Dict
from osrm_client import OSRMClient

class PubCrawlPlanner:
    """Plan optimal pub crawl routes"""

    def __init__(self, distance_matrix: np.ndarray,
                 pub_coords: List[Tuple[float, float]],
                 pub_ids: List[int],
                 osrm_client: OSRMClient):
        """
        Initialize planner

        Args:
            distance_matrix: Pre-computed n×n distance matrix (pub-to-pub)
            pub_coords: List of (longitude, latitude) for each pub
            pub_ids: List of pub IDs
            osrm_client: OSRM client for runtime distance queries
        """
        self.distance_matrix = distance_matrix
        self.pub_coords = pub_coords
        self.pub_ids = pub_ids
        self.n_pubs = len(pub_ids)
        self.osrm_client = osrm_client
        self.distance_cache = {}
        self.start_point = None
        self.end_point = None

    def plan_crawl(self, start_point: Tuple[float, float],
                   end_point: Tuple[float, float],
                   num_pubs: int,
                   uniformity_weight: float = 0.35) -> Dict:
        """
        Generate optimal pub crawl route

        Args:
            start_point: (longitude, latitude) starting coordinates
            end_point: (longitude, latitude) ending coordinates
            num_pubs: number of pubs to visit
            uniformity_weight: 0-1, higher = more uniform spacing

        Returns:
            Dictionary with route details
        """
        # Store start/end points for later use in get_navigation_details
        self.start_point = start_point
        self.end_point = end_point

        # Phase 1: Select candidate pubs
        candidates = self.select_candidate_pubs(start_point, end_point, num_pubs * 4)

        # Phase 2: Pre-fetch distances from start/end to candidates
        self.precompute_endpoint_distances(start_point, end_point, candidates)

        # Phase 3: Optimize route
        best_route = self.optimize_route(start_point, end_point, candidates, 
                                         num_pubs, uniformity_weight)

        # Build result
        total_distance = self.route_distance(best_route)

        return {
            'route': best_route,
            'pub_ids': [self.pub_ids[idx] if isinstance(idx, int) else None 
                       for idx in best_route],
            'total_distance': total_distance,
            'estimated_time_minutes': total_distance / 80.0,  # ~80m/min walking speed
            'num_pubs': num_pubs
        }

    def select_candidate_pubs(self, start: Tuple[float, float],
                             end: Tuple[float, float],
                             num_candidates: int) -> List[int]:
        """Select pubs roughly along corridor from start to end, sorted by progress"""
        candidates_with_progress = []

        for pub_idx in range(self.n_pubs):
            coords = self.pub_coords[pub_idx]

            # Progress along start-end line (0 to 1)
            progress = self.project_onto_line(start, end, coords)

            # Perpendicular distance from line
            perp_dist = self.perpendicular_distance(start, end, coords)

            # Score: prefer pubs along path, not too far to the side
            proximity_score = perp_dist

            candidates_with_progress.append((proximity_score, progress, pub_idx))

        # Sort by proximity first, then return candidates sorted by progress
        candidates_with_progress.sort(key=lambda x: x[0])

        # Take top candidates by proximity
        top_candidates = candidates_with_progress[:min(num_candidates, self.n_pubs)]

        # Sort those by progress along the path to avoid backtracking
        top_candidates.sort(key=lambda x: x[1])

        return [pub_idx for _, _, pub_idx in top_candidates]

    def precompute_endpoint_distances(self, start: Tuple[float, float], 
                                     end: Tuple[float, float], 
                                     candidate_pub_ids: List[int]):
        """Pre-fetch distances from start/end to all candidate pubs"""
        candidate_coords = [self.pub_coords[idx] for idx in candidate_pub_ids]

        # Batch API call: start → all candidates
        start_distances = self.osrm_client.get_distances_from_point(start, candidate_coords)

        # Batch API call: all candidates → end
        end_distances = self.osrm_client.get_distances_to_point(candidate_coords, end)

        # Cache these
        for i, pub_idx in enumerate(candidate_pub_ids):
            self.distance_cache[('start', pub_idx)] = start_distances[i]
            self.distance_cache[(pub_idx, 'end')] = end_distances[i]

    def optimize_route(self, start: Tuple[float, float], 
                      end: Tuple[float, float], 
                      candidates: List[int], 
                      k: int,
                      uniformity_weight: float) -> List:
        """Find best subset and route through candidates"""
        if k <= 12:
            return self.sample_and_optimize(start, end, candidates, k,
                                           uniformity_weight, n_samples=1000)
        else:
            return self.greedy_with_improvement(start, end, candidates, k, 
                                               uniformity_weight)

    def sample_and_optimize(self, start, end, candidates, k,
                           uniformity_weight, n_samples) -> List:
        """Sample random combinations and optimize each with 2-opt"""
        best_route = []
        best_score = float('inf')

        for _ in range(n_samples):
            # Random selection of k pubs
            selected = random.sample(candidates, k)

            # Find best order with 2-opt, considering uniformity
            route = self.two_opt_with_fixed_endpoints(start, end, selected, uniformity_weight)

            # Enforce strict forward progress constraint - no backtracking allowed
            if self.violates_forward_progress_constraint(start, end, route, threshold=0.05):
                continue

            # Evaluate
            score = self.evaluate_route(route, uniformity_weight)

            if score < best_score:
                best_score = score
                best_route = route

        return best_route

    def two_opt_with_fixed_endpoints(self, start, end, pub_ids, uniformity_weight=0):
        """2-opt TSP improvement with fixed start and end points"""
        # Start with nearest neighbor ordering
        route = self.nearest_neighbor_order(start, end, pub_ids)
        improved = True

        while improved:
            improved = False

            # Try swapping edges (keep start and end fixed)
            for i in range(1, len(route) - 2):
                for j in range(i + 1, len(route) - 1):
                    # Reverse segment between i and j
                    new_route = route[:i] + route[i:j+1][::-1] + route[j+1:]

                    # Strictly enforce forward progress constraint
                    # Use strict threshold (0.05) to prevent even small backtracking
                    if self.violates_forward_progress_constraint(start, end, new_route, threshold=0.05):
                        continue

                    # Use evaluate_route if uniformity_weight > 0, otherwise just distance
                    if uniformity_weight > 0:
                        if self.evaluate_route(new_route, uniformity_weight) < self.evaluate_route(route, uniformity_weight):
                            route = new_route
                            improved = True
                            break
                    else:
                        if self.route_distance(new_route) < self.route_distance(route):
                            route = new_route
                            improved = True
                            break

                if improved:
                    break

        return route

    def nearest_neighbor_order(self, start, end, pub_ids):
        """Greedy nearest neighbor starting from start, biased toward forward progress"""
        route = ['start']
        remaining = set(pub_ids)
        current = 'start'

        while remaining:
            # Find unvisited pub that minimizes: distance + penalty for backtracking
            # Get current progress (0-1) if current is a pub, otherwise 0 for start
            current_progress = self.project_onto_line(start, end, self.pub_coords[current]) if isinstance(current, int) else 0

            def scoring_fn(p):
                distance = self.get_distance(current, p)
                # Penalty for moving backward along the path
                pub_progress = self.project_onto_line(start, end, self.pub_coords[p])
                backtrack_penalty = max(0, current_progress - pub_progress) * 5000  # Large penalty for backtracking
                return distance + backtrack_penalty

            nearest = min(remaining, key=scoring_fn)
            route.append(nearest)
            remaining.remove(nearest)
            current = nearest

        route.append('end')
        return route

    def greedy_with_improvement(self, start, end, candidates, k, uniformity_weight):
        """Greedy with forward-biased selection for larger k"""
        route = ['start']
        remaining = set(candidates)

        for _ in range(k):
            current = route[-1]
            current_progress = self.project_onto_line(start, end, self.pub_coords[current]) if isinstance(current, int) else 0

            # Pick pub that minimizes: distance_to_pub + estimated_distance_to_end + backtrack_penalty
            def scoring_fn(p):
                distance = self.get_distance(current, p)
                distance_to_end = self.get_distance(p, 'end')
                pub_progress = self.project_onto_line(start, end, self.pub_coords[p])

                # Strong penalty for backtracking - disqualify if regression > 5%
                if current_progress - pub_progress > 0.05:
                    return float('inf')

                # Additional penalty for any backward movement
                backtrack_penalty = max(0, current_progress - pub_progress) * 10000
                return distance + distance_to_end + backtrack_penalty

            best_pub = min(remaining, key=scoring_fn)

            # Skip if no valid forward-moving pub found
            if scoring_fn(best_pub) == float('inf'):
                # Pick the best remaining even without forward progress guarantee
                best_pub = min(remaining, key=lambda p:
                    self.get_distance(current, p) + self.get_distance(p, 'end')
                )

            route.append(best_pub)
            remaining.remove(best_pub)

        route.append('end')

        # Apply 2-opt improvement with uniformity consideration
        return self.two_opt_with_fixed_endpoints(start, end, route[1:-1], uniformity_weight)

    def evaluate_route(self, route, uniformity_weight):
        """Objective function: minimize total time + penalty for non-uniform spacing"""
        segments = []
        for i in range(len(route) - 1):
            dist = self.get_distance(route[i], route[i+1])
            segments.append(dist)

        total_distance = sum(segments)

        # Uniformity penalty (standard deviation of all segments including start and end)
        if len(segments) > 1:
            mean_dist = total_distance / len(segments)
            variance = sum((d - mean_dist) ** 2 for d in segments) / len(segments)
            uniformity_penalty = variance ** 0.5
        else:
            uniformity_penalty = 0

        return total_distance + uniformity_weight * uniformity_penalty * 100

    def violates_forward_progress_constraint(self, start, end, route, threshold=0.1):
        """Check if route has excessive backtracking along the corridor

        Args:
            start: Start coordinates
            end: End coordinates
            route: Route to check
            threshold: Maximum allowed progress regression (0-1). Default 0.1 = 10%

        Returns:
            True if route violates forward progress constraint
        """
        # Extract pub indices from route
        pub_sequence = [idx for idx in route if isinstance(idx, int)]

        if len(pub_sequence) < 2:
            return False

        # Calculate progress values for each pub
        progress_values = [self.project_onto_line(start, end, self.pub_coords[idx])
                          for idx in pub_sequence]

        # Check for backtracking exceeding threshold
        for i in range(1, len(progress_values)):
            if progress_values[i] < progress_values[i-1] - threshold:
                return True

        return False

    def get_distance(self, point_a, point_b):
        """Get walking distance between two points"""
        # Handle start/end markers
        if point_a == 'start' or point_b == 'end':
            cache_key = (point_a, point_b)
            if cache_key in self.distance_cache:
                return self.distance_cache[cache_key]
            raise ValueError(f"Distance not found for {point_a} → {point_b}")

        # Both are pubs - use pre-computed matrix
        if isinstance(point_a, int) and isinstance(point_b, int):
            return self.distance_matrix[point_a][point_b]

        raise ValueError(f"Invalid points: {point_a}, {point_b}")

    def route_distance(self, route):
        """Total walking distance for a route"""
        return sum(self.get_distance(route[i], route[i+1]) 
                   for i in range(len(route) - 1))

    def project_onto_line(self, start: Tuple[float, float], 
                         end: Tuple[float, float], 
                         point: Tuple[float, float]) -> float:
        """Project point onto line from start to end, return 0-1"""
        # Vector from start to end
        dx = end[0] - start[0]
        dy = end[1] - start[1]

        # Vector from start to point
        px = point[0] - start[0]
        py = point[1] - start[1]

        # Dot product / length squared
        line_length_sq = dx * dx + dy * dy
        if line_length_sq == 0:
            return 0

        t = (px * dx + py * dy) / line_length_sq

        return max(0, min(1, t))

    def perpendicular_distance(self, start: Tuple[float, float], 
                              end: Tuple[float, float], 
                              point: Tuple[float, float]) -> float:
        """Calculate perpendicular distance from point to line (in degrees, approximation)"""
        # Vector from start to end
        dx = end[0] - start[0]
        dy = end[1] - start[1]

        # Vector from start to point
        px = point[0] - start[0]
        py = point[1] - start[1]

        # Cross product / line length
        line_length = (dx * dx + dy * dy) ** 0.5
        if line_length == 0:
            return ((px * px + py * py) ** 0.5) * 111000  # Convert to meters

        cross = abs(dx * py - dy * px)
        perp_dist_degrees = cross / line_length

        # Rough conversion to meters (at mid-latitudes)
        return perp_dist_degrees * 111000

    def get_navigation_details(self, route: List) -> List[Dict]:
        """
        Get turn-by-turn directions for final route

        Args:
            route: List from plan_crawl result

        Returns:
            List of navigation details for each leg
        """
        navigation = []

        for i in range(len(route) - 1):
            from_point = route[i]
            to_point = route[i + 1]

            # Convert pub indices to coordinates
            if isinstance(from_point, int):
                from_coords = self.pub_coords[from_point]
            elif from_point == 'start':
                from_coords = self.start_point
            else:
                from_coords = from_point  # Already coordinates

            if isinstance(to_point, int):
                to_coords = self.pub_coords[to_point]
            elif to_point == 'end':
                to_coords = self.end_point
            else:
                to_coords = to_point

            # Get directions
            leg = self.osrm_client.get_directions(from_coords, to_coords)
            navigation.append(leg)

        return navigation
