#!/bin/bash

# Create data directory
mkdir -p osrm-data
cd osrm-data

# Download map data (change URL for your region)
# Find your region at: https://download.geofabrik.de/
echo "Downloading map data..."
wget https://download.geofabrik.de/europe/bristol-latest.osm.pbf

# Extract (using foot profile for walking)
echo "Extracting map data (this may take 10-60 minutes)..."
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/foot.lua /data/bristol-latest.osm.pbf

# Partition
echo "Partitioning..."
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/bristol-latest.osrm

# Customize
echo "Customizing..."
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/bristol-latest.osrm

cd ..

echo "Done! You can now start the OSRM server with: docker-compose up -d"
