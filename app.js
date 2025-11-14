// Configuration
const API_URL = window.location.origin;
const BRISTOL_CENTER = [-2.5879, 51.4545]; // [lng, lat] for MapLibre

// Update mobile bottom bar status
function updateBarStatus() {
  if (window.innerWidth <= 768) {
    const barStatus = document.getElementById('barStatus');
    if (!state.startPoint) {
      barStatus.textContent = 'Select a start point';
    } else if (!state.endPoint) {
      barStatus.textContent = 'Select an end point';
    } else {
      barStatus.textContent = 'Ready to plan';
    }
  }
}

// Show bottom sheet
function showBottomSheet() {
  const bottomSheet = document.getElementById('bottomSheet');
  bottomSheet.classList.add('active');
}

// Hide bottom sheet
function hideBottomSheet() {
  const bottomSheet = document.getElementById('bottomSheet');
  bottomSheet.classList.remove('active', 'expanded');
}

// Handle bottom sheet dragging
function initBottomSheetDrag() {
  const bottomSheet = document.getElementById('bottomSheet');
  const handle = bottomSheet.querySelector('.bottom-sheet-handle');
  let isDragging = false;
  let startY = 0;
  let currentY = 0;

  handle.addEventListener('pointerdown', (e) => {
    if (window.innerWidth > 768) return;
    isDragging = true;
    startY = e.clientY;
    currentY = 0;
  });

  document.addEventListener('pointermove', (e) => {
    if (!isDragging || window.innerWidth > 768) return;

    currentY = e.clientY - startY;

    // Only allow dragging down
    if (currentY > 0) {
      bottomSheet.style.transform = `translateY(${currentY}px)`;
    }
  });

  document.addEventListener('pointerup', () => {
    if (!isDragging) return;
    isDragging = false;

    // If dragged down more than 80px, close it
    if (currentY > 80) {
      hideBottomSheet();
      bottomSheet.style.transform = '';
    } else {
      // Snap back to open position
      bottomSheet.style.transform = '';
    }
    currentY = 0;
  });
}

// Also allow dragging on the content area
function enableContentScroll() {
  const bottomSheet = document.getElementById('bottomSheet');
  const content = bottomSheet.querySelector('.bottom-sheet-content');

  let isScrolling = false;

  // Allow normal scrolling while sheet is open
  content.addEventListener('scroll', () => {
    isScrolling = true;
  });
}

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


function setStartPoint(coords) {
  state.startPoint = coords;
  updatePlanButton();
  updateBarStatus();

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
  updatePlanButton();
  updateBarStatus();

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

function updatePlanButton() {
  const buttonMobile = document.getElementById('planButtonMobile');
  const canPlan = state.startPoint && state.endPoint;
  buttonMobile.disabled = !canPlan;
}

async function planCrawl() {
  // Use mobile input if on mobile, otherwise use desktop input
  const numPubs = parseInt(document.getElementById('numPubsMobile').value);

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

  // Show sidebar on desktop when route is planned
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.remove('hidden');
  }

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

  // Desktop version
  document.getElementById('totalDistance').textContent = `${distance} km`;
  document.getElementById('totalTime').textContent = `${time} min`;

  // Mobile version
  document.getElementById('totalDistanceMobile').textContent = `${distance} km`;
  document.getElementById('totalTimeMobile').textContent = `${time} min`;

  const pubsList = document.getElementById('pubsList');
  const pubsListMobile = document.getElementById('pubsListMobile');
  pubsList.innerHTML = '';
  pubsListMobile.innerHTML = '';

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

    const pubHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
                <div class="pub-number">${index + 1}</div>
                <div style="flex: 1;">
                    <div class="pub-name">${pub.pub_name}</div>
                    ${legInfo}
                </div>
            </div>
        `;

    pubElement.innerHTML = pubHTML;
    pubsList.appendChild(pubElement);

    const pubElementMobile = document.createElement('div');
    pubElementMobile.className = 'pub-item';
    pubElementMobile.innerHTML = pubHTML;
    pubsListMobile.appendChild(pubElementMobile);
  });

  // Show results in sidebar and hide form on desktop
  if (window.innerWidth > 768) {
    document.getElementById('resultsSection').style.display = 'block';

    // Hide bottom bar on desktop (when results are shown in sidebar)
    document.querySelector('.mobile-bottom-bar').style.display = 'none';
  }

  document.getElementById('resultsSectionMobile').style.display = 'block';
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

  // Hide sidebar when route is cleared
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.add('hidden');
  }

  document.getElementById('numPubsMobile').value = '5';
  updatePlanButton();
  updateBarStatus();
  hideBottomSheet();
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('resultsSectionMobile').style.display = 'none';

  // Clear inline styles to let CSS media queries control bar visibility
  document.querySelector('.mobile-bottom-bar').style.display = '';

  hideMessages();
  state.selectingStart = true;
  state.selectingEnd = false;
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  const loadingMobile = document.getElementById('loadingMobile');
  if (show) {
    loading.classList.add('show');
    loadingMobile.classList.add('show');
    // Show bottom sheet when loading on mobile
    if (window.innerWidth <= 768) {
      showBottomSheet();
    }
  } else {
    loading.classList.remove('show');
    loadingMobile.classList.remove('show');
  }
}

function showMessage(message, type) {
  hideMessages();

  // Desktop messages
  const messageEl = type === 'error' ? document.getElementById('errorMessage') :
    type === 'success' ? document.getElementById('successMessage') :
      null;

  // Mobile messages
  const messageElMobile = type === 'error' ? document.getElementById('errorMessageMobile') :
    type === 'success' ? document.getElementById('successMessageMobile') :
      null;

  if (messageEl && type !== 'info') {
    messageEl.textContent = message;
    messageEl.classList.add('show');

    if (type === 'success') {
      setTimeout(() => messageEl.classList.remove('show'), 3000);
    }
  }

  if (messageElMobile && type !== 'info') {
    messageElMobile.textContent = message;
    messageElMobile.classList.add('show');

    if (type === 'success') {
      setTimeout(() => messageElMobile.classList.remove('show'), 3000);
    }
  }
}

function hideMessages() {
  document.getElementById('errorMessage').classList.remove('show');
  document.getElementById('successMessage').classList.remove('show');
  document.getElementById('errorMessageMobile').classList.remove('show');
  document.getElementById('successMessageMobile').classList.remove('show');
}

// Initialize displays
updatePlanButton();
updateBarStatus();

// Hide sidebar initially on desktop (it only shows when a route is planned)
if (window.innerWidth > 768) {
  document.getElementById('sidebar').classList.add('hidden');
}

// Handle window resize to properly show/hide bottom bar
function handleResize() {
  const mobileBar = document.querySelector('.mobile-bottom-bar');

  // Only set inline styles if we're overriding for a specific reason (after results)
  // Otherwise rely on CSS media queries
  if (!state.route) {
    // No route active, let CSS media queries control visibility
    mobileBar.style.display = '';
  }
}

window.addEventListener('resize', handleResize);

// Initialize bottom sheet drag handling
initBottomSheetDrag();
