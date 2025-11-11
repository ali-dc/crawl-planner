// Configuration
const API_URL = window.location.origin;
const BRISTOL_CENTER = [-2.5879, 51.4545]; // [lng, lat] for MapLibre

// State
let state = {
  startPoint: null,
  endPoint: null,
  selectingStart: true,
  selectingEnd: false,
  route: null,
  markers: {
    start: null,
    end: null,
    pubs: []
  },
  popups: {
    start: null,
    end: null,
    pubs: []
  },
  routePolylines: []
};

// Initialize MapLibre map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  center: BRISTOL_CENTER,
  zoom: 13
});

const makePopup = () => new maplibregl.Popup({ closeButton: false, offset: 25 });

// Map click handler
map.on('click', function (e) {
  const { lng, lat } = e.lngLat;

  if (state.selectingStart) {
    setStartPoint([lng, lat]);
    state.selectingStart = false;
    state.selectingEnd = true;
    showMessage('Start location selected', 'success');
  } else if (state.selectingEnd) {
    setEndPoint([lng, lat]);
    state.selectingEnd = false;
    showMessage('End location selected', 'success');
  }
});

function selectStartLocation() {
  state.selectingStart = true;
  showMessage('Click on the map to select the starting location', 'info');
}

function selectEndLocation() {
  state.selectingEnd = true;
  showMessage('Click on the map to select the ending location', 'info');
}

function setStartPoint(coords) {
  state.startPoint = coords;
  updateStartDisplay();
  updatePlanButton();

  // Remove existing start marker if present
  if (state.markers.start) {
    state.markers.start.remove();
  }
  if (state.popups.start) {
    state.popups.start.remove();
  }

  // Create start marker element
  const startEl = document.createElement('div');
  startEl.style.cssText = `
        width: 32px;
        height: 32px;
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjMjJjNTVlIiBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJjMCA0LjQxIDMuMDUgOC4xNCA3IDkuNzdWMjJoMnYtMi4yM2MzLjk1LTEuNjMgNy01LjM2IDctOS43N0MyMiA2LjQ4IDE3LjUyIDIgMTIgMnptMCA4Yy0yLjIxIDAtNCAyLjE5LTQgNHMyLjc5IDQgNCA0IDQtMS43OSA0LTQtMS43OS00LTQtNHoiLz48L3N2Zz4=');
        background-size: contain;
        cursor: pointer;
    `;

  state.markers.start = new maplibregl.Marker({ element: startEl })
    .setLngLat(coords)
    .addTo(map);

  // Add popup
  const popup = makePopup().setHTML('<strong>Start</strong>');
  state.popups.start = popup;
  state.markers.start.setPopup(popup);
}

function setEndPoint(coords) {
  state.endPoint = coords;
  updateEndDisplay();
  updatePlanButton();

  // Remove existing end marker if present
  if (state.markers.end) {
    state.markers.end.remove();
  }
  if (state.popups.end) {
    state.popups.end.remove();
  }

  // Create end marker element
  const endEl = document.createElement('div');
  endEl.style.cssText = `
        width: 32px;
        height: 32px;
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjZjA1YzJmIiBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJjMCA0LjQxIDMuMDUgOC4xNCA3IDkuNzdWMjJoMnYtMi4yM2MzLjk1LTEuNjMgNy01LjM2IDctOS43N0MyMiA2LjQ4IDE3LjUyIDIgMTIgMnptMCA4Yy0yLjIxIDAtNCAyLjE5LTQgNHMyLjc5IDQgNCA0IDQtMS43OSA0LTQtMS43OS00LTQtNHoiLz48L3N2Zz4=');
        background-size: contain;
        cursor: pointer;
    `;

  state.markers.end = new maplibregl.Marker({ element: endEl })
    .setLngLat(coords)
    .addTo(map);

  // Add popup
  const popup = makePopup().setHTML('<strong>End</strong>');
  state.popups.end = popup;
  state.markers.end.setPopup(popup);
}

function updateStartDisplay() {
  const display = document.getElementById('startDisplay');
  if (state.startPoint) {
    display.textContent = `${state.startPoint[0].toFixed(4)}, ${state.startPoint[1].toFixed(4)}`;
    display.classList.remove('empty');
  } else {
    display.textContent = 'Click the map to select a start location';
    display.classList.add('empty');
  }
}

function updateEndDisplay() {
  const display = document.getElementById('endDisplay');
  if (state.endPoint) {
    display.textContent = `${state.endPoint[0].toFixed(4)}, ${state.endPoint[1].toFixed(4)}`;
    display.classList.remove('empty');
  } else {
    display.textContent = 'Click the map to select an end location';
    display.classList.add('empty');
  }
}

function updatePubCount() {
  const count = document.getElementById('numPubs').value;
  document.getElementById('pubCount').textContent = count;
}

function updatePlanButton() {
  const button = document.getElementById('planButton');
  const canPlan = state.startPoint && state.endPoint;
  button.disabled = !canPlan;
}

async function planCrawl() {
  const numPubs = parseInt(document.getElementById('numPubs').value);

  if (!state.startPoint || !state.endPoint) {
    showMessage('Please select both start and end locations', 'error');
    return;
  }

  showLoading(true);
  hideMessages();

  try {
    const response = await fetch(`${API_URL}/plan?include_directions=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_point: {
          longitude: state.startPoint[0],
          latitude: state.startPoint[1]
        },
        end_point: {
          longitude: state.endPoint[0],
          latitude: state.endPoint[1]
        },
        num_pubs: numPubs,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to plan route');
    }

    const data = await response.json();
    displayRoute(data);
    showMessage('Route planned successfully!', 'success');

  } catch (error) {
    console.error('Error:', error);
    showMessage(`Error: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function drawRoutePolylines(data) {
  // Clear existing polylines - store both layer and source IDs
  state.routePolylines.forEach(({ layerId, sourceId }) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });
  state.routePolylines = [];

  if (!data.legs || data.legs.length === 0) {
    return;
  }

  // Define colors for legs - gradient from blue to purple
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f43f5e', // rose
    '#f97316', // orange
  ];

  // Draw each leg
  data.legs.forEach((leg, legIndex) => {
    if (!leg.geometry) {
      return;
    }

    const layerId = `route-leg-${legIndex}`;
    const sourceId = `route-source-${legIndex}`;

    // Add source
    map.addSource(sourceId, {
      type: 'geojson',
      data: leg.geometry
    });

    // Add layer
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': colors[legIndex % colors.length],
        'line-width': 3,
        'line-opacity': 0.8
      }
    });

    state.routePolylines.push({ layerId, sourceId });
  });
}

function displayRoute(data) {
  state.route = data;

  // Draw route polylines first (so they appear under markers)
  drawRoutePolylines(data);

  // Clear existing pub markers
  state.markers.pubs.forEach(marker => marker.remove());
  state.markers.pubs = [];
  state.popups.pubs.forEach(popup => popup.remove());
  state.popups.pubs = [];

  // Add pub markers
  data.pubs.forEach((pub, index) => {
    // Create marker element
    const pubEl = document.createElement('div');
    pubEl.style.cssText = `
            width: 32px;
            height: 32px;
            background: #667eea;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `;
    pubEl.textContent = index + 1;

    const marker = new maplibregl.Marker({ element: pubEl })
      .setLngLat([pub.longitude, pub.latitude])
      .addTo(map);

    // Add popup
    const popup = makePopup().setHTML(`<strong>${pub.pub_name}</strong>`);
    marker.setPopup(popup);

    state.markers.pubs.push(marker);
    state.popups.pubs.push(popup);
  });

  // Fit map to bounds
  const coordinates = [
    state.startPoint,
    state.endPoint,
    ...data.pubs.map(pub => [pub.longitude, pub.latitude])
  ];

  if (coordinates.length > 0) {
    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

    map.fitBounds(bounds, { padding: 50 });
  }

  // Display results
  displayResults(data);
}

function displayResults(data) {
  const distance = (data.total_distance_meters / 1000).toFixed(2);
  const time = Math.round(data.estimated_time_minutes);

  document.getElementById('totalDistance').textContent = `${distance} km`;
  document.getElementById('totalTime').textContent = `${time} min`;

  const pubsList = document.getElementById('pubsList');
  pubsList.innerHTML = '';

  data.pubs.forEach((pub, index) => {
    const pubElement = document.createElement('div');
    pubElement.className = 'pub-item';

    // Get the corresponding leg for this pub (leg index is pub index + 1 because leg 0 is start->pub0)
    let legInfo = '';
    if (data.legs && data.legs[index + 1]) {
      const leg = data.legs[index + 1];
      const legDistance = (leg.distance_meters / 1000).toFixed(2);
      const legTime = Math.round(leg.duration_seconds / 60);
      legInfo = `<div class="leg-info">${legDistance} km • ${legTime} min</div>`;
    }

    pubElement.innerHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
                <div class="pub-number">${index + 1}</div>
                <div style="flex: 1;">
                    <div class="pub-name">${pub.pub_name}</div>
                    ${legInfo}
                </div>
            </div>
        `;
    pubsList.appendChild(pubElement);
  });

  // Display directions
  displayDirections(data);

  document.getElementById('resultsSection').style.display = 'block';
}

function getRoutePointLabel(data, legIndex) {
  // legIndex is the position in the leg sequence
  // We need to map it back to the actual route_indices
  if (!data.route_indices || legIndex >= data.route_indices.length) {
    return 'Unknown';
  }

  const routeIndex = data.route_indices[legIndex];

  if (routeIndex === 'start') {
    return 'Start';
  } else if (routeIndex === 'end') {
    return 'End';
  } else if (typeof routeIndex === 'number') {
    // routeIndex is a pub index - find it in the pubs array
    const pub = data.pubs.find(p => p.index === routeIndex);
    if (pub) {
      return `Pub ${routeIndex + 1}: ${pub.pub_name}`;
    }
    return `Pub ${routeIndex + 1}`;
  }

  return 'Unknown';
}

function displayDirections(data) {
  const directionsList = document.getElementById('directionsList');
  directionsList.innerHTML = '';

  if (!data.legs || data.legs.length === 0) {
    directionsList.innerHTML = '<p style="padding: 12px; color: #999;">No directions available</p>';
    return;
  }

  data.legs.forEach((leg, legIndex) => {
    // For each leg, fromLabel is at route_indices[legIndex] and toLabel is at route_indices[legIndex+1]
    const fromLabel = getRoutePointLabel(data, legIndex);
    const toLabel = getRoutePointLabel(data, legIndex + 1);
    const distance = (leg.distance_meters / 1000).toFixed(2);
    const time = Math.round(leg.duration_seconds / 60);

    const legElement = document.createElement('div');
    legElement.className = 'direction-leg';
    legElement.dataset.legIndex = legIndex;
    legElement.onclick = () => toggleLegDetails(legIndex);

    let stepsHtml = '';
    if (leg.steps && leg.steps.length > 0) {
      stepsHtml = '<div class="direction-steps">';
      leg.steps.slice(0, 5).forEach(step => {
        const instruction = step.name || step.instruction || 'Continue';
        stepsHtml += `<div class="step">${instruction}</div>`;
      });
      if (leg.steps.length > 5) {
        stepsHtml += `<div class="step" style="color: #999; font-style: italic;">... and ${leg.steps.length - 5} more steps</div>`;
      }
      stepsHtml += '</div>';
    }

    legElement.innerHTML = `
      <div class="leg-header">
        <div class="leg-from-to">${fromLabel} → ${toLabel}</div>
        <div class="leg-meta">
          <div class="leg-distance">📏 ${distance} km</div>
          <div class="leg-time">⏱️ ${time} min</div>
        </div>
      </div>
      ${stepsHtml}
    `;

    // Add hover handlers to highlight route on map
    legElement.addEventListener('mouseenter', () => {
      highlightRouteLeg(legIndex);
    });

    legElement.addEventListener('mouseleave', () => {
      unhighlightRouteLeg(legIndex);
    });

    directionsList.appendChild(legElement);
  });

  // Show the container and update button
  document.getElementById('directionsContainer').style.display = 'block';
  document.getElementById('directionsToggle').textContent = 'Hide Directions';
  document.getElementById('directionsToggle').dataset.expanded = 'true';
}

function toggleDirections() {
  const container = document.getElementById('directionsContainer');
  const button = document.getElementById('directionsToggle');

  if (container.style.display === 'none') {
    container.style.display = 'block';
    button.textContent = 'Hide Directions';
    button.dataset.expanded = 'true';
  } else {
    container.style.display = 'none';
    button.textContent = 'Show Directions';
    button.dataset.expanded = 'false';
  }
}

function toggleLegDetails(legIndex) {
  const legElement = document.querySelector(`[data-leg-index="${legIndex}"]`);
  legElement.classList.toggle('active');
}

function highlightRouteLeg(legIndex) {
  const layerId = `route-leg-${legIndex}`;
  if (map.getLayer(layerId)) {
    // Highlight by increasing opacity and width
    map.setPaintProperty(layerId, 'line-width', 5);
    map.setPaintProperty(layerId, 'line-opacity', 1);
  }
}

function unhighlightRouteLeg(legIndex) {
  const layerId = `route-leg-${legIndex}`;
  if (map.getLayer(layerId)) {
    // Reset to normal width and opacity
    map.setPaintProperty(layerId, 'line-width', 3);
    map.setPaintProperty(layerId, 'line-opacity', 0.8);
  }
}

function clearForm() {
  state.startPoint = null;
  state.endPoint = null;
  state.route = null;

  if (state.markers.start) state.markers.start.remove();
  if (state.markers.end) state.markers.end.remove();
  if (state.popups.start) state.popups.start.remove();
  if (state.popups.end) state.popups.end.remove();
  state.markers.start = null;
  state.markers.end = null;
  state.popups.start = null;
  state.popups.end = null;

  state.markers.pubs.forEach(marker => marker.remove());
  state.popups.pubs.forEach(popup => popup.remove());
  state.markers.pubs = [];
  state.popups.pubs = [];

  // Clear route polylines
  state.routePolylines.forEach(({ layerId, sourceId }) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });
  state.routePolylines = [];

  document.getElementById('numPubs').value = '5';
  updatePubCount();
  updateStartDisplay();
  updateEndDisplay();
  updatePlanButton();

  document.getElementById('resultsSection').style.display = 'none';
  hideMessages();
  state.selectingStart = true;
  state.selectingEnd = false;
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (show) {
    loading.classList.add('show');
  } else {
    loading.classList.remove('show');
  }
}

function showMessage(message, type) {
  hideMessages();
  const messageEl = type === 'error' ? document.getElementById('errorMessage') :
    type === 'success' ? document.getElementById('successMessage') :
      null;

  if (messageEl && type !== 'info') {
    messageEl.textContent = message;
    messageEl.classList.add('show');

    if (type === 'success') {
      setTimeout(() => messageEl.classList.remove('show'), 3000);
    }
  }
}

function hideMessages() {
  document.getElementById('errorMessage').classList.remove('show');
  document.getElementById('successMessage').classList.remove('show');
}

// Initialize displays
updateStartDisplay();
updateEndDisplay();
updatePlanButton();
