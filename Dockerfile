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

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)"

# Run the application
CMD ["uv", "run", "app.py"]
