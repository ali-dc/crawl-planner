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

## Quick Start

**Fastest way to run the entire application:**

```bash
# Start all services with Docker
docker-compose up -d

# Application will be available at http://localhost:8000
# Check status: docker-compose logs -f app
```

**For local development without Docker:**

```bash
# Install dependencies
uv install

# Start OSRM server (requires Docker)
docker-compose up -d osrm

# Run the app
python app.py

# App will be at http://localhost:8000
```

## Development Commands

### FastAPI Server (Recommended)
```bash
# Start the API server (requires OSRM running via Docker)
python app.py

# Server runs on http://localhost:8000
# Web UI available at http://localhost:8000
# Interactive API docs available at http://localhost:8000/docs
# OpenAPI spec available at http://localhost:8000/openapi.json
```

### Type Checking & Linting
```bash
# Type check with mypy
mypy *.py

# Run tests with pytest
pytest

# Run a specific test
pytest tests/test_module.py::test_function -v
```

### Data Pipeline Scripts
```bash
# Parse raw data into structured format (creates data.json)
python parse.py

# Precompute distance matrix (requires OSRM running, creates pub_distances.pkl)
python precompute_distances.py
```

### API Utilities
```bash
# Trigger precomputation via API (POST /precompute)
curl -X POST http://localhost:8000/precompute

# Check API health
curl http://localhost:8000/health

# List available pubs
curl http://localhost:8000/pubs?skip=0&limit=10

# Plan a route (POST /plan with start, end, num_pubs, uniformity_weight)
curl -X POST http://localhost:8000/plan -H "Content-Type: application/json" \
  -d '{"start_point":{"longitude":-2.6,"latitude":51.4},"end_point":{"longitude":-2.5,"latitude":51.5},"num_pubs":5,"uniformity_weight":0.5}'
```

## External Dependencies

- **numpy**: Numerical operations on distance matrices
- **requests**: HTTP calls to OSRM
- **tqdm**: Progress bars during precomputation
- **fastapi**: Web framework for the API
- **uvicorn**: ASGI server to run FastAPI
- **pydantic**: Request/response validation and serialization

Install with: `uv install` (using uv package manager, as specified in pyproject.toml)

## Docker Setup

The entire application (FastAPI app + OSRM server) can be run in Docker using docker-compose:

```bash
# Start all services (OSRM + API)
docker-compose up -d

# The app is available at http://localhost:8000
# OSRM server runs on http://localhost:5005 (internal service)

# View logs
docker-compose logs -f app
docker-compose logs -f osrm

# Stop services
docker-compose down

# Rebuild the app image after code changes
docker-compose up -d --build app
```

### Service Details

- **osrm**: OSRM routing backend (port 5005, accessible for testing)
  - Routes requests for walking distance calculations
  - Listens on `http://0.0.0.0:5005` inside container
  - Auto-restarts on failure

- **app**: FastAPI application (port 8000, public)
  - Serves web UI and REST API
  - Listens on `http://0.0.0.0:8000`
  - Has healthcheck configured (checks `/health` endpoint)
  - Automatically restarts on crash or unhealthy status
  - Depends on osrm service (waits for osrm to start, but not health status)

### Data Persistence

Data files are mounted as volumes in docker-compose:
- `data.json`: Pub data (will be copied into container if it exists)
- `pub_distances.pkl`: Precomputed distance matrix (will be copied into container if it exists)
- `raw.data`: Raw pub data file (optional, for parsing)

If you need to regenerate data inside Docker, use the API endpoints:
- `POST /parse`: Parse raw data
- `POST /precompute`: Generate distance matrix

### OSRM Server (Local Development)

If running without Docker:

```bash
# Start OSRM server only
docker-compose up -d osrm

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

The FastAPI implementation (`app.py`) wraps the core planner logic with HTTP endpoints. The app initializes via a `PubCrawlPlannerApp` class that manages lifecycle, endpoints, and state.

### Global State Management
- `planner`: Singleton `PubCrawlPlanner` instance initialized on startup from `pub_distances.pkl`
- `pubs_data`: In-memory list of `PubModel` objects loaded from `data.json`
- `osrm_client`: Singleton `OSRMClient` for runtime distance queries and directions
- `precompute_in_progress`: Boolean flag to prevent concurrent precomputation requests

### API Endpoints

**Data & Planning**:
- `GET /health`: Check API status and OSRM availability
- `GET /pubs`: List all pubs (supports pagination with `skip` and `limit` query params)
- `GET /pubs/{pub_id}`: Get details for a specific pub
- `POST /plan`: Plan an optimized pub crawl route (main endpoint)
- `POST /directions`: Get turn-by-turn directions for a route
- `GET /status`: Check precomputation status

**Administration**:
- `POST /precompute`: Trigger distance matrix precomputation (long-running, returns job status)
- `POST /parse`: Parse raw pub data from `raw.data` into `data.json`

**Frontend**:
- `GET /`: Serve `index.html`
- `GET /styles.css`: Serve stylesheet
- `GET /app.js`: Serve frontend JavaScript
- `GET /static/*`: Serve static files (if directory exists)

### Request Lifecycle
1. Client sends POST to `/plan` with `PlanCrawlRequest` (start point, end point, num_pubs, uniformity_weight)
2. Pydantic models validate and parse the JSON request
3. Planner computes route using cached distance matrix and OSRM for start/end distances
4. Response includes route indices, pub details, distances, time estimates, and optional leg-by-leg directions
5. FastAPI serializes response to JSON with snake_case field names

### Coordinate Handling in API
- Clients send coordinates as `CoordinateModel` objects with `longitude` and `latitude` fields
- Stored as tuples in (longitude, latitude) order throughout for OSRM compatibility
- Directions include GeoJSON geometry for route visualization

## Code Style Notes

- Coordinates are consistently (longitude, latitude)
- The planner uses both pub indices (for matrix lookups) and 'start'/'end' markers for start/end points
- Distance values are in meters
- Time estimates assume ~80 meters/minute walking speed
- API responses use snake_case field names (Pydantic default)

## Important Implementation Details

### Distance Matrix Caching
The precomputed distance matrix (`pub_distances.pkl`) contains:
- `distances`: numpy float32 array of shape (n_pubs, n_pubs)
- `pub_coords`: List of (longitude, latitude) tuples for each pub
- `pub_ids`: List of pub ID strings matching the order of the matrix

This matrix is loaded at API startup. If it doesn't exist, the `/precompute` endpoint must be called first (requires OSRM running). The distance values are in meters.

### OSRM Integration Points
- **Precomputation**: Queries all pub-to-pub distances in batches (MAX_BATCH_SIZE=10)
- **Runtime**: Called for start→all_candidates and all_candidates→end distances
- **Directions**: Called to get turn-by-turn routing when `include_directions=true` in `/plan` request
- Coordinate order critical: Always (longitude, latitude) for OSRM endpoints

### Optimization Algorithm Selection
The route optimization strategy depends on the number of pubs:
- **k ≤ 8 pubs**: Full combinatorial search with sampling (1000 samples, 2-opt polish)
  - Finding global optima is feasible; explores distance + uniformity trade-off
- **k > 8 pubs**: Greedy selection with 2-opt improvement
  - Speed required; uses heuristic distance-to-pub + estimated-distance-to-end scoring

The threshold of 8 pubs balances exploration time with solution quality. Adjust in `planner.py:plan_crawl()` if needed.

### Pub Data Structure
Each pub (`PubModel`) has:
- `id`: Unique identifier (string)
- `name`: Display name
- `address`: Street address
- `longitude`, `latitude`: Coordinates for routing
- (optionally) `category`, `description`, etc. from raw data

The `data.json` file stores all pubs as a JSON array. Raw data parsing (`parse.py`) extracts only essential routing fields from obfuscated `raw.data`.

### Static Frontend
The API serves a web UI from the root path (`/`). The frontend consists of:
- `index.html`: Main HTML page
- `app.js`: Client-side route planning logic
- `styles.css`: Styling
- CORS is enabled (`*`) to allow development with separate frontend servers
