# FastAPI Pub Crawl Planner - Quick Start

## Prerequisites

- Python 3.14+
- OSRM server running (via Docker)
- Dependencies installed: `uv install`

## Starting the API

### 1. Start OSRM Server
```bash
docker-compose up -d
```

### 2. Start the API Server
```bash
python app.py
```

The API will start on `http://localhost:8000`

View interactive docs at: `http://localhost:8000/docs`

## Common Workflows

### First Time Setup: Parse Raw Data

```bash
curl -X POST http://localhost:8000/parse
```

Response:
```json
{
  "status": "success",
  "message": "Parsed 123 pubs",
  "pubs_count": 123
}
```

### Precompute Distance Matrix

This step is required before planning routes. It fetches distances between all pubs from OSRM.

```bash
curl -X POST http://localhost:8000/precompute
```

This may take several minutes depending on the number of pubs. Monitor progress at `/status`:

```bash
curl http://localhost:8000/status
```

### Plan a Pub Crawl

```bash
curl -X POST http://localhost:8000/plan \
  -H "Content-Type: application/json" \
  -d '{
    "start_point": {"longitude": -2.6061406, "latitude": 51.4335666},
    "end_point": {"longitude": -2.5818437, "latitude": 51.4730697},
    "num_pubs": 5,
    "uniformity_weight": 0.5
  }'
```

### Get Directions for a Route

Add `?include_directions=true` to the `/plan` endpoint:

```bash
curl -X POST http://localhost:8000/plan?include_directions=true \
  -H "Content-Type: application/json" \
  -d '{
    "start_point": {"longitude": -2.6061406, "latitude": 51.4335666},
    "end_point": {"longitude": -2.5818437, "latitude": 51.4730697},
    "num_pubs": 5,
    "uniformity_weight": 0.5
  }'
```

Or separately using `/directions`:

```bash
curl -X POST http://localhost:8000/directions \
  -H "Content-Type: application/json" \
  -d '{
    "route_indices": ["start", 5, 12, 8, "end"],
    "start_point": {"longitude": -2.6061406, "latitude": 51.4335666},
    "end_point": {"longitude": -2.5818437, "latitude": 51.4730697}
  }'
```

## API Endpoints

### Planning
- `POST /plan` - Plan a pub crawl route
- `POST /directions` - Get turn-by-turn directions for a route
- `GET /pubs` - List all pubs (supports pagination: `?skip=0&limit=100`)
- `GET /pubs/{pub_id}` - Get details for a specific pub

### Management
- `POST /parse` - Parse raw.data and save to data.json
- `POST /precompute` - Precompute distance matrix from all pubs
- `GET /status` - Get precomputation status
- `GET /health` - Check API and OSRM server health

## Interactive Documentation

Visit `http://localhost:8000/docs` for an interactive Swagger UI where you can test all endpoints in your browser.

## Python Client Example

```python
import requests

BASE_URL = "http://localhost:8000"

# Check health
response = requests.get(f"{BASE_URL}/health")
print(response.json())

# List pubs
response = requests.get(f"{BASE_URL}/pubs?limit=10")
pubs = response.json()
print(f"Found {len(pubs)} pubs")

# Plan a crawl
plan_request = {
    "start_point": {"longitude": -2.6061406, "latitude": 51.4335666},
    "end_point": {"longitude": -2.5818437, "latitude": 51.4730697},
    "num_pubs": 5,
    "uniformity_weight": 0.5
}

response = requests.post(f"{BASE_URL}/plan?include_directions=true", json=plan_request)
route = response.json()
print(f"Route distance: {route['total_distance_meters']} meters")
print(f"Estimated time: {route['estimated_time_minutes']} minutes")
print(f"Pubs in route: {[p['pub_name'] for p in route['pubs']]}")
```

## Troubleshooting

### "Distance matrix not loaded" error
Run `/precompute` endpoint first.

### "OSRM server not available" error
Make sure Docker is running and OSRM container is up:
```bash
docker-compose up -d
docker ps  # Verify osrm-backend container is running
```

### Precomputation times out
For large numbers of pubs, consider using async processing. Currently, precomputation runs synchronously, which may be slow. Future improvements could use Celery.

## Performance Notes

- First request to `/plan` may be slow as OSRM caches are warmed up
- Precomputation is I/O bound (limited by OSRM server response times)
- Large distance matrices (500+ pubs) may consume significant memory
