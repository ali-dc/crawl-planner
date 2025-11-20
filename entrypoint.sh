#!/bin/sh
# Entrypoint script for the pub crawl planner app
# Handles proper signal propagation for graceful shutdown

set -e

# Trap SIGTERM and SIGINT to gracefully shut down
trap_handler() {
  echo "Received shutdown signal, terminating app..."
  if [ -n "$APP_PID" ]; then
    kill -TERM "$APP_PID" 2>/dev/null || true
    # Wait for the app to exit gracefully
    wait "$APP_PID" 2>/dev/null || true
  fi
  exit 0
}

trap trap_handler SIGTERM SIGINT

# Start the FastAPI app in the background
echo "Starting FastAPI app..."
uv run app.py &
APP_PID=$!

# Give the app a moment to start
sleep 2

# Run the precomputation initialization script
echo "Running precomputation initialization..."
sh /init-precompute.sh

# Wait for the app process to exit (on shutdown)
echo "Initialization complete, waiting for app..."
wait "$APP_PID"
