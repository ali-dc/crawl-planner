import pickle
import numpy as np
import os
import json
from typing import List, Tuple
from tqdm import tqdm
from dotenv import load_dotenv
from osrm_client import OSRMClient

# Load environment variables from .env file
load_dotenv()

def precompute_distance_matrix(pub_coords: List[Tuple[float, float]], 
                               pub_ids: List[str],
                               output_file: str = 'pub_distances.pkl',
                               osrm_url: str = 'http://localhost:5005'):
    """
    Pre-compute all pub-to-pub distances using OSRM

    Args:
        pub_coords: List of (longitude, latitude) for each pub
        pub_ids: List of pub IDs corresponding to coordinates
        output_file: Path to save pickled distance matrix
        osrm_url: URL of OSRM server
    """
    client = OSRMClient(base_url=osrm_url)
    n_pubs = len(pub_coords)

    print(f"Computing distances for {n_pubs} pubs...")

    # OSRM's table endpoint has a limit (typically 100x100)
    MAX_BATCH_SIZE = 50

    distances = np.zeros((n_pubs, n_pubs), dtype=np.float32)

    if n_pubs <= MAX_BATCH_SIZE:
        # Single request for all pubs
        print("Fetching distance matrix in one request...")
        distances = client.get_distance_matrix(pub_coords)
    else:
        # Batch processing
        print("Batching requests...")
        num_batches = (n_pubs + MAX_BATCH_SIZE - 1) // MAX_BATCH_SIZE

        with tqdm(total=num_batches * num_batches) as pbar:
            for i in range(0, n_pubs, MAX_BATCH_SIZE):
                for j in range(0, n_pubs, MAX_BATCH_SIZE):
                    i_end = min(i + MAX_BATCH_SIZE, n_pubs)
                    j_end = min(j + MAX_BATCH_SIZE, n_pubs)

                    # Get coordinates for this batch
                    batch_i = pub_coords[i:i_end]
                    batch_j = pub_coords[j:j_end]

                    # Combine coordinates
                    batch_coords = batch_i + batch_j

                    # Get distance matrix for batch
                    batch_matrix = client.get_distance_matrix(batch_coords)

                    # Extract the relevant sub-matrix
                    n_i = len(batch_i)
                    n_j = len(batch_j)
                    distances[i:i_end, j:j_end] = batch_matrix[:n_i, n_i:n_i+n_j]

                    pbar.update(1)

    # Save the matrix
    data = {
        'distances': distances,
        'pub_coords': pub_coords,
        'pub_ids': pub_ids,
        'n_pubs': n_pubs
    }

    with open(output_file, 'wb') as f:
        pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)

    file_size = os.path.getsize(output_file) / 1024 / 1024
    print(f"\nSaved distance matrix to {output_file}")
    print(f"File size: {file_size:.2f} MB")

    return distances

def load_distance_matrix(filename: str = 'pub_distances.pkl') -> dict:
    """Load pre-computed distance matrix"""
    with open(filename, 'rb') as f:
        data = pickle.load(f)
    return data

if __name__ == '__main__':
    # Get paths from environment variables or use defaults
    data_file = os.getenv('DATA_FILE', 'data.json')
    distances_file = os.getenv('DISTANCES_FILE', 'pub_distances.pkl')
    osrm_url = os.getenv('OSRM_URL', 'http://localhost:5005')

    # Load pub data
    if not os.path.exists(data_file):
        print(f"Error: Data file not found: {data_file}")
        exit(1)

    with open(data_file, 'r') as f:
        pubs = json.load(f)

    pub_ids = [pub['id'] for pub in pubs]
    pub_coords = [(pub['longitude'], pub['latitude']) for pub in pubs]

    print(f"Loaded {len(pubs)} pubs from {data_file}")
    print(f"Output will be saved to: {distances_file}")
    print("Starting pre-computation...")
    print("Make sure OSRM server is running: docker-compose up -d")

    precompute_distance_matrix(pub_coords, pub_ids, distances_file, osrm_url)
