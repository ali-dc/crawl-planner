#!/bin/bash

# Wait for the app to be ready
echo "Waiting for app to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
    echo "App is ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

# Use DISTANCES_FILE environment variable or default
DISTANCES_FILE="${DISTANCES_FILE:-/app/data/pub_distances.pkl}"

# Check if distance matrix exists
if [ ! -f "$DISTANCES_FILE" ]; then
  echo "Distance matrix not found at $DISTANCES_FILE. Triggering precomputation..."
  curl -X POST http://localhost:8000/api/precompute
else
  echo "Distance matrix already exists at $DISTANCES_FILE"
fi
