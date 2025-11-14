# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend files
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.js ./
COPY frontend/.eslintrc.cjs ./

# Build the frontend
RUN npm run build

# Python app stage
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

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

# Copy built frontend from builder stage
COPY --from=frontend-builder /frontend/dist ./frontend/dist

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)"

# Run the application
CMD ["uv", "run", "app.py"]
