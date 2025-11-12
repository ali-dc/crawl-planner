FROM python:3.14-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml and install Python dependencies
COPY pyproject.toml .

# Install runtime dependencies using pip directly
RUN pip install --no-cache-dir \
    numpy>=2.3.4 \
    requests>=2.32.5 \
    tqdm>=4.66.1 \
    fastapi>=0.104.0 \
    uvicorn[standard]>=0.24.0 \
    pydantic>=2.0.0 \
    python-dotenv>=1.0.0

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

# Copy data files (optional - they can be mounted as volumes or generated at runtime)
COPY data.json* ./
COPY pub_distances.pkl* ./
COPY raw.data* ./

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)"

# Run the application
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
