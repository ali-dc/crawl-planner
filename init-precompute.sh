#!/bin/bash

# Wait for the app to be ready
echo "Waiting for app to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "App is ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

# Check if distance matrix exists
if [ ! -f /app/pub_distances.pkl ]; then
  echo "Distance matrix not found. Triggering precomputation..."
  curl -X POST http://localhost:8000/precompute
else
  echo "Distance matrix already exists."
fi
