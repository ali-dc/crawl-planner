FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*
#
# Copy pyproject.toml and install Python dependencies
COPY pyproject.toml .
COPY uv.lock .

RUN uv sync --locked

# Copy application code
COPY app.py .
COPY planner.py .
COPY osrm_client.py .
COPY api_schemas.py .
COPY parse.py .
COPY precompute_distances.py .

COPY index.html .
COPY styles.css .
COPY app.js .

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)"

# Run the application
CMD ["uv", "run", "app.py"]
