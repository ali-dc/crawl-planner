# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pub crawl route planner that optimizes paths through multiple pubs from a starting location to an ending location. It uses OSRM (Open Source Routing Machine) for walking distance calculations and employs optimization algorithms to find routes with good balance between distance efficiency and uniform spacing between stops.

## Architecture

### Data Pipeline

1. **Raw Data Parsing** (`parse.py`):
   - Loads raw pub data from `raw.data` (JSON format with obfuscated field names like `_18`, `_20`, etc.)
   - Extracts essential fields: pub ID, name, address, latitude, longitude
   - Outputs structured pub data to `data.json`
   - Run: `python parse.py`

2. **Distance Precomputation** (`precompute_distances.py`):
   - Loads pub coordinates from `data.json`
   - Queries OSRM's table endpoint to build an n×n distance matrix for all pubs
   - Uses batching (MAX_BATCH_SIZE=10) to handle OSRM's endpoint limits
   - Pickles the distance matrix and metadata to `pub_distances.pkl`
   - Run: `python precompute_distances.py` (requires OSRM server running)

3. **Route Planning** (`planner.py`):
   - Core `PubCrawlPlanner` class that operates on precomputed distances
   - Takes a start point, end point, number of pubs, and uniformity preference
   - Returns optimized routes with pub IDs, total distance, and estimated time

### Route Optimization Strategy

The planner uses a multi-phase approach:

1. **Candidate Selection**: Filters pubs that lie roughly along the corridor from start to end using:
   - `project_onto_line()`: Maps each pub's position onto the start-end line (0-1 scale)
   - `perpendicular_distance()`: Calculates deviation from the path
   - Scores pubs to favor those near the path

2. **Distance Precomputation**: Batch-fetches distances from start/end to all candidates using OSRM

3. **Route Optimization**:
   - **For k ≤ 8 pubs**: Uses sampling + 2-opt (`sample_and_optimize`)
     - Samples 1000 random combinations of k pubs
     - Applies nearest-neighbor ordering + 2-opt local optimization to each
     - Selects the best route
   - **For k > 8 pubs**: Uses greedy with 2-opt (`greedy_with_improvement`)
     - Greedily selects pubs based on distance-to-pub + estimated-distance-to-end
     - Applies 2-opt improvement afterward

4. **Evaluation**: Routes are scored as:
   - `total_distance + uniformity_weight * std_dev_of_segments`
   - Higher `uniformity_weight` (e.g., 0.99) favors evenly-spaced stops

### External Service Integration

**OSRM Client** (`osrm_client.py`):
- Wraps HTTP calls to a local OSRM server (default: `http://localhost:5005`)
- Key methods:
  - `get_distance_matrix()`: Batch query for multiple pairs (most efficient)
  - `get_distances_from_point()`: One-to-many distances
  - `get_distances_to_point()`: Many-to-one distances
  - `get_directions()`: Turn-by-turn navigation with geometry
- **Important**: All coordinates use (longitude, latitude) order, not (lat, lon)

### Data Formats

**Pub Coordinates**: Stored as (longitude, latitude) tuples throughout. This is critical for OSRM compatibility.

**Distance Matrix**: n×n numpy array (float32) indexed by pub indices. Entry `[i][j]` is walking distance in meters from pub i to pub j.

## Development Commands

### FastAPI Server (Recommended)
```bash
# Start the API server
python app.py

# Server runs on http://localhost:8000
# Interactive docs available at http://localhost:8000/docs
```

### CLI Scripts (Legacy)
```bash
# Parse raw data into structured format
python parse.py

# Precompute distance matrix (requires OSRM running)
python precompute_distances.py

# Run example pub crawl planning
python example.py
```

## External Dependencies

- **numpy**: Numerical operations on distance matrices
- **requests**: HTTP calls to OSRM
- **tqdm**: Progress bars during precomputation
- **fastapi**: Web framework for the API
- **uvicorn**: ASGI server to run FastAPI
- **pydantic**: Request/response validation and serialization

Install with: `uv install` (using uv package manager, as specified in pyproject.toml)

## OSRM Server Setup

The planner requires a running OSRM server for distance calculations:

```bash
# Start OSRM in Docker
docker-compose up -d

# Verify server is running
curl http://localhost:5005/route/v1/foot/-2.6,51.4;-2.5,51.4
```

OSRM data is included in the `osrm-data/` directory. The server must be running before precomputing distances or planning routes.

## Key Design Decisions

1. **Two-phase distance retrieval**:
   - Precomputed pub-to-pub matrix (fast, reusable)
   - Runtime OSRM calls for start/end to pubs (necessary because start/end can be arbitrary coordinates)

2. **Optimization threshold at 8 pubs**:
   - Below 8: Exhaustive sampling with local optimization is feasible
   - Above 8: Greedy approach with local polish is more practical

3. **Uniformity weighting**:
   - Optional parameter allows trading distance optimality for more even spacing
   - Useful for social crawls where consistent rest intervals matter

## API Architecture

The FastAPI implementation (`app.py`) wraps the core planner logic with HTTP endpoints:

### Global State Management
- `planner_instance`: Singleton PubCrawlPlanner initialized on startup
- `pubs_data`: In-memory list of pub dictionaries loaded from data.json
- `osrm_client`: Singleton OSRMClient for turn-by-turn directions

### Request Lifecycle
1. Client sends POST to `/plan` with planning parameters
2. Pydantic models validate and parse the JSON request
3. Planner computes route using cached distance matrix
4. Response includes route indices, pub details, and optionally directions
5. FastAPI serializes response to JSON

### Coordinate Handling in API
- Clients send coordinates as `CoordinateModel` objects with `longitude` and `latitude` fields
- Internally converted to (longitude, latitude) tuples for planner
- Directions include GeoJSON geometry for mapping

## Code Style Notes

- Coordinates are consistently (longitude, latitude)
- The planner uses both pub indices (for matrix lookups) and 'start'/'end' markers for start/end points
- Distance values are in meters
- Time estimates assume ~80 meters/minute walking speed
- API responses use snake_case field names (Pydantic default)
