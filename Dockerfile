FROM python:3.14-alpine
COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /uvx /bin/

WORKDIR /app

# Install curl for init-precompute script
RUN apk add --no-cache curl

# Copy backend pyproject.toml and install Python dependencies
COPY backend/pyproject.toml .
COPY backend/uv.lock .

RUN uv sync --locked

# Copy backend application code
COPY backend/app.py .
COPY backend/planner.py .
COPY backend/osrm_client.py .
COPY backend/api_schemas.py .
COPY backend/parse.py .
COPY backend/precompute_distances.py .
COPY backend/polyline_utils.py .
COPY backend/models.py .

# Copy entrypoint script
COPY entrypoint.sh .
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

# Run the application via entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
