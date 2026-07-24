/* ==========================================================================
   WHEELO - Native Google Maps JavaScript API (google.maps) Engine & Real Geocoding
   ========================================================================== */

const WheeloMap = (function () {
  let map = null;
  let pickupMarker = null;
  let stopMarker = null;
  let dropMarker = null;
  let routePolyline = null;
  let driverMarker = null;
  let roamingDriverMarkers = [];
  let gpsUserMarker = null;

  const GOOGLE_DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#06221A" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#00E676" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#03140F" }] },
    { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#00E676" }] },
    { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#00E676" }] },
    { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#0D3E30" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#03120E" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#0A2D23" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#A7F3D0" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#0E3E30" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6EE7B7" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#00E676" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#03120E" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#FFFFFF" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#A7F3D0" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#0A2D23" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#0F382B" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#02100C" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#00E676" }] }
  ];

  const LANDMARKS = [
    { id: 'mg_road', name: 'MG Road Metro Station', lat: 12.9756, lng: 77.6066, category: 'Metro' },
    { id: 'indiranagar', name: 'Indiranagar 100ft Road', lat: 12.9784, lng: 77.6408, category: 'Food Hub' },
    { id: 'airport', name: 'Kempegowda Intl Airport', lat: 13.1986, lng: 77.7066, category: 'Airport' },
    { id: 'manyata', name: 'Manyata Tech Park', lat: 13.0457, lng: 77.6200, category: 'Tech Park' },
    { id: 'forum_mall', name: 'Forum South Mall', lat: 12.8845, lng: 77.5645, category: 'Shopping' },
    { id: 'railway', name: 'KSR City Railway Station', lat: 12.9781, lng: 77.5697, category: 'Transit' },
    { id: 'koramangala', name: 'Koramangala Sony Signal', lat: 12.9348, lng: 77.6245, category: 'Hotspot' }
  ];

  let currentPickup = { lat: 12.9756, lng: 77.6066, address: 'MG Road Metro Station' };
  let currentIntermediateStop = null;
  let currentDrop = { lat: 12.9784, lng: 77.6408, address: 'Indiranagar 100ft Road' };

  // Real Address Search & Geocoding using OpenStreetMap Nominatim API
  async function searchRealPlaces(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map(item => ({
        name: item.display_name.split(',')[0],
        fullAddress: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
    } catch (e) {
      console.warn('Geocoding search warning:', e);
      return [];
    }
  }

  // Geocode address string on Enter press
  async function geocodeAddress(addressString, type = 'drop') {
    const results = await searchRealPlaces(addressString);
    if (results && results.length > 0) {
      const match = results[0];
      if (type === 'drop') {
        setDropLocation(match.lat, match.lng, match.fullAddress);
      } else if (type === 'stop') {
        setIntermediateStop(match.lat, match.lng, match.fullAddress);
      } else {
        setPickupLocation(match.lat, match.lng, match.fullAddress);
      }
      return match;
    }
    return null;
  }

  function createSvgIcon(color, text = 'P') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <path fill="${color}" stroke="#FFFFFF" stroke-width="2" d="M17 0C7.6 0 0 7.6 0 17c0 12.8 17 25 17 25s17-12.2 17-25C34 7.6 26.4 0 17 0z"/>
      <circle cx="17" cy="15" r="7" fill="#FFFFFF"/>
      <text x="17" y="19" font-size="11" font-weight="bold" fill="${color}" text-anchor="middle">${text}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function createVehicleSvgIcon(vehicleType = 'bike') {
    const color = '#FFD100';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#121826" stroke="${color}" stroke-width="3"/>
      <circle cx="20" cy="20" r="8" fill="${color}"/>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  let isLeafletMode = false;
  let leafletMap = null;
  let leafletPickupMarker = null;
  let leafletDropMarker = null;
  let leafletRoutePolyline = null;

  function fallbackToLeafletMap(containerId = 'map') {
    if (isLeafletMode && leafletMap) return;
    isLeafletMode = true;
    console.log('🔄 Initializing Leaflet + OpenStreetMap Interactive Engine (Zero Key Required)...');

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (typeof L === 'undefined') {
      console.warn('Leaflet JS library not loaded');
      return;
    }

    leafletMap = L.map(containerId, { zoomControl: false }).setView([currentPickup.lat, currentPickup.lng], 14);

    // Dark Matter tile layer matching Metallic Green theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap);

    L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

    leafletMap.on('click', function (e) {
      const lat = parseFloat(e.latlng.lat.toFixed(4));
      const lng = parseFloat(e.latlng.lng.toFixed(4));
      const customAddr = `Selected Location (${lat}, ${lng})`;

      if (window.WheeloApp && window.WheeloApp.getMapSelectMode() === 'stop') {
        setIntermediateStop(lat, lng, customAddr);
      } else if (window.WheeloApp && window.WheeloApp.getMapSelectMode() === 'drop') {
        setDropLocation(lat, lng, customAddr);
      } else {
        setPickupLocation(lat, lng, customAddr);
      }
      if (window.WheeloApp) window.WheeloApp.onLocationUpdated();
    });

    updatePickupMarker();
    updateDropMarker();
    calculateAndDrawRoute();
  }

  // Handle Google Maps API key authentication failure gracefully
  window.gm_authFailure = function () {
    console.warn('[Map Engine] Google Maps authentication key failure detected. Switching to Leaflet OpenStreetMap Engine...');
    fallbackToLeafletMap();
  };

  function initMap(containerId = 'map') {
    if (map || leafletMap) return;

    if (typeof google === 'undefined' || !google.maps) {
      console.warn('Google Maps API missing or pending, initializing Leaflet engine fallback...');
      fallbackToLeafletMap(containerId);
      return;
    }

    try {
      const mapOptions = {
        center: { lat: currentPickup.lat, lng: currentPickup.lng },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        styles: GOOGLE_DARK_STYLE
      };

      map = new google.maps.Map(document.getElementById(containerId), mapOptions);

      map.addListener('click', function (e) {
        const lat = parseFloat(e.latLng.lat().toFixed(4));
        const lng = parseFloat(e.latLng.lng().toFixed(4));
        const customAddr = `Selected Location (${lat}, ${lng})`;

        if (window.WheeloApp && window.WheeloApp.getMapSelectMode() === 'stop') {
          setIntermediateStop(lat, lng, customAddr);
        } else if (window.WheeloApp && window.WheeloApp.getMapSelectMode() === 'drop') {
          setDropLocation(lat, lng, customAddr);
        } else {
          setPickupLocation(lat, lng, customAddr);
        }
        if (window.WheeloApp) window.WheeloApp.onLocationUpdated();
      });

      locateUserGPS(false);
      updatePickupMarker();
      updateDropMarker();
      spawnNearbyDrivers();
      calculateAndDrawRoute();
    } catch (err) {
      console.warn('Google Maps initialization caught error:', err);
      fallbackToLeafletMap(containerId);
    }
  }

  function switchMapLayer(layerName) {
    if (!map) return;
    if (layerName === 'googleRoadmap') {
      map.setOptions({ styles: [] });
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    } else if (layerName === 'googleSatellite') {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
    } else if (layerName === 'googleTraffic') {
      map.setOptions({ styles: [] });
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    } else {
      map.setOptions({ styles: GOOGLE_DARK_STYLE });
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    }
  }

  function openInGoogleMapsApp() {
    const p = currentPickup;
    const d = currentDrop;
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${p.lat},${p.lng}&destination=${d.lat},${d.lng}&travelmode=driving`;
    window.open(gmapsUrl, '_blank');
  }

  function locateUserGPS(userInitiated = true) {
    if (!navigator.geolocation) {
      if (userInitiated) alert('Browser does not support Geolocation');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(4));
        const lng = parseFloat(position.coords.longitude.toFixed(4));
        const gpsAddr = `Current GPS Location (${lat}, ${lng})`;

        setPickupLocation(lat, lng, gpsAddr);

        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(16);
        }

        updateGPSMarker(lat, lng);

        const pickupInput = document.getElementById('input-pickup');
        if (pickupInput) pickupInput.value = gpsAddr;

        if (window.WheeloApp) window.WheeloApp.onLocationUpdated();
      },
      (error) => {
        console.warn('GPS location request failed:', error.message);
        if (userInitiated) {
          alert(`GPS Location permission denied or unavailable.`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function updateGPSMarker(lat, lng) {
    if (!map) return;
    if (gpsUserMarker) gpsUserMarker.setMap(null);

    const blueDotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#00F0FF" stroke="#FFFFFF" stroke-width="3"/>
    </svg>`;

    gpsUserMarker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
      icon: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(blueDotSvg),
      title: 'Your GPS Position'
    });
  }

  function setPickupLocation(lat, lng, address) {
    currentPickup = { lat, lng, address };
    updatePickupMarker();
    spawnNearbyDrivers();
    calculateAndDrawRoute();
  }

  function setIntermediateStop(lat, lng, address) {
    if (lat === null) {
      currentIntermediateStop = null;
      if (stopMarker) stopMarker.setMap(null);
    } else {
      currentIntermediateStop = { lat, lng, address };
      updateStopMarker();
    }
    calculateAndDrawRoute();
  }

  function setDropLocation(lat, lng, address) {
    currentDrop = { lat, lng, address };
    updateDropMarker();
    calculateAndDrawRoute();
  }

  function updatePickupMarker() {
    if (isLeafletMode && leafletMap) {
      if (leafletPickupMarker) leafletMap.removeLayer(leafletPickupMarker);
      leafletPickupMarker = L.marker([currentPickup.lat, currentPickup.lng], {
        title: 'Pickup: ' + currentPickup.address
      }).addTo(leafletMap);
      return;
    }
    if (!map) return;
    if (pickupMarker) pickupMarker.setMap(null);

    pickupMarker = new google.maps.Marker({
      position: { lat: currentPickup.lat, lng: currentPickup.lng },
      map: map,
      icon: createSvgIcon('#00E676', 'A'),
      title: 'Pickup: ' + currentPickup.address
    });
  }

  function updateStopMarker() {
    if (isLeafletMode && leafletMap && currentIntermediateStop) {
      L.marker([currentIntermediateStop.lat, currentIntermediateStop.lng], { title: 'Stop: ' + currentIntermediateStop.address }).addTo(leafletMap);
      return;
    }
    if (!map || !currentIntermediateStop) return;
    if (stopMarker) stopMarker.setMap(null);

    stopMarker = new google.maps.Marker({
      position: { lat: currentIntermediateStop.lat, lng: currentIntermediateStop.lng },
      map: map,
      icon: createSvgIcon('#F59E0B', '+'),
      title: 'Stop: ' + currentIntermediateStop.address
    });
  }

  function updateDropMarker() {
    if (isLeafletMode && leafletMap) {
      if (leafletDropMarker) leafletMap.removeLayer(leafletDropMarker);
      leafletDropMarker = L.marker([currentDrop.lat, currentDrop.lng], {
        title: 'Drop: ' + currentDrop.address
      }).addTo(leafletMap);
      return;
    }
    if (!map) return;
    if (dropMarker) dropMarker.setMap(null);

    dropMarker = new google.maps.Marker({
      position: { lat: currentDrop.lat, lng: currentDrop.lng },
      map: map,
      icon: createSvgIcon('#FFFFFF', 'B'),
      title: 'Drop: ' + currentDrop.address
    });
  }

  function calculateAndDrawRoute() {
    if (!currentPickup || !currentDrop) return null;

    let waypoints = [];
    const pStart = [currentPickup.lat, currentPickup.lng];
    const pEnd = [currentDrop.lat, currentDrop.lng];

    if (currentIntermediateStop) {
      const pStop = [currentIntermediateStop.lat, currentIntermediateStop.lng];
      const leg1 = generateWaypoints(pStart, pStop, 15);
      const leg2 = generateWaypoints(pStop, pEnd, 15);
      waypoints = [...leg1, ...leg2.slice(1)];
    } else {
      waypoints = generateWaypoints(pStart, pEnd, 25);
    }

    if (isLeafletMode && leafletMap) {
      if (leafletRoutePolyline) leafletMap.removeLayer(leafletRoutePolyline);
      leafletRoutePolyline = L.polyline(waypoints, { color: '#00E676', weight: 5, opacity: 0.9 }).addTo(leafletMap);
      leafletMap.fitBounds(leafletRoutePolyline.getBounds(), { padding: [30, 30] });
    } else if (map && typeof google !== 'undefined' && google.maps) {
      if (routePolyline) routePolyline.setMap(null);
      const gPath = waypoints.map(pt => ({ lat: pt[0], lng: pt[1] }));

      routePolyline = new google.maps.Polyline({
        path: gPath,
        geodesic: true,
        strokeColor: '#00E676',
        strokeOpacity: 0.9,
        strokeWeight: 6,
        map: map
      });

      const bounds = new google.maps.LatLngBounds();
      gPath.forEach(pt => bounds.extend(pt));
      map.fitBounds(bounds, 80);
    }

    let totalStraightDist = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalStraightDist += getDistanceKm(waypoints[i][0], waypoints[i][1], waypoints[i+1][0], waypoints[i+1][1]);
    }
    const roadDist = Math.max(1.2, totalStraightDist * 1.25);
    const estDurationMin = Math.max(4, Math.ceil(roadDist * 2.8));

    return {
      distanceKm: roadDist,
      durationMin: estDurationMin,
      waypoints: waypoints
    };
  }

  function generateWaypoints(start, end, count = 25) {
    const points = [];
    const midLat = (start[0] + end[0]) / 2 + 0.003;
    const midLng = (start[1] + end[1]) / 2 - 0.003;

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const lat = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * midLat + t * t * end[0];
      const lng = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * midLng + t * t * end[1];
      points.push([parseFloat(lat.toFixed(5)), parseFloat(lng.toFixed(5))]);
    }
    return points;
  }

  function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function spawnNearbyDrivers(vehicleType = 'bike') {
    if (!map) return;
    roamingDriverMarkers.forEach(m => m.setMap(null));
    roamingDriverMarkers = [];

    const center = [currentPickup.lat, currentPickup.lng];
    const offsets = [
      [0.003, 0.004], [-0.002, 0.003], [0.004, -0.003], [-0.003, -0.004]
    ];

    offsets.forEach((offset) => {
      const dLat = center[0] + offset[0];
      const dLng = center[1] + offset[1];
      const marker = new google.maps.Marker({
        position: { lat: dLat, lng: dLng },
        map: map,
        icon: createVehicleSvgIcon(vehicleType)
      });
      roamingDriverMarkers.push(marker);
    });
  }

  function showRadarPulse() {}
  function hideRadarPulse() {}

  function setAssignedDriverMarker(vehicleType = 'bike', startPos = [currentPickup.lat + 0.006, currentPickup.lng + 0.006]) {
    if (!map) return;
    if (driverMarker) driverMarker.setMap(null);

    roamingDriverMarkers.forEach(m => m.setMap(null));
    roamingDriverMarkers = [];

    driverMarker = new google.maps.Marker({
      position: { lat: startPos[0], lng: startPos[1] },
      map: map,
      icon: createVehicleSvgIcon(vehicleType)
    });
  }

  function animateMarker(marker, waypoints, vehicleType = 'bike', speedMultiplier = 1.0, onStepCallback, onCompleteCallback) {
    if (!marker || !waypoints || waypoints.length === 0) return;

    let index = 0;
    const baseInterval = 250;

    function step() {
      if (index >= waypoints.length) {
        if (onCompleteCallback) onCompleteCallback();
        return;
      }

      const currentPos = waypoints[index];
      marker.setPosition({ lat: currentPos[0], lng: currentPos[1] });

      if (map && index % 3 === 0) {
        map.panTo({ lat: currentPos[0], lng: currentPos[1] });
      }

      if (onStepCallback) {
        const progress = Math.round((index / (waypoints.length - 1)) * 100);
        onStepCallback(progress, currentPos);
      }

      index++;
      const nextDelay = baseInterval / speedMultiplier;
      setTimeout(step, nextDelay);
    }

    step();
  }

  return {
    initMap,
    searchRealPlaces,
    geocodeAddress,
    switchMapLayer,
    openInGoogleMapsApp,
    locateUserGPS,
    LANDMARKS,
    setPickupLocation,
    setIntermediateStop,
    setDropLocation,
    getPickupLocation: () => currentPickup,
    getIntermediateStop: () => currentIntermediateStop,
    getDropLocation: () => currentDrop,
    calculateAndDrawRoute,
    spawnNearbyDrivers,
    showRadarPulse,
    hideRadarPulse,
    setAssignedDriverMarker,
    animateMarker,
    getDriverMarker: () => driverMarker
  };
})();
