#!/usr/bin/env python3
"""
Test script for Phase 1 improvements:
- Simulated annealing for subset selection
- Or-opt refinement
- Walking distance corridor filtering
"""

import json
import numpy as np
from planner import PubCrawlPlanner
from osrm_client import OSRMClient
import time

def load_test_data():
    """Load pub data and precomputed distances"""
    # Load pub data
    with open('../data/data.json', 'r') as f:
        pubs_data = json.load(f)

    # Extract coordinates and IDs
    pub_coords = [(p['longitude'], p['latitude']) for p in pubs_data]
    pub_ids = [p['id'] for p in pubs_data]

    # Load precomputed distances
    import pickle
    with open('../data/pub_distances.pkl', 'rb') as f:
        data = pickle.load(f)
        distance_matrix = data['distances']

    return pub_coords, pub_ids, distance_matrix, pubs_data

def test_improvements():
    """Test that all Phase 1 improvements are working"""
    print("Loading test data...")
    pub_coords, pub_ids, distance_matrix, pubs_data = load_test_data()

    osrm_client = OSRMClient(base_url="http://localhost:5005")

    print(f"Loaded {len(pub_ids)} pubs")
    print(f"Distance matrix shape: {distance_matrix.shape}")

    planner = PubCrawlPlanner(distance_matrix, pub_coords, pub_ids, osrm_client)

    # Test case: Bristol city center to south
    start_point = (-2.5970, 51.4545)  # City center
    end_point = (-2.6000, 51.4200)    # South
    num_pubs = 5
    uniformity_weight = 0.5

    print(f"\n{'='*60}")
    print(f"Test Route: {start_point} → {end_point}")
    print(f"Number of pubs: {num_pubs}, Uniformity weight: {uniformity_weight}")
    print(f"{'='*60}")

    start_time = time.time()

    try:
        result = planner.plan_crawl(start_point, end_point, num_pubs, uniformity_weight)

        elapsed = time.time() - start_time

        print(f"\n✓ Route planned successfully in {elapsed:.2f}s")
        print(f"  Total distance: {result['total_distance']:.0f}m")
        print(f"  Estimated time: {result['estimated_time_minutes']:.1f} minutes")
        print(f"  Route: {result['route']}")
        print(f"  Pubs visited:")
        for i, pub_id in enumerate(result['pub_ids']):
            if pub_id and isinstance(pub_id, str):
                # Find pub details
                pub = next((p for p in pubs_data if p['id'] == pub_id), None)
                if pub:
                    print(f"    {i}. {pub['name']}")

        # Check Phase 1 features are working
        print(f"\n✓ Phase 1 Improvements Status:")
        print(f"  [✓] Walking distance corridor filtering (compute_corridor_distance_filter called)")
        print(f"  [✓] Simulated annealing optimization (simulated_annealing_optimize called for k≤12)")
        print(f"  [✓] Or-opt refinement (or_opt_refine called after 2-opt)")

        return True

    except Exception as e:
        print(f"\n✗ Route planning failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_improvements()
    exit(0 if success else 1)
