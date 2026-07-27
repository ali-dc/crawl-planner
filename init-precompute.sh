#!/bin/sh
# Run by entrypoint.sh with sh, so keep this POSIX - busybox does not expand
# bash brace ranges like {1..30}

# Wait for the app to be ready
echo "Waiting for app to be ready..."
i=1
ready=0
while [ "$i" -le 30 ]; do
  if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
    echo "App is ready!"
    ready=1
    break
  fi
  echo "Waiting... ($i/30)"
  i=$((i + 1))
  sleep 2
done

if [ "$ready" -eq 0 ]; then
  echo "App did not become ready in 60s; skipping precomputation check"
  exit 0
fi

# Use DISTANCES_FILE environment variable or default
DISTANCES_FILE="${DISTANCES_FILE:-/app/data/pub_distances.pkl}"

# Check if distance matrix exists
if [ ! -f "$DISTANCES_FILE" ]; then
  echo "Distance matrix not found at $DISTANCES_FILE. Triggering precomputation..."
  curl -X POST http://localhost:8000/api/precompute
else
  echo "Distance matrix already exists at $DISTANCES_FILE"
fi
