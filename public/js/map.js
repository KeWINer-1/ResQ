const providersList = document.getElementById("providers-list");
const radiusInput = document.getElementById("radius-input");
const capabilitySelect = document.getElementById("capability-select");
const refreshBtn = document.getElementById("refresh-btn");
const mapMessage = document.getElementById("map-message");
const gpsAccuracyEl = document.getElementById("gps-accuracy");
const userPositionCard = document.getElementById("user-position-card");
const manualLocationInput = document.getElementById("manual-location-input");
const manualLocationStatus = document.getElementById("manual-location-status");
const applyManualLocationBtn = document.getElementById("apply-manual-location-btn");
const useGpsBtn = document.getElementById("use-gps-btn");
const destinationCard = document.getElementById("destination-card");
const destinationInput = document.getElementById("destination-input");
const destinationCalcBtn = document.getElementById("destination-calc-btn");
const destinationClearBtn = document.getElementById("destination-clear-btn");
const destinationStatus = document.getElementById("destination-status");
const requestStatusCard = document.getElementById("request-status-card");
const requestStatusText = document.getElementById("request-status-text");
const requestStatusPill = document.getElementById("request-status-pill");
const requestStatusEta = document.getElementById("request-status-eta");
const requestStatusDistance = document.getElementById("request-status-distance");
const requestStatusPrice = document.getElementById("request-status-price");
const requestStatusUpdated = document.getElementById("request-status-updated");
const requestStatusTimeline = document.getElementById("request-status-timeline");
const requestStatusActions = document.getElementById("request-status-actions");
const requestStatusControl = document.getElementById("request-status-control");
const requestCallBtn = document.getElementById("request-call-btn");
const requestMessageBtn = document.getElementById("request-message-btn");
const requestCancelBtn = document.getElementById("request-cancel-btn");
const requestNewBtn = document.getElementById("request-new-btn");
const requestCancelHint = document.getElementById("request-cancel-hint");
const requestChat = document.getElementById("request-chat");
const requestChatBox = document.getElementById("request-chat-box");
const requestChatInput = document.getElementById("request-chat-input");
const requestChatSend = document.getElementById("request-chat-send");
const requestRatingPanel = document.getElementById("request-rating");
const requestRatingStars = document.getElementById("request-rating-stars");
const requestRatingComment = document.getElementById("request-rating-comment");
const requestRatingSend = document.getElementById("request-rating-send");
const requestStatusHideBtn = document.getElementById("request-status-hide");
const providerSelectCard = document.getElementById("provider-select-card");
const providerSelectAvatar = document.getElementById("provider-select-avatar");
const providerSelectName = document.getElementById("provider-select-name");
const providerSelectSub = document.getElementById("provider-select-sub");
const providerSelectStatus = document.getElementById("provider-select-status");
const providerSelectEta = document.getElementById("provider-select-eta");
const providerSelectPrice = document.getElementById("provider-select-price");
const providerSelectTags = document.getElementById("provider-select-tags");
const providerSelectCall = document.getElementById("provider-select-call");
const providerSelectRequest = document.getElementById("provider-select-request");
const providerSelectClose = document.getElementById("provider-select-close");
const mobileListToggle = document.getElementById("mobile-list-toggle");
const sidebarEl = document.querySelector(".sidebar");
const statusToast = document.getElementById("status-toast");
const providersFilters = document.getElementById("providers-filters");
const providersHeader = document.getElementById("providers-header");
const providersHint = document.getElementById("providers-hint");
const requestNotesModal = document.getElementById("request-notes-modal");
const requestNotesInput = document.getElementById("request-notes-input");
const requestNotesCancel = document.getElementById("request-notes-cancel");
const requestNotesSend = document.getElementById("request-notes-send");
const requestRatingModal = document.getElementById("request-rating-modal");
const requestRatingModalStars = document.getElementById("request-rating-modal-stars");
const requestRatingModalComment = document.getElementById("request-rating-modal-comment");
const requestRatingModalSend = document.getElementById("request-rating-modal-send");
const requestRatingModalLater = document.getElementById("request-rating-modal-later");
const mobileHelpCta = document.getElementById("mobile-home-cta");
const mobileHelpBtn = document.getElementById("mobile-help-btn");
const mobileSheetGrip = document.getElementById("mobile-sheet-grip");
let mapCenterBtn = document.getElementById("map-center-btn");

const currentRole = getUserRole();
if (currentRole === "Provider") {
  window.location.href = "/provider";
}
if (currentRole === "Admin") {
  window.location.href = "/admin";
}

let map;
let userMarker;
let providerMarkers = [];
let activeProviderMarker = null;
let activeRouteLine = null;
let activeTripRouteLine = null;
let destinationMarker = null;
let radiusCircle = null;
let userLocation = null;
const fallbackLocation = { lat: 47.4979, lng: 19.0402 };
let activeRequestId = null;
let requestPollTimer = null;
let lastJobStatus = null;
let lastRequestStatus = null;
let lastRouteFetchAt = 0;
let lastRouteKey = null;
let lastRouteData = null;
let routeFetchInFlight = false;
let routeGeometryKey = null;
let routeGeometryFetchedAt = 0;
let routeGeometryData = null;
let lastMessageFetchAt = 0;
let lastMessageId = 0;
let activeJobId = null;
let currentJobStatus = null;
let userWatchId = null;
let manualLocationOverride = false;
let lastUserUpdateAt = 0;
let lastUserCoords = null;
let selectedProvider = null;
let destinationCoords = null;
let tripDistanceKm = null;
let tripDurationMinutes = null;
let tripRouteKey = null;
let tripRouteFetchAt = 0;
let rideFocusActive = false;
let requestNotesResolver = null;
let tripUiManualExpand = false;
let tripUiForceForm = false;
let tripReadyState = false;
let sheetExpanded = false;
let selectedProviderNameTooltip = null;
let mobileHomeOverride = false;
let forceFreshStart = false;
const manualLocationStorageKey = "resq_manual_user_location";
const destinationStorageKey = "resq_destination_location";

function ensureMapCenterButton() {
  if (mapCenterBtn) return mapCenterBtn;
  const mapWrap = document.querySelector(".map-wrap");
  if (!mapWrap) return null;
  const button = document.createElement("button");
  button.className = "map-center-btn";
  button.id = "map-center-btn";
  button.type = "button";
  button.setAttribute("aria-label", "Térkép kozepre igazitas");
  button.innerHTML = "<span>➤</span>";
  mapWrap.appendChild(button);
  mapCenterBtn = button;
  return mapCenterBtn;
}

function isUserCenteredOnMap() {
  if (!map || !userLocation) return false;
  const center = map.getCenter();
  const distanceMeters = map.distance([userLocation.lat, userLocation.lng], center);
  return distanceMeters <= 35;
}

function updateMapCenterButtonState() {
  const button = ensureMapCenterButton();
  if (!button) return;
  button.classList.toggle("is-centered", isUserCenteredOnMap());
}

function centerMapToUser() {
  if (!map || !userLocation) return;
  map.setView([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 14));
  updateMapCenterButtonState();
}

function clearSelectedProviderNameTooltip() {
  if (selectedProviderNameTooltip && map) {
    map.removeLayer(selectedProviderNameTooltip);
  }
  selectedProviderNameTooltip = null;
}

function showSelectedProviderNameTooltip(provider) {
  clearSelectedProviderNameTooltip();
  if (!map || !provider || !Number.isFinite(provider.lat) || !Number.isFinite(provider.lng)) {
    return;
  }
  selectedProviderNameTooltip = L.tooltip({
    permanent: true,
    direction: "top",
    offset: [0, -16],
    className: "provider-name-tooltip"
  })
    .setLatLng([provider.lat, provider.lng])
    .setContent(String(provider.name || "Autómentő"))
    .addTo(map);
}

function showRequestStatus(message) {
  if (requestStatusCard && requestStatusText) {
    requestStatusText.textContent = message || "";
    requestStatusCard.style.display = message ? "block" : "none";
  }
}

function getMyUserId() {
  const token = getToken();
  const data = decodeJwtPayload(token);
  return data?.userId || null;
}

function jobStatusLabel(status) {
  if (!status) return null;
  const labels = {
    accepted: "Elfogadva",
    enroute: "Úton van",
    arrived: "Megérkezett",
    completed: "Kész",
    cancelled: "Lemondva"
  };
  return labels[status] || status;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Nincs adat";
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

function formatRelativeTime(dateValue) {
  if (!dateValue) return "Nincs adat";
  const ts = typeof dateValue === "string" ? Date.parse(dateValue) : Number(dateValue);
  if (!Number.isFinite(ts)) return "Nincs adat";
  const diffMs = Date.now() - ts;
  if (diffMs < 60000) return "Most frissítve";
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes} perc`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} óra`;
  return `${hours} óra ${mins} perc`;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoordinatePair(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  const match = normalized.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (!match) return null;
  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function parseGoogleMapsCoordinate(value) {
  const normalized = String(value || "").trim();
  const atMatch = normalized.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number.parseFloat(atMatch[1]);
    const lng = Number.parseFloat(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  const urlPairMatch = normalized.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (urlPairMatch) {
    const lat = Number.parseFloat(urlPairMatch[1]);
    const lng = Number.parseFloat(urlPairMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function dmsToDecimal(degrees, minutes, seconds, hemisphere) {
  const deg = Number.parseFloat(degrees);
  const min = Number.parseFloat(minutes || "0");
  const sec = Number.parseFloat(seconds || "0");
  if (![deg, min, sec].every(Number.isFinite)) return null;
  let value = Math.abs(deg) + min / 60 + sec / 3600;
  const dir = String(hemisphere || "").toUpperCase();
  if (dir === "S" || dir === "W") value *= -1;
  return value;
}

function parseDmsCoordinatePair(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  const match = normalized.match(
    /(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([NS])\s+(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([EW])/i
  );
  if (!match) return null;
  const lat = dmsToDecimal(match[1], match[2], match[3], match[4]);
  const lng = dmsToDecimal(match[5], match[6], match[7], match[8]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function saveManualLocation(value) {
  try {
    localStorage.setItem(manualLocationStorageKey, JSON.stringify(value));
  } catch {}
}

function clearManualLocation() {
  try {
    localStorage.removeItem(manualLocationStorageKey);
  } catch {}
}

function loadManualLocation() {
  try {
    const raw = localStorage.getItem(manualLocationStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDestinationLocation(value) {
  try {
    localStorage.setItem(destinationStorageKey, JSON.stringify(value));
  } catch {}
}

function clearDestinationLocation() {
  try {
    localStorage.removeItem(destinationStorageKey);
  } catch {}
}

function loadDestinationLocation() {
  try {
    const raw = localStorage.getItem(destinationStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function shouldRefreshProviders(lat, lng) {
  const now = Date.now();
  if (!lastUserCoords) return true;
  const distanceKm = haversineKm(lat, lng, lastUserCoords.lat, lastUserCoords.lng);
  if (distanceKm > 0.05) return true;
  if (now - lastUserUpdateAt > 15000) return true;
  return false;
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return "Nincs adat";
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${Math.round(distanceKm * 10) / 10} km`;
}

function formatEta(minutes) {
  if (!Number.isFinite(minutes)) return "Nincs adat";
  if (minutes < 1) return "1 perc";
  if (minutes < 60) return `${Math.round(minutes)} perc`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} óra`;
  return `${hours} óra ${mins} perc`;
}

function applyUserLocation(lat, lng, accuracy, zoom = 13) {
  userLocation = { lat, lng };
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  const tripReady = document.body.classList.contains("trip-ready");
  const mobileHome = document.body.classList.contains("mobile-home");
  if (!isMobile || tripReady || mobileHome) {
    if (!map) {
      initMap(lat, lng);
    } else {
      map.setView([lat, lng], zoom);
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      }
    }
  }
  if (gpsAccuracyEl) {
    gpsAccuracyEl.textContent = Number.isFinite(accuracy)
      ? "GPS alapjan szamolunk."
      : manualLocationOverride
        ? "Kézzel megadott címmel számolunk."
        : "";
  }
  if (destinationCoords) {
    if (!isMobile || tripReady || mobileHome) {
      drawTripRouteLine(userLocation, destinationCoords);
    }
    fetchTripRoute(userLocation, destinationCoords)
      .then(() => {
        updateRequestAvailability();
      })
      .catch(() => {});
  }
  if ((!isMobile || tripReady || mobileHome) && shouldRefreshProviders(lat, lng)) {
    lastUserUpdateAt = Date.now();
    lastUserCoords = { lat, lng };
    updateRadiusCircle();
    loadProviders();
  }
  updateMapCenterButtonState();
  updateTripUiState(false);
}

function getProviderRatingValue(provider) {
  const candidates = [
    provider?.rating,
    provider?.avgRating,
    provider?.averageRating,
    provider?.ratingAvg
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) {
      return num;
    }
  }
  return null;
}

function ensureProviderRatingRow() {
  if (!providerSelectCard) return null;
  let valueEl = document.getElementById("provider-select-rating");
  if (valueEl) return valueEl;
  const priceRow = providerSelectPrice?.closest(".panel-row");
  if (!priceRow || !priceRow.parentElement) return null;
  const row = document.createElement("div");
  row.className = "panel-row";
  row.innerHTML = '<span class="panel-label">Értékelés</span><span class="panel-value" id="provider-select-rating">Nincs értékelés</span>';
  priceRow.insertAdjacentElement("afterend", row);
  valueEl = row.querySelector("#provider-select-rating");
  return valueEl;
}

function estimateEtaMinutes(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  const speedKmh = distanceKm < 3 ? 25 : 40;
  const minutes = (distanceKm / speedKmh) * 60;
  return Math.max(3, Math.round(minutes));
}

function estimatePrice(distanceKm, provider) {
  const baseFee = Number(provider?.baseFee);
  const perKmFee = Number(provider?.perKmFee);
  if (!Number.isFinite(distanceKm) || !Number.isFinite(baseFee) || !Number.isFinite(perKmFee)) {
    return null;
  }
  return baseFee + perKmFee * distanceKm;
}

async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query
  )}`;
  const response = await fetch(url, {
    headers: { "Accept-Language": "hu" }
  });
  if (!response.ok) throw new Error("Nem sikerült a címet beolvasni.");
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Nincs találat a címre.");
  }
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}

async function fetchTripRoute(from, to) {
  const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  const now = Date.now();
  if (tripRouteKey === key && now - tripRouteFetchAt < 45000 && tripDistanceKm) {
    return { distanceKm: tripDistanceKm, durationMinutes: tripDurationMinutes };
  }
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Nem sikerült útvonalat számolni.");
  const data = await response.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error("Nem található útvonal.");
  tripDistanceKm = route.distance / 1000;
  tripDurationMinutes = route.duration / 60;
  tripRouteKey = key;
  tripRouteFetchAt = now;
  return { distanceKm: tripDistanceKm, durationMinutes: tripDurationMinutes };
}

async function applyManualLocation() {
  const query = manualLocationInput?.value?.trim();
  if (!query) {
    if (manualLocationStatus) {
      manualLocationStatus.textContent = "Adj meg egy címet.";
    }
    return;
  }
  if (manualLocationStatus) {
    manualLocationStatus.textContent = "Kereses...";
  }
  try {
    const coordinateMatch = parseCoordinatePair(query);
    const googleMapsMatch = parseGoogleMapsCoordinate(query);
    const dmsCoordinateMatch = parseDmsCoordinatePair(query);
    const exactCoordinate = coordinateMatch || googleMapsMatch || dmsCoordinateMatch;
    const place = exactCoordinate
      ? { ...exactCoordinate, displayName: query }
      : await geocodeAddress(query);
    manualLocationOverride = true;
    applyUserLocation(place.lat, place.lng, null, exactCoordinate ? 18 : 16);
    saveManualLocation({
      query,
      lat: place.lat,
      lng: place.lng
    });
    showToast("Hely beallitva.");
    if (manualLocationStatus) {
      manualLocationStatus.textContent = "Cím beallitva.";
    }
  } catch (err) {
    if (manualLocationStatus) {
      manualLocationStatus.textContent = err.message || "Nem sikerült a helymeghatározás.";
    }
  }
}

function updateTimeline(status) {
  if (!requestStatusTimeline) return;
  const steps = Array.from(requestStatusTimeline.querySelectorAll(".timeline-step"));
  if (steps.length === 0) return;
  const order = ["new", "accepted", "enroute", "arrived", "completed"];
  if (status === "cancelled") {
    steps.forEach((step) => {
      step.classList.remove("is-active", "is-done");
      step.classList.add("is-cancelled");
    });
    return;
  }

  const currentIndex = order.indexOf(status);
  steps.forEach((step) => {
    const stepKey = step.getAttribute("data-step");
    const stepIndex = order.indexOf(stepKey);
    step.classList.remove("is-active", "is-done", "is-cancelled");
    if (stepIndex === -1 || currentIndex === -1) return;
    if (stepIndex < currentIndex) {
      step.classList.add("is-done");
    } else if (stepIndex === currentIndex) {
      step.classList.add("is-active");
    }
  });
}

function updateProviderMarker(lat, lng, name) {
  if (!map) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    if (activeProviderMarker) {
      activeProviderMarker.remove();
      activeProviderMarker = null;
    }
    return;
  }
  if (!activeProviderMarker) {
    const truckIcon = L.divIcon({
      className: "truck-marker",
      html: "<div class=\"marker marker-provider marker-active\"><span>🚗</span></div>",
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    activeProviderMarker = L.marker([lat, lng], { icon: truckIcon }).addTo(map);
  } else {
    activeProviderMarker.setLatLng([lat, lng]);
  }
}

async function fetchRouteEta(from, to) {
  if (routeFetchInFlight) return lastRouteData;
  const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  const now = Date.now();
  if (lastRouteKey === key && lastRouteData && now - lastRouteFetchAt < 45000) {
    return lastRouteData;
  }
  routeFetchInFlight = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error("OSRM hiba");
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error("Nincs útvonal");
    const distanceKm = route.distance / 1000;
    const durationMinutes = route.duration / 60;
    lastRouteKey = key;
    lastRouteData = { distanceKm, durationMinutes };
    lastRouteFetchAt = Date.now();
    return lastRouteData;
  } catch {
    return null;
  } finally {
    routeFetchInFlight = false;
  }
}

async function fetchRouteGeometry(from, to) {
  const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  const now = Date.now();
  if (routeGeometryKey === key && routeGeometryData && now - routeGeometryFetchedAt < 20000) {
    return routeGeometryData;
  }
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Route geometry failed");
    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length === 0) return null;
    routeGeometryKey = key;
    routeGeometryFetchedAt = now;
    routeGeometryData = coordinates.map(([lng, lat]) => [lat, lng]);
    return routeGeometryData;
  } catch {
    return null;
  }
}

function clearActiveRouteLine() {
  if (activeRouteLine) {
    activeRouteLine.remove();
    activeRouteLine = null;
  }
}

function clearTripRouteLine() {
  if (activeTripRouteLine) {
    activeTripRouteLine.remove();
    activeTripRouteLine = null;
  }
}

function resetTripCalculation() {
  destinationCoords = null;
  tripDistanceKm = null;
  tripDurationMinutes = null;
  tripRouteKey = null;
  tripRouteFetchAt = 0;
  clearTripRouteLine();
  clearDestinationMarker();
  clearDestinationLocation();
  if (destinationInput) {
    destinationInput.value = "";
  }
  if (destinationStatus) {
    destinationStatus.textContent = "";
  }
  tripUiManualExpand = false;
  tripUiForceForm = false;
  tripReadyState = false;
  mobileHomeOverride = false;
  clearPendingRequestUI();
  updateRequestAvailability();
  updateTripUiState(false);
}

function clearDestinationMarker() {
  if (destinationMarker) {
    destinationMarker.remove();
    destinationMarker = null;
  }
}

function updateDestinationMarker(lat, lng) {
  if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const flagIcon = L.divIcon({
    className: "destination-marker",
    html: "<div class=\"marker marker-destination\"><span>🏁</span></div>",
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
  if (!destinationMarker) {
    destinationMarker = L.marker([lat, lng], { icon: flagIcon }).addTo(map);
  } else {
    destinationMarker.setLatLng([lat, lng]);
  }
  destinationMarker.bindPopup("Celpont");
}

async function drawTripRouteLine(from, to, fit = false) {
  if (!map || !from || !to) return;
  const routeGeometry = await fetchRouteGeometry(from, to);
  if (!routeGeometry) return;
  if (!activeTripRouteLine) {
    activeTripRouteLine = L.polyline(routeGeometry, {
      color: "#3b82f6",
      weight: 5,
      opacity: 0.95
    }).addTo(map);
  } else {
    activeTripRouteLine.setLatLngs(routeGeometry);
  }
  if (fit) {
    map.fitBounds(activeTripRouteLine.getBounds(), { padding: [40, 40] });
  }
}

function fitActiveRoutes() {
  if (!map) return;
  const bounds = [];
  if (activeRouteLine) {
    bounds.push(activeRouteLine.getBounds());
  }
  if (activeTripRouteLine) {
    bounds.push(activeTripRouteLine.getBounds());
  }
  if (bounds.length === 0) return;
  const combined = bounds[0];
  for (let i = 1; i < bounds.length; i += 1) {
    combined.extend(bounds[i]);
  }
  map.fitBounds(combined, { padding: [40, 40] });
}

function setRideFocusMode(isFocused) {
  if (userPositionCard) {
    userPositionCard.style.display = isFocused ? "none" : "block";
  }
  if (destinationCard) {
    destinationCard.style.display = isFocused ? "none" : "block";
  }
  if (providersFilters) {
    providersFilters.style.display = isFocused ? "none" : "flex";
  }
  if (providersHeader) {
    providersHeader.style.display = isFocused ? "none" : "block";
  }
  if (providersHint) {
    providersHint.style.display = isFocused ? "none" : "block";
  }
  if (providersList) {
    providersList.style.display = isFocused ? "none" : "block";
  }
  if (mobileListToggle) {
    mobileListToggle.style.display = isFocused ? "none" : "";
  }
  if (providerSelectCard && isFocused) {
    providerSelectCard.style.display = "none";
  }
}

function updateStatusActions(provider, isActive) {
  const phone = provider?.phone || "";
  const hasPhone = Boolean(phone);

  if (requestCallBtn) {
    requestCallBtn.href = hasPhone ? `tel:${phone}` : "#";
    requestCallBtn.style.display = hasPhone && isActive ? "inline-flex" : "none";
  }
  if (requestMessageBtn) {
    requestMessageBtn.href = hasPhone ? `sms:${phone}` : "#";
    requestMessageBtn.style.display = hasPhone && isActive ? "inline-flex" : "none";
  }
  if (requestStatusActions) {
    const showActions = hasPhone && isActive;
    requestStatusActions.style.display = showActions ? "flex" : "none";
  }
}

function showProviderOverlay(provider) {
  selectedProvider = provider || null;
  if (!providerSelectCard) return;
  if (!provider) {
    document.querySelectorAll(".ride-card").forEach((card) => {
      card.classList.remove("selected");
    });
    clearSelectedProviderNameTooltip();
    providerSelectCard.style.display = "none";
    return;
  }
  document.querySelectorAll(".ride-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.id === String(provider.id));
  });
  showSelectedProviderNameTooltip(provider);
  if (map && Number.isFinite(provider.lat) && Number.isFinite(provider.lng)) {
    map.setView([provider.lat, provider.lng], Math.max(map.getZoom(), 14));
  }
  const rating =
    getProviderRatingValue(provider);
  const vehicle = "Autómentő";
  if (providerSelectAvatar) {
    const initials = provider.name
      ? provider.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join("")
      : "AM";
    providerSelectAvatar.textContent = initials;
  }
  if (providerSelectName) {
    providerSelectName.textContent = provider.name || "Autómentő";
  }
  if (providerSelectSub) {
    providerSelectSub.textContent = Number.isFinite(rating) ? `★ ${rating.toFixed(1)} · ${vehicle}` : vehicle;
  }
  const providerRatingValue = ensureProviderRatingRow();
  if (providerRatingValue) {
    providerRatingValue.textContent = Number.isFinite(rating) ? `${rating.toFixed(1)} / 5` : "Nincs értékelés";
  }
  if (providerSelectStatus) {
    providerSelectStatus.textContent = "Online";
  }
  if (providerSelectEta) {
    providerSelectEta.textContent = `~${formatEta(estimateEtaMinutes(provider.distanceKm))}`;
  }
  if (providerSelectPrice) {
    const hasTrip = Number.isFinite(tripDistanceKm);
    const estimate = hasTrip ? estimatePrice(tripDistanceKm, provider) : null;
    providerSelectPrice.textContent = estimate
      ? formatCurrency(estimate)
      : "Adj meg célcímet";
  }
  if (providerSelectTags) {
    const caps = provider.capabilities || [];
    providerSelectTags.innerHTML =
      caps.length > 0
        ? caps.map((cap) => `<span class="pill">${cap}</span>`).join(" ")
        : "<span class=\"pill\">Autómentés</span>";
  }
  if (providerSelectCall) {
    if (provider.phone) {
      providerSelectCall.textContent = `Hívás: ${provider.phone}`;
      providerSelectCall.href = `tel:${provider.phone}`;
      providerSelectCall.style.pointerEvents = "auto";
      providerSelectCall.style.opacity = "1";
    } else {
      providerSelectCall.textContent = "Hívás nem elérhető";
      providerSelectCall.href = "#";
      providerSelectCall.style.pointerEvents = "none";
      providerSelectCall.style.opacity = "0.6";
    }
  }
  updateRequestAvailability();
  providerSelectCard.style.display = "block";
}

function updateRequestAvailability() {
  const canRequest = Number.isFinite(tripDistanceKm);
  if (providerSelectRequest) {
    providerSelectRequest.disabled = !canRequest;
    providerSelectRequest.textContent = canRequest ? "Mentés kérése" : "Adj meg célcímet";
  }
  if (providersHint) {
    providersHint.textContent = canRequest
      ? "Koppints a mentore a reszletekhez."
      : "Add meg a célcímet, hogy kérést küldhess.";
  }
  updateTripUiState();
}

function setTripUiCollapsed(collapsed) {
  document.body.classList.toggle("trip-ui-collapsed", collapsed);
}

function ensureMapReady() {
  const start = userLocation || fallbackLocation;
  if (!map) {
    initMap(start.lat, start.lng);
  } else {
    map.invalidateSize(true);
    if (Number.isFinite(start.lat) && Number.isFinite(start.lng)) {
      map.setView([start.lat, start.lng], map.getZoom() || 13);
      if (userMarker) {
        userMarker.setLatLng([start.lat, start.lng]);
      }
    }
  }
  updateRadiusCircle();
}

function setMobileFormOpen(open) {
  if (open) {
    tripReadyState = false;
    document.body.classList.remove("trip-ready", "trip-ui-collapsed");
  }
  document.body.classList.toggle("mobile-form-open", open);
  document.body.classList.toggle(
    "mobile-home",
    !open && (!tripReadyState || mobileHomeOverride)
  );
  if (!open && (!tripReadyState || mobileHomeOverride)) {
    ensureMapReady();
  }
}

function setSheetExpanded(expanded) {
  sheetExpanded = expanded;
  document.body.classList.toggle("sheet-expanded", expanded);
  if (!expanded && map) {
    map.invalidateSize(true);
  }
}

function updateMobileHomeState() {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if (!isMobile) {
    document.body.classList.remove("mobile-home");
    document.body.classList.remove("mobile-form-open");
    return;
  }
  if (tripReadyState && !mobileHomeOverride) {
    document.body.classList.remove("mobile-home");
    return;
  }
  const formOpen = document.body.classList.contains("mobile-form-open");
  document.body.classList.toggle("mobile-home", !formOpen);
  if (!formOpen) {
    ensureMapReady();
  }
}

function isTripReadyActive() {
  return Number.isFinite(tripDistanceKm) && !mobileHomeOverride;
}

function updateTripUiState(forceCollapse = false) {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if (!isMobile) {
    document.body.classList.remove("trip-ready");
    setTripUiCollapsed(false);
    tripReadyState = false;
    return;
  }
  if (tripUiForceForm) {
    document.body.classList.remove("trip-ready");
    setTripUiCollapsed(false);
    tripReadyState = false;
    updateMobileHomeState();
    return;
  }
  if (!isTripReadyActive()) {
    document.body.classList.remove("trip-ready");
    setTripUiCollapsed(false);
    tripReadyState = false;
    setSheetExpanded(false);
    updateMobileHomeState();
    return;
  }
  document.body.classList.add("trip-ready");
  document.body.classList.remove("mobile-form-open");
  if (!tripReadyState) {
    tripReadyState = true;
    ensureMapReady();
    setTimeout(() => {
      if (map) map.invalidateSize(true);
    }, 120);
  }
  document.body.classList.remove("mobile-home");
  document.body.classList.remove("mobile-form-open");
  if (forceCollapse) {
    setSheetExpanded(false);
  }
  if (forceCollapse) {
    tripUiManualExpand = false;
    setTripUiCollapsed(true);
    return;
  }
  if (tripUiManualExpand) {
    setTripUiCollapsed(false);
    return;
  }
  setTripUiCollapsed(true);
}

function renderRequestMessages(messages) {
  if (!requestChatBox) return;
  const myUserId = getMyUserId();
  if (!messages || messages.length === 0) {
    requestChatBox.innerHTML = "<p class=\"notice\">Még nincs üzenet.</p>";
    return;
  }
  requestChatBox.innerHTML = messages
    .map((msg) => {
      const isMe = myUserId && msg.SenderUserId === myUserId;
      const roleClass = isMe ? "me" : "admin";
      const sender =
        msg.SenderProviderName || msg.SenderEmail || (msg.SenderRole || "User");
      const time = msg.CreatedAt ? new Date(msg.CreatedAt).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }) : "";
      return `<div class="chat-line ${roleClass}">
        <div class="chat-meta">${sender}${time ? ` · ${time}` : ""}</div>
        <div class="chat-bubble">${msg.Body}</div>
      </div>`;
    })
    .join("");
  requestChatBox.scrollTop = requestChatBox.scrollHeight;
}

async function loadRequestMessages(requestId) {
  if (!requestId) return;
  try {
    const data = await apiFetch(`/api/requests/${requestId}/messages`);
    const messages = data.messages || [];
    renderRequestMessages(messages);
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.Id && last.Id !== lastMessageId) {
        if (lastMessageId && last.SenderUserId !== getMyUserId()) {
          notifyUser("Új üzenet érkezett", last.Body);
          showToast("Új üzenet érkezett");
        }
        lastMessageId = last.Id;
      }
    }
  } catch (err) {
    if (requestChatBox) {
      requestChatBox.innerHTML = `<p class="notice">${err.message}</p>`;
    }
  }
}

async function sendRequestMessage() {
  const body = requestChatInput?.value?.trim();
  if (!body || !activeRequestId) return;
  try {
    await apiFetch(`/api/requests/${activeRequestId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    if (requestChatInput) {
      requestChatInput.value = "";
    }
    await loadRequestMessages(activeRequestId);
  } catch (err) {
    alert(err.message);
  }
}

function notifyUser(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function showToast(message) {
  if (!statusToast) return;
  statusToast.textContent = message;
  statusToast.classList.add("show");
  setTimeout(() => {
    statusToast.classList.remove("show");
  }, 4000);
}

function clearPendingRequestUI() {
  document.body.classList.remove("pending-request");
  if (requestStatusCard) {
    requestStatusCard.classList.remove("is-pending");
  }
}

function returnToMobileHome() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    tripUiForceForm = false;
    tripUiManualExpand = false;
    tripReadyState = false;
    mobileHomeOverride = false;
    setSheetExpanded(false);
    document.body.classList.remove(
      "trip-ready",
      "trip-ui-collapsed",
      "pending-request",
      "sheet-expanded",
      "mobile-form-open"
    );
    document.body.classList.add("mobile-home");
    if (sidebarEl) {
      sidebarEl.scrollTo({ top: 0 });
    }
    updateTripUiState(false);
    updateMobileHomeState();
  }
}

function resetRequestView() {
  activeRequestId = null;
  lastJobStatus = null;
  lastRequestStatus = null;
  activeJobId = null;
  currentJobStatus = null;
  rideFocusActive = false;
  clearPendingRequestUI();
  setRideFocusMode(false);
  clearActiveRouteLine();
  if (activeProviderMarker) {
    activeProviderMarker.remove();
    activeProviderMarker = null;
  }
  if (requestStatusCard) {
    requestStatusCard.style.display = "none";
  }
  if (requestPollTimer) {
    clearInterval(requestPollTimer);
    requestPollTimer = null;
  }
  try {
    localStorage.removeItem("resq_active_request");
  } catch {}
}

function clearStoredState() {
  try {
    localStorage.removeItem("resq_active_request");
    localStorage.removeItem("resq_destination_location");
    localStorage.removeItem("resq_manual_user_location");
  } catch {}
}

function hardResetToInitial() {
  clearStoredState();
  try {
    localStorage.removeItem("resq_profile");
    localStorage.removeItem("resq_profile_ts");
  } catch {}
  window.location.replace("/map");
}

function resetToInitialFlow() {
  resetRequestView();
  resetTripCalculation();
  clearManualLocation();
  manualLocationOverride = false;
  if (manualLocationInput) {
    manualLocationInput.value = "";
  }
  if (manualLocationStatus) {
    manualLocationStatus.textContent = "";
  }
  if (destinationInput) {
    destinationInput.value = "";
  }
  tripUiForceForm = false;
  tripUiManualExpand = false;
  tripReadyState = false;
  mobileHomeOverride = false;
  selectedProvider = null;
  showProviderOverlay(null);
  document.body.classList.remove(
    "trip-ready",
    "trip-ui-collapsed",
    "pending-request",
    "sheet-expanded",
    "mobile-form-open"
  );
  document.body.classList.add("mobile-home");
  setSheetExpanded(false);
  setMobileFormOpen(false);
  if (providersList) {
    providersList.innerHTML = "";
  }
  clearStoredState();
  locateUser();
  updateRequestAvailability();
  updateTripUiState(false);
  updateMobileHomeState();
}

function prepareFreshStart() {
  resetRequestView();
  resetTripCalculation();
  clearManualLocation();
  manualLocationOverride = false;
  if (manualLocationInput) {
    manualLocationInput.value = "";
  }
  if (manualLocationStatus) {
    manualLocationStatus.textContent = "";
  }
  tripUiForceForm = false;
  tripUiManualExpand = false;
  tripReadyState = false;
  mobileHomeOverride = false;
  selectedProvider = null;
  showProviderOverlay(null);
  document.body.classList.remove(
    "trip-ready",
    "trip-ui-collapsed",
    "pending-request",
    "sheet-expanded"
  );
  setSheetExpanded(false);
  if (providersList) {
    providersList.innerHTML = "";
  }
  updateRequestAvailability();
  updateTripUiState(false);
  updateMobileHomeState();
}


function openRequestNotesModal() {
  if (!requestNotesModal || !requestNotesInput) {
    return Promise.resolve({ cancelled: false, notes: "" });
  }
  requestNotesInput.value = "";
  requestNotesModal.style.display = "flex";
  requestNotesInput.focus();
  return new Promise((resolve) => {
    requestNotesResolver = resolve;
  });
}

function closeRequestNotesModal(cancelled) {
  if (!requestNotesModal) return;
  requestNotesModal.style.display = "none";
  if (requestNotesResolver) {
    requestNotesResolver({
      cancelled,
      notes: requestNotesInput?.value?.trim() || ""
    });
    requestNotesResolver = null;
  }
}

async function updateRequestStatusUI(data) {
  const jobStatus = data?.job?.Status || data?.job?.status;
  const requestStatus = data?.status || "new";
  const provider = data?.provider || null;
  currentJobStatus = jobStatus || null;
  const statusForTimeline = jobStatus || requestStatus || "new";
  const jobLabel = jobStatusLabel(jobStatus);
  const requestLabel =
    jobLabel ||
    (requestStatus === "cancelled"
      ? "Lemondva"
      : requestStatus === "completed"
        ? "Kész"
        : null);
  const providerName = provider?.name ? ` (${provider.name})` : "";

  if (requestLabel) {
    const text = providerName ? `${providerName} - ${requestLabel}` : requestLabel;
    mapMessage.textContent = text;
    showRequestStatus(text);
  } else {
    const text = "Kérés elküldve.";
    mapMessage.textContent = text;
    showRequestStatus(text);
  }

  if (requestStatusPill) {
    requestStatusPill.textContent = requestLabel || "Várakozás";
  }

  const isPending = requestStatus === "new" && !jobStatus;
  document.body.classList.toggle("pending-request", isPending);
  if (requestStatusCard) {
    requestStatusCard.classList.toggle("is-pending", isPending);
  }
  if (isPending && requestStatusPill) {
    requestStatusPill.textContent = "Elfogadasra var";
  }
  if (isPending && requestStatusText) {
    requestStatusText.textContent = "Elfogadasra var";
  }
  if (isPending) {
    tripUiForceForm = false;
    setMobileFormOpen(false);
    updateTripUiState(true);
    if (providerSelectCard) {
      providerSelectCard.style.display = "none";
    }
  }

  updateTimeline(statusForTimeline);

  const activeStatuses = new Set(["accepted", "enroute", "arrived"]);
  const isActive = activeStatuses.has(jobStatus);
  const wasRideFocusActive = rideFocusActive;
  rideFocusActive = isActive;
  setRideFocusMode(isActive);
  if (requestStatusCard) {
    requestStatusCard.classList.toggle("is-active", isActive);
  }
  if (!isActive) {
    clearActiveRouteLine();
    if (wasRideFocusActive) {
      loadProviders();
    }
  }

  const providerLat = provider?.lat ?? provider?.LastLat ?? null;
  const providerLng = provider?.lng ?? provider?.LastLng ?? null;
  let distanceKm = null;
  let etaMinutes = null;
  if (
    userLocation &&
    Number.isFinite(providerLat) &&
    Number.isFinite(providerLng)
  ) {
    distanceKm = haversineKm(
      userLocation.lat,
      userLocation.lng,
      providerLat,
      providerLng
    );
    etaMinutes = estimateEtaMinutes(distanceKm);
    const route = await fetchRouteEta(
      { lat: providerLat, lng: providerLng },
      userLocation
    );
    if (route) {
      distanceKm = route.distanceKm;
      etaMinutes = route.durationMinutes;
    }
    if (requestStatusDistance) {
      requestStatusDistance.textContent = formatDistance(distanceKm);
    }
    if (requestStatusEta) {
      requestStatusEta.textContent = formatEta(etaMinutes);
    }
  } else {
    if (requestStatusDistance) {
      requestStatusDistance.textContent = "Nincs adat";
    }
    if (requestStatusEta) {
      requestStatusEta.textContent = "Nincs adat";
    }
  }

  if (requestStatusPrice) {
    const estimate = Number.isFinite(tripDistanceKm)
      ? estimatePrice(tripDistanceKm, provider)
      : null;
    requestStatusPrice.textContent = estimate
      ? formatCurrency(estimate)
      : "Adj meg célcímet";
  }

  if (requestStatusUpdated) {
    const updatedAt = provider?.lastLocationAt || provider?.LastLocationAt;
    requestStatusUpdated.textContent = updatedAt
      ? `Pozíció frissítve: ${formatRelativeTime(updatedAt)}`
      : "";
  }

  updateProviderMarker(providerLat, providerLng, provider?.name);
  if (isActive) {
    clearProviders();
    if (userLocation && Number.isFinite(providerLat) && Number.isFinite(providerLng)) {
      const routeGeometry = await fetchRouteGeometry(
        { lat: providerLat, lng: providerLng },
        userLocation
      );
      if (routeGeometry && map) {
        if (!activeRouteLine) {
          activeRouteLine = L.polyline(routeGeometry, {
            color: "#ff8a1f",
            weight: 5,
            opacity: 0.9
          }).addTo(map);
        } else {
          activeRouteLine.setLatLngs(routeGeometry);
        }
        if (!wasRideFocusActive) {
          fitActiveRoutes();
        }
      }
    }
  }
  updateStatusActions(provider, isActive);

  if (requestStatusControl) {
    requestStatusControl.style.display = activeRequestId ? "flex" : "none";
  }
  if (requestCancelBtn) {
    const cancelLocked = ["enroute", "arrived"].includes(jobStatus);
    requestCancelBtn.style.display =
      statusForTimeline === "cancelled" ||
      statusForTimeline === "completed" ||
      cancelLocked
        ? "none"
        : "inline-flex";
    if (requestCancelHint) {
      requestCancelHint.style.display = cancelLocked ? "block" : "none";
      requestCancelHint.textContent = cancelLocked
        ? "Lemondás csak ügyfélszolgálaton."
        : "";
    }
  }
  if (requestNewBtn) {
    requestNewBtn.style.display =
      statusForTimeline === "cancelled" || statusForTimeline === "completed"
        ? "inline-flex"
        : "none";
  }

  const canChat = Boolean(activeRequestId);
  if (requestChat) {
    requestChat.style.display = canChat ? "block" : "none";
  }
  if (!canChat && requestChatBox) {
    requestChatBox.innerHTML = "";
  }
  if (canChat && activeRequestId) {
    const now = Date.now();
    if (now - lastMessageFetchAt > 7000) {
      lastMessageFetchAt = now;
      await loadRequestMessages(activeRequestId);
    }
  }

  const jobId = data?.job?.Id || data?.job?.id;
  activeJobId = jobId || null;
  const ratingKey = jobId ? `resq_rating_submitted_${jobId}` : null;
  const alreadyRated = ratingKey ? localStorage.getItem(ratingKey) === "1" : false;
  if (requestRatingPanel) {
    requestRatingPanel.style.display =
      jobStatus === "completed" && jobId && !alreadyRated ? "block" : "none";
  }
  if (jobStatus === "completed" && jobId && !alreadyRated) {
    openRequestRatingModal();
  } else {
    closeRequestRatingModal();
  }

  if (jobStatus && jobStatus !== lastRequestStatus) {
    notifyUser("Mentés státusz frissült", jobStatusLabel(jobStatus) || jobStatus);
    showToast(`Státusz: ${jobStatusLabel(jobStatus) || jobStatus}`);
    lastRequestStatus = jobStatus;
  }
}

function startRequestPolling(requestId) {
  activeRequestId = requestId;
  try {
    localStorage.setItem("resq_active_request", String(requestId));
  } catch {}
  lastMessageFetchAt = 0;
  lastMessageId = 0;
  lastRouteFetchAt = 0;
  lastRouteKey = null;
  lastRouteData = null;
  if (requestPollTimer) {
    clearInterval(requestPollTimer);
    requestPollTimer = null;
  }

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  const tick = async () => {
    if (!activeRequestId) return;
    try {
      const data = await apiFetch(`/api/requests/${activeRequestId}`);
      const jobStatus = data.job?.Status || data.job?.status;
      const requestStatus = data.status;
      await updateRequestStatusUI(data);

      if (jobStatus && jobStatus !== lastJobStatus) {
        lastJobStatus = jobStatus;
      }

      const jobId = data?.job?.Id || data?.job?.id;
      const ratingSubmitted = jobId
        ? localStorage.getItem(`resq_rating_submitted_${jobId}`) === "1"
        : false;

      if (
        (jobStatus === "completed" && ratingSubmitted) ||
        jobStatus === "cancelled" ||
        requestStatus === "cancelled"
      ) {
        hardResetToInitial();
        return;
      }
    } catch (err) {
      mapMessage.textContent = err.message || "Nem sikerült lekérni a kérés státuszát.";
      showRequestStatus(mapMessage.textContent);
    }
  };

  tick();
  requestPollTimer = setInterval(tick, 5000);
}

requestStatusHideBtn?.addEventListener("click", () => {
  if (requestStatusCard) {
    requestStatusCard.style.display = "none";
  }
});

providerSelectClose?.addEventListener("click", () => {
  if (map) {
    map.setZoom(Math.max(map.getZoom() - 2, 11));
  }
  showProviderOverlay(null);
});

providerSelectRequest?.addEventListener("click", () => {
  if (selectedProvider) {
    requestHelpSafe(selectedProvider);
  } else {
    mapMessage.textContent = "Válassz egy autómentőt.";
  }
});

mobileListToggle?.addEventListener("click", () => {
  sidebarEl?.classList.toggle("is-open");
});

mobileHelpBtn?.addEventListener("click", () => {
  if (forceFreshStart) {
    forceFreshStart = false;
    prepareFreshStart();
    if (manualLocationInput) manualLocationInput.value = "";
    if (destinationInput) destinationInput.value = "";
    setMobileFormOpen(true);
    sidebarEl?.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const hasTrip = Number.isFinite(tripDistanceKm);
  const hasDestination = Boolean(destinationCoords);
  if (hasTrip || hasDestination) {
    mobileHomeOverride = false;
    tripUiForceForm = false;
    setMobileFormOpen(false);
    const ensureTrip = hasTrip
      ? Promise.resolve()
      : fetchTripRoute(userLocation || fallbackLocation, destinationCoords).catch(() => {});
    ensureTrip.then(() => {
      updateRequestAvailability();
      updateTripUiState(true);
      loadProviders();
    });
    return;
  }
  tripUiForceForm = true;
  setMobileFormOpen(true);
  sidebarEl?.scrollTo({ top: 0, behavior: "smooth" });
});

let sheetStartY = null;
mobileSheetGrip?.addEventListener("touchstart", (event) => {
  sheetStartY = event.touches[0]?.clientY ?? null;
});
mobileSheetGrip?.addEventListener("touchend", (event) => {
  if (sheetStartY == null) return;
  const endY = event.changedTouches[0]?.clientY ?? sheetStartY;
  const delta = endY - sheetStartY;
  if (delta < -40) {
    setSheetExpanded(true);
  } else if (delta > 40) {
    setSheetExpanded(false);
  }
  sheetStartY = null;
});
mobileSheetGrip?.addEventListener("click", () => {
  setSheetExpanded(!sheetExpanded);
});

let sheetDragStart = null;
sidebarEl?.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  if (!touch) return;
  const rect = sidebarEl.getBoundingClientRect();
  if (touch.clientY - rect.top > 60) return;
  sheetDragStart = touch.clientY;
});
sidebarEl?.addEventListener("touchend", (event) => {
  if (sheetDragStart == null) return;
  const endY = event.changedTouches[0]?.clientY ?? sheetDragStart;
  const delta = endY - sheetDragStart;
  if (delta < -40) {
    setSheetExpanded(true);
  } else if (delta > 40) {
    setSheetExpanded(false);
  }
  sheetDragStart = null;
});

document.getElementById("mobile-trip-back")?.addEventListener("click", () => {
  tripUiManualExpand = true;
  tripUiForceForm = true;
  setTripUiCollapsed(false);
  setMobileFormOpen(true);
  updateTripUiState(false);
  sidebarEl?.scrollTo({ top: 0, behavior: "smooth" });
});

requestNotesCancel?.addEventListener("click", () => {
  closeRequestNotesModal(true);
});

requestNotesSend?.addEventListener("click", () => {
  closeRequestNotesModal(false);
});

requestNotesModal?.addEventListener("click", (event) => {
  if (event.target === requestNotesModal) {
    closeRequestNotesModal(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && requestNotesModal?.style?.display === "flex") {
    closeRequestNotesModal(true);
  }
  if (event.key === "Escape" && requestRatingModal?.style?.display === "flex") {
    closeRequestRatingModal();
  }
});

destinationCalcBtn?.addEventListener("click", async () => {
  const query = destinationInput?.value?.trim();
  if (!query) {
    if (destinationStatus) {
      destinationStatus.textContent = "Adj meg egy címet a számításhoz.";
    }
    return;
  }
  if (!userLocation) {
    if (destinationStatus) {
      destinationStatus.textContent = "Nincs helymeghatározás.";
    }
    return;
  }
  if (destinationStatus) {
    destinationStatus.textContent = "Cím keresése...";
  }
  try {
    const place = await geocodeAddress(query);
    destinationCoords = { lat: place.lat, lng: place.lng };
    updateDestinationMarker(place.lat, place.lng);
    saveDestinationLocation({
      query,
      lat: place.lat,
      lng: place.lng,
      displayName: place.displayName
    });
    if (destinationStatus) {
      destinationStatus.textContent = `Cél: ${place.displayName}`;
    }
    const route = await fetchTripRoute(userLocation, destinationCoords);
    await drawTripRouteLine(userLocation, destinationCoords, true);
  if (destinationStatus && route) {
    destinationStatus.textContent = `Cél: ${place.displayName} | ${Math.round(route.distanceKm * 10) / 10} km | ~${Math.round(route.durationMinutes)} perc`;
  }
  mobileHomeOverride = false;
  tripUiForceForm = false;
  setMobileFormOpen(false);
  updateRequestAvailability();
  updateTripUiState(true);
    loadProviders();
  } catch (err) {
    if (destinationStatus) {
      destinationStatus.textContent = err.message || "Nem sikerült számolni.";
    }
  }
});

destinationClearBtn?.addEventListener("click", () => {
  resetTripCalculation();
  updateRequestAvailability();
  loadProviders();
});

requestCancelBtn?.addEventListener("click", async () => {
  if (!activeRequestId) return;
  if (["enroute", "arrived"].includes(currentJobStatus)) {
    mapMessage.textContent = "Lemondás csak ügyfélszolgálaton.";
    showToast("Lemondás csak ügyfélszolgálaton.");
    return;
  }
  if (!confirm("Biztosan lemondod a mentést?")) return;
  try {
    await apiFetch(`/api/requests/${activeRequestId}/cancel`, {
      method: "PATCH"
    });
    mapMessage.textContent = "A mentést lemondtad.";
    hardResetToInitial();
  } catch (err) {
    alert(err.message);
  }
});

requestNewBtn?.addEventListener("click", () => {
  resetTripCalculation();
  resetRequestView();
  returnToMobileHome();
  mapMessage.textContent = "Válassz új autómentőt a listából.";
  loadProviders();
});

requestChatSend?.addEventListener("click", sendRequestMessage);
requestChatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendRequestMessage();
  }
});

requestRatingSend?.addEventListener("click", async () => {
  if (!activeJobId) return;
  const stars = parseInt(requestRatingStars?.value || "0", 10);
  const comment = requestRatingComment?.value?.trim() || "";
  try {
    await apiFetch(`/api/jobs/${activeJobId}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, comment })
    });
    localStorage.setItem(`resq_rating_submitted_${activeJobId}`, "1");
    if (requestRatingPanel) {
      requestRatingPanel.style.display = "none";
    }
    mapMessage.textContent = "Köszönjük az értékelést!";
  } catch (err) {
    alert(err.message);
  }
});

requestRatingModalSend?.addEventListener("click", async () => {
  if (!activeJobId) return;
  const stars = parseInt(requestRatingModalStars?.value || "0", 10);
  const comment = requestRatingModalComment?.value?.trim() || "";
  try {
    await apiFetch(`/api/jobs/${activeJobId}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, comment })
    });
    localStorage.setItem(`resq_rating_submitted_${activeJobId}`, "1");
    closeRequestRatingModal();
    if (requestRatingPanel) {
      requestRatingPanel.style.display = "none";
    }
    mapMessage.textContent = "Köszönjük az értékelést!";
    hardResetToInitial();
  } catch (err) {
    alert(err.message);
  }
});

requestRatingModalLater?.addEventListener("click", () => {
  closeRequestRatingModal();
});

requestRatingModal?.addEventListener("click", (event) => {
  if (event.target === requestRatingModal) {
    closeRequestRatingModal();
  }
});

function initMap(lat, lng) {
  const maxBounds = [
    [-85, -180],
    [85, 180]
  ];
  map = L.map("map", { maxBounds, maxBoundsViscosity: 1.0, minZoom: 7 }).setView([lat, lng], 13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    minZoom: 7,
    noWrap: true,
    worldCopyJump: true,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  const userIcon = L.divIcon({
    className: "user-marker",
    html: "<div class=\"marker marker-user\"><span>👤</span></div>",
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
  userMarker = L.marker([lat, lng], { icon: userIcon })
    .addTo(map)
    .bindPopup("Te itt vagy", {
      className: "map-user-popup",
      offset: [0, -10]
    });
  map.on("moveend zoomend", () => {
    updateMapCenterButtonState();
  });
  const button = ensureMapCenterButton();
  if (button && !button.dataset.bound) {
    button.addEventListener("click", centerMapToUser);
    button.dataset.bound = "1";
  }
  updateMapCenterButtonState();
  updateRadiusCircle();
}

function updateRadiusCircle() {
  if (!map || !userLocation) return;
  const radiusKm = parseFloat(radiusInput.value || "20");
  if (!Number.isFinite(radiusKm)) return;
  const radiusMeters = Math.max(100, radiusKm * 1000);
  if (!radiusCircle) {
    radiusCircle = L.circle([userLocation.lat, userLocation.lng], {
      radius: radiusMeters,
      color: "#0f766e",
      weight: 1,
      fillColor: "#0f766e",
      fillOpacity: 0.08
    }).addTo(map);
  } else {
    radiusCircle.setLatLng([userLocation.lat, userLocation.lng]);
    radiusCircle.setRadius(radiusMeters);
  }
}

function clearProviders() {
  providerMarkers.forEach((marker) => marker.remove());
  providerMarkers = [];
  clearSelectedProviderNameTooltip();
  providersList.innerHTML = "";
}

function providerCard(provider) {
  const wrapper = document.createElement("div");
  wrapper.className = "ride-card";
  wrapper.dataset.id = String(provider.id);
  const hasTrip = Number.isFinite(tripDistanceKm);
  const usedDistance = hasTrip ? tripDistanceKm : provider.distanceKm;
  const etaMinutes = estimateEtaMinutes(usedDistance);
  const estimate = estimatePrice(usedDistance, provider);
  wrapper.innerHTML = `
    <div class="ride-icon">🚗</div>
    <div class="ride-body">
      <div class="ride-title">${provider.name}</div>
      ${
        hasTrip
          ? `<div class="ride-sub">Hozzád: ${provider.distanceKm} km · Érkezés: ${formatEta(
              estimateEtaMinutes(provider.distanceKm)
            )}</div>
             <div class="ride-sub">Fuvar: ${Math.round(tripDistanceKm * 10) / 10} km · Ár: ${formatCurrency(
               estimate
             )}</div>`
          : `<div class="ride-sub">Add meg a célcímet a részletekhez</div>`
      }
    </div>
    <div class="ride-price">${hasTrip ? formatCurrency(estimate) : ""}</div>
  `;
  if (selectedProvider && String(selectedProvider.id) === String(provider.id)) {
    wrapper.classList.add("selected");
  }
  wrapper.addEventListener("click", (event) => {
    if (event.target?.closest("button")) return;
    showProviderOverlay(provider);
  });
  return wrapper;
}

async function loadProviders() {
  if (!userLocation) {
    return;
  }
  if (rideFocusActive) {
    return;
  }
  clearProviders();
  const radiusKm = parseFloat(radiusInput.value || "20");
  const capability = capabilitySelect.value;
  try {
    const providers = await apiFetch(
      `/api/providers/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radiusKm=${radiusKm}&capability=${encodeURIComponent(
        capability
      )}`
    );

    providers.sort((a, b) => a.distanceKm - b.distanceKm);

    if (providersHeader) {
      providersHeader.textContent = `Választható mentők (${providers.length})`;
    }
    if (providersHint) {
      providersHint.textContent = Number.isFinite(tripDistanceKm)
        ? "Koppints a mentőre a részletekhez."
        : "Add meg a célcímet, hogy lásd az árat és az érkezési időt.";
    }

    providers.forEach((provider) => {
      const truckIcon = L.divIcon({
        className: "truck-marker",
        html: "<div class=\"marker marker-provider\"><span>🚗</span></div>",
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      const marker = L.marker([provider.lat, provider.lng], { icon: truckIcon }).addTo(map);
      marker.providerId = provider.id;
      marker.on("click", () => {
        showProviderOverlay(provider);
      });
      providerMarkers.push(marker);

      const card = providerCard(provider);
      providersList.appendChild(card);
    });

    if (providers.length === 0) {
      providersList.innerHTML =
        "<p class=\"notice\">Nincs megjeleníthető online autómentő a kiválasztott területen. (Lehet, hogy az autómentők nem osztották meg a pozíciójukat.)</p>";
      if (providersHeader) {
        providersHeader.textContent = "Mentők listája";
      }
    }
    updateRequestAvailability();
  } catch (err) {
    providersList.innerHTML = `<p class="notice">${err.message}</p>`;
  }
}

async function requestHelp(provider) {
  return requestHelpSafe(provider);
}

async function reverseGeocodeAddress(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lng)}`;
  const response = await fetch(url, {
    headers: { "Accept-Language": "hu" }
  });
  if (!response.ok) throw new Error("Nem sikerült címet lekérni a helyzethez.");
  const data = await response.json();
  const displayName = String(data?.display_name || "").trim();
  if (!displayName) throw new Error("Ehhez a ponthoz nem található cím.");
  return displayName;
}

async function fillManualAddressFromCoords(lat, lng) {
  if (!manualLocationInput) return;
  try {
    const address = await reverseGeocodeAddress(lat, lng);
    manualLocationInput.value = address;
    saveManualLocation({ query: address, lat, lng });
    if (manualLocationStatus) {
      manualLocationStatus.textContent = "A pontos cím automatikusan beírva.";
    }
  } catch {
    manualLocationInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    saveManualLocation({ query: manualLocationInput.value, lat, lng });
    if (manualLocationStatus) {
      manualLocationStatus.textContent = "Cím nem található, koordináta beírva.";
    }
  }
}

function openRequestRatingModal() {
  if (!requestRatingModal) return;
  requestRatingModal.style.display = "flex";
}

function closeRequestRatingModal() {
  if (!requestRatingModal) return;
  requestRatingModal.style.display = "none";
}

async function requestHelpSafe(provider) {
  const providerId = Number(provider?.id);
  const role = getUserRole();
  if (!role) {
    mapMessage.textContent = "A mentés kéréséhez jelentkezz be.";
    return;
  }
  if (role !== "User") {
    mapMessage.textContent = "Ezt csak felhasznalok kerhetik.";
    return;
  }
  if (!Number.isInteger(providerId) || providerId <= 0) {
    mapMessage.textContent = "Válassz egy autómentőt.";
    return;
  }
  if (!userLocation) {
    mapMessage.textContent = "Add meg, honnan induljunk.";
    return;
  }
  if (!Number.isFinite(tripDistanceKm)) {
    mapMessage.textContent = "Adj meg célcímet a kereseshez.";
    showToast("Adj meg célcímet a kereseshez.");
    return;
  }

  const modalResult = await openRequestNotesModal();
  if (modalResult.cancelled) {
    mapMessage.textContent = "Kérés megszakítva.";
    return;
  }
  const notes = modalResult.notes || "";
  const destinationLabel =
    destinationInput?.value?.trim() ||
    loadDestinationLocation()?.displayName ||
    null;
  const notesWithDestination = destinationLabel
    ? `${notes}${notes ? "\n" : ""}__DESTINATION__:${destinationLabel}`
    : notes;
  const estimatedPrice = estimatePrice(tripDistanceKm, provider);

  try {
    if (providerSelectRequest) {
      providerSelectRequest.disabled = true;
      providerSelectRequest.textContent = "Küldés...";
    }

    mapMessage.textContent = "Kérés küldése...";

    const created = await apiFetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupLat: userLocation.lat,
        pickupLng: userLocation.lng,
        pickupAddress: manualLocationInput?.value?.trim() || null,
        destinationLat: Number.isFinite(destinationCoords?.lat) ? destinationCoords.lat : null,
        destinationLng: Number.isFinite(destinationCoords?.lng) ? destinationCoords.lng : null,
        destinationAddress: destinationLabel || null,
        problemType: "breakdown",
        notes: notesWithDestination,
        selectedProviderId: providerId,
        estimatedPrice: Number.isFinite(estimatedPrice) ? estimatedPrice : null
      })
    });

    mapMessage.textContent = "Kérés elküldve. Várjuk az autómentőt.";
    if (created?.id) {
      startRequestPolling(created.id);
    }
  } catch (err) {
    mapMessage.textContent = err.message || "Nem sikerült elküldeni a kérést.";
  } finally {
    updateRequestAvailability();
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    providersList.innerHTML = "<p class=\"notice\">A böngésző nem támogatja a helymeghatározást. Budapestet mutatjuk.</p>";
    applyUserLocation(fallbackLocation.lat, fallbackLocation.lng, null);
    return;
  }
  const isSecureContext =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (!isSecureContext) {
    providersList.innerHTML =
      "<p class=\"notice\">A pontos helymeghatározáshoz HTTPS (vagy localhost) szükséges. Budapestet mutatjuk.</p>";
    applyUserLocation(fallbackLocation.lat, fallbackLocation.lng, null);
    return;
  }

  const updateUserLocation = (lat, lng, accuracy) => {
    if (manualLocationOverride) return;
    applyUserLocation(lat, lng, accuracy);
  };

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      updateUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      await fillManualAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      providersList.innerHTML = "<p class=\"notice\">Nem sikerült helymeghatározni. Budapestet mutatjuk.</p>";
      applyUserLocation(fallbackLocation.lat, fallbackLocation.lng, null);
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
  );

  if (userWatchId == null) {
    userWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }
}

refreshBtn.addEventListener("click", loadProviders);
applyManualLocationBtn?.addEventListener("click", applyManualLocation);
manualLocationInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyManualLocation();
  }
});
useGpsBtn?.addEventListener("click", () => {
  manualLocationOverride = false;
  clearManualLocation();
  if (manualLocationStatus) {
    manualLocationStatus.textContent = "GPS aktiv.";
  }
  showToast("GPS helyzet frissitese...");
  locateUser();
});
radiusInput.addEventListener("input", () => {
  updateRadiusCircle();
});
radiusInput.addEventListener("change", () => {
  updateRadiusCircle();
  loadProviders();
});

const savedManualLocation = loadManualLocation();
if (savedManualLocation) {
  manualLocationOverride = true;
  if (manualLocationInput) {
    manualLocationInput.value = savedManualLocation.query || `${savedManualLocation.lat}, ${savedManualLocation.lng}`;
  }
  if (manualLocationStatus) {
    manualLocationStatus.textContent = "Mentett cím betöltve.";
  }
  applyUserLocation(savedManualLocation.lat, savedManualLocation.lng, null);
} else {
  locateUser();
}

if (!Number.isFinite(tripDistanceKm)) {
  setMobileFormOpen(false);
}
updateMobileHomeState();

window.addEventListener("resize", () => {
  updateMobileHomeState();
  updateTripUiState(false);
});

const savedDestinationLocation = loadDestinationLocation();
if (savedDestinationLocation) {
  destinationCoords = {
    lat: savedDestinationLocation.lat,
    lng: savedDestinationLocation.lng
  };
  if (destinationInput) {
    destinationInput.value =
      savedDestinationLocation.query || `${savedDestinationLocation.lat}, ${savedDestinationLocation.lng}`;
  }
  updateDestinationMarker(savedDestinationLocation.lat, savedDestinationLocation.lng);
  if (destinationStatus) {
    destinationStatus.textContent = savedDestinationLocation.displayName
      ? `Cél: ${savedDestinationLocation.displayName}`
      : "Celpont beallitva.";
  }
  fetchTripRoute(userLocation || fallbackLocation, destinationCoords)
    .then(() => {
      updateRequestAvailability();
      updateTripUiState(true);
      if (userLocation) {
        drawTripRouteLine(userLocation, destinationCoords);
      }
    })
    .catch(() => {});
}

try {
  const existingId = Number.parseInt(localStorage.getItem("resq_active_request") || "", 10);
  if (Number.isInteger(existingId) && existingId > 0 && getToken()) {
    startRequestPolling(existingId);
  }
} catch {}
