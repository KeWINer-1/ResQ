const statusEl = document.getElementById("provider-status");
const locationMessageEl = document.getElementById("provider-location-message");
const onlinePill = document.getElementById("online-pill");
const onlinePillMobile = document.getElementById("online-pill-mobile");
const toggleBtn = document.getElementById("toggle-online");
const toggleBtnMobile = document.getElementById("toggle-online-mobile");
const mobileStatusText = document.getElementById("provider-mobile-status");
const providerUseCurrentLocationBtn = document.getElementById("provider-use-current-location");
const providerManualAddressInput = document.getElementById("provider-manual-address");
const providerManualAddressBtn = document.getElementById("provider-set-manual-address");
const providerManualAddressHint = document.getElementById("provider-manual-address-hint");
const providerLocationSelectedEl = document.getElementById("provider-location-selected");
const providerChatHint = document.getElementById("provider-chat-hint");
const providerChatBox = document.getElementById("provider-chat-box");
const providerChatInput = document.getElementById("provider-chat-input");
const providerChatSend = document.getElementById("provider-chat-send");
const providerChatCard = providerChatBox?.closest(".card") || null;
const providerMapEl = document.getElementById("provider-map");
const providerMapCenterBtn = document.getElementById("provider-map-center-btn");
const statusToast = document.getElementById("status-toast");
const sidebarEl = document.querySelector(".sidebar");

const providerRequestTitle = document.getElementById("provider-request-title");
const providerRequestStatusPill = document.getElementById("provider-request-status-pill");
const providerRequestSub = document.getElementById("provider-request-sub");
const providerRequestDistance = document.getElementById("provider-request-distance");
const providerRequestEta = document.getElementById("provider-request-eta");
const providerRequestPrice = document.getElementById("provider-request-price");
const providerRequestMetrics = document.querySelector("#provider-request-card .request-metrics");
const providerRequestAddress = document.getElementById("provider-request-address");
const providerRequestNotes = document.getElementById("provider-request-notes");
const providerRequestActions = document.getElementById("provider-request-actions");
const providerRequestProgress = document.getElementById("provider-request-progress");
const providerRequestAccept = document.getElementById("provider-request-accept");
const providerRequestReject = document.getElementById("provider-request-reject");
const providerRequestEnroute = document.getElementById("provider-request-enroute");
const providerRequestArrived = document.getElementById("provider-request-arrived");
const providerRequestCompleted = document.getElementById("provider-request-completed");
const providerRequestCancel = document.getElementById("provider-request-cancel");
const providerRequestChat = document.getElementById("provider-request-chat");
const providerRequestChatCta = document.getElementById("provider-request-chat-cta");

const providerOverlay = document.getElementById("provider-request-overlay");
const providerOverlayAvatar = document.getElementById("provider-overlay-avatar");
const providerOverlayTitle = document.getElementById("provider-overlay-title");
const providerOverlaySub = document.getElementById("provider-overlay-sub");
const providerOverlayDistance = document.getElementById("provider-overlay-distance");
const providerOverlayEta = document.getElementById("provider-overlay-eta");
const providerOverlayPrice = document.getElementById("provider-overlay-price");
const providerOverlayAddress = document.getElementById("provider-overlay-address");
const providerOverlayActions = document.getElementById("provider-overlay-actions");
const providerOverlayProgress = document.getElementById("provider-overlay-progress");
const providerOverlayAccept = document.getElementById("provider-overlay-accept");
const providerOverlayReject = document.getElementById("provider-overlay-reject");
const providerOverlayEnroute = document.getElementById("provider-overlay-enroute");
const providerOverlayArrived = document.getElementById("provider-overlay-arrived");
const providerOverlayCompleted = document.getElementById("provider-overlay-completed");
const providerOverlayCancel = document.getElementById("provider-overlay-cancel");
const providerOverlayChat = document.getElementById("provider-overlay-chat");
const providerOverlayChatIcon = document.getElementById("provider-overlay-chat-icon");
const providerChatDot = document.getElementById("provider-chat-dot");
const providerOverlayClose = document.getElementById("provider-overlay-close");

const mobileListToggle = document.getElementById("mobile-list-toggle");
const mobileSheetGrip = document.getElementById("mobile-sheet-grip");
const providerMobileBack = document.getElementById("provider-mobile-back");

const providerChatModal = document.getElementById("provider-chat-modal");
const providerChatModalList = document.getElementById("provider-chat-modal-list");
const providerChatModalInput = document.getElementById("provider-chat-modal-input");
const providerChatModalSend = document.getElementById("provider-chat-modal-send");
const providerChatModalClose = document.getElementById("provider-chat-modal-close");
const providerChatModalCancel = document.getElementById("provider-chat-modal-cancel");

const currentRole = getUserRole();
if (!currentRole) {
  window.location.href = "/auth";
}
if (currentRole && currentRole !== "Provider") {
  window.location.href = currentRole === "Admin" ? "/admin" : "/map";
}

let isOnline = false;
let locationWatchId = null;
let lastLocationSentAt = 0;
let lastLocationCoords = null;
let activeChatRequestId = null;
let chatPollTimer = null;
let map = null;
let providerMarker = null;
let requestMarker = null;
let destinationMarker = null;
let activeRouteLine = null;
let activeTowRouteLine = null;
let providerCoords = null;
let activeRequest = null;
let activeRequestId = null;
let requestCache = new Map();
let requestsPollTimer = null;
let lastProviderJobStatus = null;
let lastProviderRequestId = null;
let providerProfile = null;
let sheetExpanded = false;
let manualLocationOverride = false;
let lastRenderedRequestId = null;
let userInteractedAt = 0;
let lastAutoFitAt = 0;
let lastAutoFitRequestId = null;
let didInitialProviderCenter = false;
let overlayDragStart = null;
let overlayExpanded = false;
let lastChatMessageId = null;
let lastChatNotifiedId = null;
let lastChatSeenId = null;
const fallbackLocation = { lat: 47.4979, lng: 19.0402 };
const manualProviderLocationStorageKey = "resq_manual_provider_location";
const activeProviderRequestStorageKey = "resq_provider_active_request";
const routeCache = new Map();
function jobStatusLabel(status) {
  if (!status) return null;
  const labels = {
    new: "Új kérés",
    accepted: "Elfogadva",
    enroute: "Úton van",
    arrived: "Megérkezett",
    completed: "Kész",
    cancelled: "Lemondva"
  };
  return labels[status] || status;
}

function showToast(message) {
  if (!statusToast) return;
  statusToast.textContent = message;
  statusToast.classList.add("show");
  setTimeout(() => {
    statusToast.classList.remove("show");
  }, 3500);
}

function notifyProvider(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function setLocationMessage(message) {
  if (!locationMessageEl) return;
  locationMessageEl.textContent = message || "";
}

function setManualAddressHint(message) {
  if (!providerManualAddressHint) return;
  providerManualAddressHint.textContent = message || "";
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return "-";
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${Math.round(distanceKm * 10) / 10} km`;
}

function formatEta(minutes) {
  if (!Number.isFinite(minutes)) return "-";
  if (minutes < 1) return "1 perc";
  if (minutes < 60) return `${Math.round(minutes)} perc`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} ora`;
  return `${hours} ora ${mins} perc`;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

function estimateEtaMinutes(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  const speedKmh = distanceKm < 3 ? 25 : 40;
  const minutes = (distanceKm / speedKmh) * 60;
  return Math.max(3, Math.round(minutes));
}

function estimatePrice(distanceKm, profile) {
  const baseFee = Number(profile?.BaseFee ?? profile?.baseFee);
  const perKmFee = Number(profile?.PerKmFee ?? profile?.perKmFee);
  if (!Number.isFinite(distanceKm) || !Number.isFinite(baseFee) || !Number.isFinite(perKmFee)) {
    return null;
  }
  return baseFee + perKmFee * distanceKm;
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

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null && "value" in value) {
    const num = Number(value.value);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function shouldSendLocation(lat, lng) {
  const now = Date.now();
  if (!lastLocationCoords) return true;
  const distanceKm = haversineKm(lat, lng, lastLocationCoords.lat, lastLocationCoords.lng);
  if (distanceKm > 0.05) return true;
  if (now - lastLocationSentAt > 15000) return true;
  return false;
}
function saveManualProviderLocation(lat, lng) {
  try {
    localStorage.setItem(
      manualProviderLocationStorageKey,
      JSON.stringify({ lat, lng })
    );
  } catch {}
}

function clearManualProviderLocation() {
  try {
    localStorage.removeItem(manualProviderLocationStorageKey);
  } catch {}
}

function loadManualProviderLocation() {
  try {
    const raw = localStorage.getItem(manualProviderLocationStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveActiveProviderRequest(requestId) {
  try {
    if (requestId) {
      localStorage.setItem(activeProviderRequestStorageKey, String(requestId));
    } else {
      localStorage.removeItem(activeProviderRequestStorageKey);
    }
  } catch {}
}

function loadActiveProviderRequest() {
  try {
    const raw = localStorage.getItem(activeProviderRequestStorageKey);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
  } catch {
    return null;
  }
}

function setSheetExpanded(expanded) {
  sheetExpanded = expanded;
  document.body.classList.toggle("sheet-expanded", expanded);
}

function initMap(lat, lng) {
  if (!providerMapEl || map) return;
  const maxBounds = [
    [-85, -180],
    [85, 180]
  ];
  map = L.map("provider-map", { maxBounds, maxBoundsViscosity: 1.0, minZoom: 7 }).setView(
    [lat, lng],
    13
  );
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    minZoom: 7,
    noWrap: true,
    worldCopyJump: true,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  map.on("zoomstart", () => {
    userInteractedAt = Date.now();
  });
  map.on("dragstart", () => {
    userInteractedAt = Date.now();
  });
  map.on("moveend zoomend", updateProviderMapCenterButtonState);

  providerMarker = L.marker([lat, lng], { icon: createProviderIcon() })
    .addTo(map)
    .bindPopup("Saját pozíciód", { className: "map-user-popup" });

  updateProviderMapCenterButtonState();
}

function createProviderIcon() {
  return L.divIcon({
    className: "provider-marker",
    html: "<div class=\"marker marker-user\"><span>\ud83d\udc64</span></div>",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
}

function createRequestIcon() {
  return L.divIcon({
    className: "request-marker",
    html: "<div class=\"marker marker-provider\"><span>\ud83d\ude97</span></div>"
  });
}

function createDestinationIcon() {
  return L.divIcon({
    className: "destination-marker",
    html: "<div class=\"marker marker-destination\"><span>\ud83c\udfc1</span></div>"
  });
}

function updateProviderMarker(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  providerCoords = { lat, lng };
  if (!map) {
    initMap(lat, lng);
    return;
  }
  if (!providerMarker) {
    providerMarker = L.marker([lat, lng], { icon: createProviderIcon() })
      .addTo(map)
      .bindPopup("Saját pozíciód", { className: "map-user-popup" });
  } else {
    providerMarker.setLatLng([lat, lng]);
  }
  if (!didInitialProviderCenter && map) {
    map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: false });
    didInitialProviderCenter = true;
  }
  updateProviderMapCenterButtonState();
  refreshActiveRoute();
}

function isProviderCenteredOnMap() {
  if (!map || !providerCoords) return false;
  const center = map.getCenter();
  const distanceKm = haversineKm(center.lat, center.lng, providerCoords.lat, providerCoords.lng);
  return distanceKm <= 0.05;
}

function updateProviderMapCenterButtonState() {
  if (!providerMapCenterBtn) return;
  providerMapCenterBtn.classList.toggle("is-centered", isProviderCenteredOnMap());
}

function centerMapToProvider() {
  if (!map || !providerCoords) return;
  const targetZoom = Math.max(map.getZoom(), 14);
  map.setView([providerCoords.lat, providerCoords.lng], targetZoom, { animate: true });
  updateProviderMapCenterButtonState();
}

function clearMapOverlays() {
  if (requestMarker) {
    requestMarker.remove();
    requestMarker = null;
  }
  if (destinationMarker) {
    destinationMarker.remove();
    destinationMarker = null;
  }
  if (activeRouteLine) {
    activeRouteLine.remove();
    activeRouteLine = null;
  }
  if (activeTowRouteLine) {
    activeTowRouteLine.remove();
    activeTowRouteLine = null;
  }
}

function setRequestMarker(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !map) return;
  if (!requestMarker) {
    requestMarker = L.marker([lat, lng], { icon: createRequestIcon() }).addTo(map);
  } else {
    requestMarker.setLatLng([lat, lng]);
  }
}

function setDestinationMarker(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !map) return;
  if (!destinationMarker) {
    destinationMarker = L.marker([lat, lng], { icon: createDestinationIcon() }).addTo(map);
  } else {
    destinationMarker.setLatLng([lat, lng]);
  }
}

function getRequestStatusValue(req) {
  return req?.JobStatus || req?.Status || null;
}

function getDestinationCoords(req) {
  const lat = toNumber(
    req?.DropoffLat ??
      req?.DestinationLat ??
      req?.destinationLat ??
      req?.dropoffLat ??
      null
  );
  const lng = toNumber(
    req?.DropoffLng ??
      req?.DestinationLng ??
      req?.destinationLng ??
      req?.dropoffLng ??
      null
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function getDestinationAddress(req) {
  return (
    req?.DropoffAddress ||
    req?.DestinationAddress ||
    req?.destinationAddress ||
    req?.dropoffAddress ||
    null
  );
}

function buildRequestAddress(req) {
  const pickupLat = toNumber(req?.PickupLat ?? req?.pickupLat ?? null);
  const pickupLng = toNumber(req?.PickupLng ?? req?.pickupLng ?? null);
  const pickupAddress =
    req?.PickupAddress ||
    req?.pickupAddress ||
    (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
      ? `${pickupLat.toFixed(5)}, ${pickupLng.toFixed(5)}`
      : null);
  const destinationAddress = getDestinationAddress(req);
  if (pickupAddress && destinationAddress) {
    return `Felvetel: ${pickupAddress} | Cel: ${destinationAddress}`;
  }
  if (pickupAddress) return `Felvetel: ${pickupAddress}`;
  if (Number.isFinite(Number(req?.PickupLat)) && Number.isFinite(Number(req?.PickupLng))) {
    return `Felvetel: ${Number(req.PickupLat).toFixed(5)}, ${Number(req.PickupLng).toFixed(5)}`;
  }
  return "";
}

function buildOverlayAddressHtml(req) {
  const pickupLat = toNumber(req?.PickupLat ?? req?.pickupLat ?? null);
  const pickupLng = toNumber(req?.PickupLng ?? req?.pickupLng ?? null);
  const pickupAddress =
    req?.PickupAddress ||
    req?.pickupAddress ||
    (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
      ? `${pickupLat.toFixed(5)}, ${pickupLng.toFixed(5)}`
      : null);
  const destinationAddress = getDestinationAddress(req);

  const lines = [];
  if (pickupAddress) {
    const safeValue = escapeHtml(pickupAddress);
    const copyValue = encodeURIComponent(pickupAddress);
    lines.push(
      `<div class="address-line">
        <span class="address-label">Felvétel</span>
        <span class="address-value">${safeValue}</span>
        <button class="address-copy" type="button" data-copy="${copyValue}" aria-label="Felvétel cím másolása">Másolás</button>
      </div>`
    );
  }
  if (destinationAddress) {
    const safeValue = escapeHtml(destinationAddress);
    const copyValue = encodeURIComponent(destinationAddress);
    lines.push(
      `<div class="address-line">
        <span class="address-label">Cél</span>
        <span class="address-value">${safeValue}</span>
        <button class="address-copy" type="button" data-copy="${copyValue}" aria-label="Cél cím másolása">Másolás</button>
      </div>`
    );
  }
  if (lines.length === 0) {
    return "<span class=\"address-empty\">Nincs cím megadva.</span>";
  }
  return lines.join("");
}
function setRequestUiDefaults() {
  if (providerRequestTitle) {
    providerRequestTitle.textContent = isOnline
      ? "Hamarosan feladat várható."
      : "Legyél online a feladatokért!";
  }
  if (providerRequestStatusPill) providerRequestStatusPill.textContent = "Várakozás";
  if (providerRequestStatusPill) {
    providerRequestStatusPill.style.display = isOnline ? "inline-flex" : "none";
  }
  if (providerRequestSub) providerRequestSub.textContent = "";
  if (providerRequestDistance) providerRequestDistance.textContent = "-";
  if (providerRequestEta) providerRequestEta.textContent = "-";
  if (providerRequestPrice) providerRequestPrice.textContent = "-";
  if (providerRequestAddress) providerRequestAddress.textContent = "";
  if (providerRequestNotes) providerRequestNotes.textContent = "";
  if (providerRequestMetrics) providerRequestMetrics.style.display = "none";
  if (providerRequestActions) providerRequestActions.style.display = "none";
  if (providerRequestProgress) providerRequestProgress.style.display = "none";
  if (providerRequestChatCta) providerRequestChatCta.style.display = "none";
  if (providerChatCard) providerChatCard.style.display = "none";
  setProviderOverlayVisible(false);
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&zoom=16`;
    const response = await fetch(url, {
      headers: { "Accept-Language": "hu" }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const displayName = String(data?.display_name || "").trim();
    return displayName || null;
  } catch {
    return null;
  }
}

async function geocodeAddress(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      query
    )}&limit=1&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "Accept-Language": "hu" }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : null;
    if (!result) return null;
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const displayName = String(result.display_name || "").trim();
    return { lat, lng, displayName: displayName || query };
  } catch {
    return null;
  }
}

async function setLocationSelectedText(lat, lng, label = "Kijelölt hely", addressOverride = null) {
  const fallbackText = `${label}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  if (providerLocationSelectedEl) {
    providerLocationSelectedEl.textContent = fallbackText;
  }
  if (addressOverride) {
    if (providerLocationSelectedEl) {
      providerLocationSelectedEl.textContent = `${label}: ${addressOverride}`;
    }
    return;
  }
  const address = await reverseGeocode(lat, lng);
  if (providerLocationSelectedEl) {
    providerLocationSelectedEl.textContent = address
      ? `${label}: ${address}`
      : fallbackText;
  }
}

async function applyManualLocation(lat, lng, addressLabel) {
  manualLocationOverride = true;
  saveManualProviderLocation(lat, lng);
  stopLocationUpdates();
  await setLocationSelectedText(lat, lng, "Kijelölt hely", addressLabel);
  updateProviderMarker(lat, lng);
  if (map) {
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
  }
  try {
    await sendLocation(lat, lng);
    lastLocationSentAt = Date.now();
    lastLocationCoords = { lat, lng };
    setLocationMessage("Kézi pozíció elmentve.");
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerult elkuldeni a kezi poziciot.");
  }
}

async function handleManualAddressSubmit() {
  const rawAddress = providerManualAddressInput?.value?.trim() || "";
  if (!rawAddress) {
    setManualAddressHint("Adj meg egy címet a kereséshez.");
    return;
  }
  setManualAddressHint("Cím keresése...");
  const result = await geocodeAddress(rawAddress);
  if (!result) {
    setManualAddressHint("Nem találtunk címet. Add meg pontosabban.");
    setLocationMessage("A cím nem található.");
    return;
  }
  await applyManualLocation(result.lat, result.lng, result.displayName);
  setManualAddressHint("Cím alapján mentett pozíció aktív.");
}

function setProviderOverlayVisible(visible) {
  if (!providerOverlay) return;
  document.body.classList.toggle("provider-request-open", visible);
  if (visible) {
    providerOverlay.style.display = "block";
    setProviderOverlayExpanded(false);
    requestAnimationFrame(() => {
      providerOverlay.classList.add("is-visible");
    });
    return;
  }
  providerOverlay.classList.remove("is-visible");
  const hideDelay = 320;
  setTimeout(() => {
    if (!providerOverlay.classList.contains("is-visible")) {
      providerOverlay.style.display = "none";
    }
  }, hideDelay);
}

function setProviderOverlayExpanded(expanded) {
  overlayExpanded = expanded;
  if (!providerOverlay) return;
  providerOverlay.classList.toggle("is-expanded", expanded);
}

function updateRequestUi(request) {
  activeRequest = request;
  activeRequestId = request?.Id ? String(request.Id) : null;
  if (!request) {
    setRequestUiDefaults();
    clearMapOverlays();
    lastRenderedRequestId = null;
    return;
  }

  if (activeRequestId && activeRequestId !== lastRenderedRequestId) {
    clearMapOverlays();
    lastRenderedRequestId = activeRequestId;
    userInteractedAt = 0;
    lastAutoFitAt = 0;
    lastAutoFitRequestId = null;
  }

  const statusValue = getRequestStatusValue(request) || "new";
  const statusLabel = jobStatusLabel(statusValue) || statusValue;
  const problemType = request.ProblemType || request.problemType || "ismeretlen";

  if (providerRequestTitle) providerRequestTitle.textContent = `Aktív kérés #${request.Id}`;
  if (providerRequestStatusPill) providerRequestStatusPill.textContent = statusLabel;
  if (providerRequestStatusPill) providerRequestStatusPill.style.display = "inline-flex";
  if (providerRequestSub) providerRequestSub.textContent = `${problemType} | ${statusLabel}`;
  if (providerRequestMetrics) providerRequestMetrics.style.display = "grid";
  if (providerRequestAddress) providerRequestAddress.textContent = buildRequestAddress(request);

  const noteText = request.Notes || request.notes || "";
  const destinationCoords = getDestinationCoords(request);
  const destinationNote = destinationCoords ? "" : "Celpont nincs megadva.";
  if (providerRequestNotes) {
    providerRequestNotes.textContent = noteText
      ? `Megjegyzes: ${noteText}`
      : destinationNote;
  }

  const isNew = statusValue === "new" || statusValue === "pending" || statusValue === "";
  const isActive = ["accepted", "enroute", "arrived"].includes(statusValue);
  const isDone = ["completed", "cancelled"].includes(statusValue);

  if (providerRequestActions) {
    providerRequestActions.style.display = isNew ? "flex" : "none";
  }
  if (providerRequestProgress) {
    providerRequestProgress.style.display = isActive ? "flex" : "none";
  }
  if (providerRequestChat) {
    providerRequestChat.style.display = request ? "inline-flex" : "none";
  }
  if (providerRequestChatCta) {
    providerRequestChatCta.style.display = request ? "flex" : "none";
  }
  if (providerChatCard) {
    providerChatCard.style.display = "block";
  }

  setProviderOverlayVisible(true);
  if (providerOverlayAvatar) providerOverlayAvatar.textContent = `#${request.Id}`;
  if (providerOverlayTitle) providerOverlayTitle.textContent = `Kérés #${request.Id}`;
  if (providerOverlaySub) providerOverlaySub.textContent = statusLabel;
  if (providerOverlayAddress) {
    providerOverlayAddress.innerHTML = buildOverlayAddressHtml(request);
  }

  if (providerOverlayActions) {
    providerOverlayActions.style.display = isNew ? "flex" : "none";
  }
  if (providerOverlayProgress) {
    providerOverlayProgress.style.display = isActive ? "flex" : "none";
  }
  if (isDone && providerOverlayProgress) {
    providerOverlayProgress.style.display = "none";
  }

  if (activeRequestId && String(activeRequestId) !== String(activeChatRequestId || "")) {
    selectRequest(activeRequestId);
  }

  refreshActiveRoute();
}

function getMyUserId() {
  const token = getToken();
  const data = decodeJwtPayload(token);
  return data?.userId || null;
}

function renderChatMessages(messages, targetEl = providerChatBox) {
  if (!targetEl) return;
  const myUserId = getMyUserId();
  if (!messages || messages.length === 0) {
    targetEl.innerHTML = "<p class=\"notice\">Nincs üzenet.</p>";
    return;
  }

  targetEl.innerHTML = messages
    .map((msg) => {
      const isMe = myUserId && msg.SenderUserId === myUserId;
      const roleClass = isMe ? "me" : "admin";
      const sender =
        msg.SenderProviderName || msg.SenderEmail || (msg.SenderRole || "User");
      const time = msg.CreatedAt
        ? new Date(msg.CreatedAt).toLocaleTimeString("hu-HU", {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";
      return `<div class="chat-line ${roleClass}">
        <div class="chat-meta">${escapeHtml(sender)}${time ? ` · ${escapeHtml(time)}` : ""}</div>
        <div class="chat-bubble">${escapeHtml(msg.Body)}</div>
      </div>`;
    })
    .join("");
  targetEl.scrollTop = targetEl.scrollHeight;
}

function setChatUnread(hasUnread) {
  if (!providerChatDot) return;
  providerChatDot.style.display = hasUnread ? "inline-flex" : "none";
}

async function loadChatMessages() {
  if (!activeChatRequestId) return;
  try {
    const data = await apiFetch(`/api/requests/${activeChatRequestId}/messages`);
    const messages = data.messages || [];
    renderChatMessages(messages, providerChatBox);
    renderChatMessages(messages, providerChatModalList);
    const lastMessage = messages[messages.length - 1];
    const messageKey = lastMessage?.Id || lastMessage?.CreatedAt || null;
    if (messageKey) {
      lastChatMessageId = messageKey;
      const myUserId = getMyUserId();
      const isFromMe = myUserId && lastMessage.SenderUserId === myUserId;
      const isModalOpen = providerChatModal?.style.display === "flex";
      if (!isFromMe) {
        if (lastChatSeenId !== messageKey) {
          setChatUnread(true);
        }
        if (!isModalOpen && lastChatNotifiedId !== messageKey) {
          lastChatNotifiedId = messageKey;
          const sender =
            lastMessage.SenderProviderName ||
            lastMessage.SenderEmail ||
            lastMessage.SenderRole ||
            "Felhasználó";
          showToast(`Új üzenet: ${sender}`);
          notifyProvider("Új üzenet érkezett", sender);
        }
      } else if (isModalOpen) {
        lastChatSeenId = messageKey;
        setChatUnread(false);
      }
    } else {
      setChatUnread(false);
    }
  } catch (err) {
    if (providerChatBox) {
      providerChatBox.innerHTML = `<p class="notice">${err.message}</p>`;
    }
    if (providerChatModalList) {
      providerChatModalList.innerHTML = `<p class="notice">${err.message}</p>`;
    }
  }
}

function startChatPolling() {
  if (chatPollTimer) return;
  loadChatMessages();
  chatPollTimer = setInterval(loadChatMessages, 7000);
}

function stopChatPolling() {
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
}

function selectRequest(requestId) {
  if (String(activeChatRequestId || "") === String(requestId || "")) {
    return;
  }
  activeChatRequestId = requestId;
  lastChatMessageId = null;
  lastChatNotifiedId = null;
  lastChatSeenId = null;
  setChatUnread(false);
  const request = requestCache.get(String(requestId));
  if (providerChatHint) {
    const statusText = request?.JobStatus || request?.Status || "";
    providerChatHint.textContent = requestId
      ? `Üzenet küldése: #${requestId}${statusText ? ` (${statusText})` : ""}`
      : "Válassz egy kérést az üzenetküldéshez.";
  }
  startChatPolling();
  loadChatMessages();
}

async function sendChatMessage() {
  const body = providerChatInput?.value?.trim();
  if (!body || !activeChatRequestId) return;
  try {
    await apiFetch(`/api/requests/${activeChatRequestId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    if (providerChatInput) {
      providerChatInput.value = "";
    }
    await loadChatMessages();
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerult elkuldeni az uzenetet.");
  }
}

async function sendChatMessageBody(body) {
  const message = String(body || "").trim();
  if (!message || !activeChatRequestId) return;
  try {
    await apiFetch(`/api/requests/${activeChatRequestId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: message })
    });
    await loadChatMessages();
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerult elkuldeni az uzenetet.");
  }
}
async function sendLocation(lat, lng) {
  await apiFetch("/api/providers/me/location", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng })
  });
}

async function loadProfile() {
  try {
    const profile = await apiFetch("/api/providers/me");
    providerProfile = profile;
    isOnline = profile.IsOnline === true || profile.IsOnline === 1;
    updateStatus();
    const savedManualLocation = loadManualProviderLocation();
    if (savedManualLocation) {
      manualLocationOverride = true;
      setLocationSelectedText(savedManualLocation.lat, savedManualLocation.lng, "Kijelölt hely");
      updateProviderMarker(savedManualLocation.lat, savedManualLocation.lng);
      setLocationMessage("Kezileg mentett pozicio aktiv.");
      stopLocationUpdates();
      return;
    }
    const lat = Number(profile.LastLat);
    const lng = Number(profile.LastLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      updateProviderMarker(lat, lng);
    } else {
      initMap(fallbackLocation.lat, fallbackLocation.lng);
    }
    if (isOnline) {
      setLocationMessage("");
      startLocationUpdates();
    } else {
      stopLocationUpdates();
    }
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

function updateStatus() {
  if (onlinePill) {
    onlinePill.textContent = isOnline ? "Online" : "Offline";
    onlinePill.classList.toggle("is-online", isOnline);
    onlinePill.classList.toggle("is-offline", !isOnline);
  }
  if (onlinePillMobile) {
    onlinePillMobile.textContent = isOnline ? "Online" : "Offline";
    onlinePillMobile.classList.toggle("is-online", isOnline);
    onlinePillMobile.classList.toggle("is-offline", !isOnline);
  }
  if (statusEl) {
    statusEl.textContent = isOnline ? "Elérhető vagy." : "Offline módban vagy.";
  }
  if (mobileStatusText) {
    mobileStatusText.textContent = isOnline ? "Elérhető vagy." : "Offline mód";
  }
  if (!activeRequest) {
    setRequestUiDefaults();
  }
}

async function toggleOnline() {
  try {
    isOnline = !isOnline;
    await apiFetch("/api/providers/me/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOnline })
    });
    updateStatus();
    if (isOnline) {
      setLocationMessage("");
      startLocationUpdates();
    } else {
      stopLocationUpdates();
    }
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

function startLocationUpdates() {
  if (manualLocationOverride) {
    setLocationMessage("Kezileg mentett pozicio aktiv.");
    return;
  }
  if (locationWatchId) {
    return;
  }

  if (!navigator.geolocation) {
    setLocationMessage(
      "A bongeszo nem tamogatja a helymeghatarozast. Adj meg kezi poziciot."
    );
    return;
  }

  const isSecureContext =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isSecureContext) {
    setLocationMessage("A pontos GPS-hez HTTPS (vagy localhost) szukseges.");
    return;
  }

  locationWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      updateProviderMarker(lat, lng);
      if (!shouldSendLocation(lat, lng)) return;
      try {
        await sendLocation(lat, lng);
        lastLocationSentAt = Date.now();
        lastLocationCoords = { lat, lng };
        setLocationMessage("");
      } catch (err) {
        setLocationMessage(err.message || "Nem sikerult elkuldeni a poziciot.");
      }
    },
    (err) => {
      setLocationMessage(
        `Nem tudjuk lekerdezni a GPS poziciot: ${err?.message || "ismeretlen hiba"}`
      );
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function stopLocationUpdates() {
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

async function fetchRouteData(from, to) {
  const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  const now = Date.now();
  const cached = routeCache.get(key);
  if (cached && now - cached.fetchedAt < 30000) {
    return cached;
  }
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const route = data?.routes?.[0];
  if (!route) return null;
  const geometry = route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];
  const entry = {
    geometry,
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    fetchedAt: now
  };
  routeCache.set(key, entry);
  return entry;
}

function fitMapToPoints(points) {
  if (!map || points.length === 0) return;
  if (points.length === 1) {
    map.setView(points[0], 14);
    return;
  }
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: [40, 40] });
}

async function refreshActiveRoute() {
  if (!activeRequest || !providerCoords || !map) return;
  const pickupLat = toNumber(activeRequest.PickupLat ?? activeRequest.pickupLat);
  const pickupLng = toNumber(activeRequest.PickupLng ?? activeRequest.pickupLng);
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return;

  setRequestMarker(pickupLat, pickupLng);

  const routeData = await fetchRouteData(providerCoords, { lat: pickupLat, lng: pickupLng });
  const distanceKm = routeData?.distanceKm ?? haversineKm(providerCoords.lat, providerCoords.lng, pickupLat, pickupLng);
  const etaMinutes = routeData?.durationMinutes ?? estimateEtaMinutes(distanceKm);

  if (providerRequestDistance) providerRequestDistance.textContent = formatDistance(distanceKm);
  if (providerRequestEta) providerRequestEta.textContent = formatEta(etaMinutes);
  if (providerOverlayDistance) providerOverlayDistance.textContent = formatDistance(distanceKm);
  if (providerOverlayEta) providerOverlayEta.textContent = formatEta(etaMinutes);

  if (routeData?.geometry?.length) {
    if (!activeRouteLine) {
      activeRouteLine = L.polyline(routeData.geometry, {
        color: "#ff8a1f",
        weight: 5,
        opacity: 0.9
      }).addTo(map);
    } else {
      activeRouteLine.setLatLngs(routeData.geometry);
    }
  }

  const destinationCoords = getDestinationCoords(activeRequest);
  let priceDistanceKm = distanceKm;
  const mapPoints = [[providerCoords.lat, providerCoords.lng], [pickupLat, pickupLng]];

  if (destinationCoords) {
    setDestinationMarker(destinationCoords.lat, destinationCoords.lng);
    const towRouteData = await fetchRouteData(
      { lat: pickupLat, lng: pickupLng },
      destinationCoords
    );
    priceDistanceKm = towRouteData?.distanceKm ?? priceDistanceKm;
    if (towRouteData?.geometry?.length) {
      if (!activeTowRouteLine) {
        activeTowRouteLine = L.polyline(towRouteData.geometry, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.85,
          dashArray: "6 8"
        }).addTo(map);
      } else {
        activeTowRouteLine.setLatLngs(towRouteData.geometry);
      }
    }
    mapPoints.push([destinationCoords.lat, destinationCoords.lng]);
  } else {
    if (destinationMarker) {
      destinationMarker.remove();
      destinationMarker = null;
    }
    if (activeTowRouteLine) {
      activeTowRouteLine.remove();
      activeTowRouteLine = null;
    }
  }

  const estimate = estimatePrice(priceDistanceKm, providerProfile);
  const priceText = estimate ? formatCurrency(estimate) : "-";
  if (providerRequestPrice) providerRequestPrice.textContent = priceText;
  if (providerOverlayPrice) providerOverlayPrice.textContent = priceText;

  const now = Date.now();
  const allowFit =
    !userInteractedAt || now - userInteractedAt > 15000 || lastAutoFitRequestId !== activeRequestId;
  if (allowFit) {
    fitMapToPoints(mapPoints);
    lastAutoFitAt = now;
    lastAutoFitRequestId = activeRequestId;
  }
}

async function fetchRequestDetails(request) {
  if (!request?.Id) return request;
  try {
    const detail = await apiFetch(`/api/requests/${request.Id}`);
    return {
      ...request,
      PickupLat: detail.pickupLat ?? request.PickupLat ?? request.pickupLat,
      PickupLng: detail.pickupLng ?? request.PickupLng ?? request.pickupLng,
      PickupAddress: detail.pickupAddress ?? request.PickupAddress ?? request.pickupAddress,
      DestinationLat: detail.destinationLat ?? request.DestinationLat ?? request.destinationLat,
      DestinationLng: detail.destinationLng ?? request.DestinationLng ?? request.destinationLng,
      DestinationAddress: detail.destinationAddress ?? request.DestinationAddress ?? request.destinationAddress,
      ProblemType: detail.problemType ?? request.ProblemType ?? request.problemType,
      Notes: detail.notes ?? request.Notes ?? request.notes,
      Status: detail.status ?? request.Status ?? request.status
    };
  } catch {
    return request;
  }
}
async function loadRequests() {
  try {
    const data = await apiFetch("/api/requests/provider");
    const terminalStatuses = new Set(["completed", "cancelled"]);
    const visibleRequests = data.filter(
      (req) => !terminalStatuses.has(getRequestStatusValue(req))
    );

    if (!map) {
      initMap(fallbackLocation.lat, fallbackLocation.lng);
    }

    requestCache = new Map();
    data.forEach((req) => {
      requestCache.set(String(req.Id), req);
    });

    if (visibleRequests.length === 0) {
      saveActiveProviderRequest(null);
      activeChatRequestId = null;
      stopChatPolling();
      lastProviderJobStatus = null;
      lastProviderRequestId = null;
      updateRequestUi(null);
      return;
    }

    const activeStatuses = new Set(["accepted", "enroute", "arrived"]);
    const savedRequestId = loadActiveProviderRequest();
    const savedRequest =
      (savedRequestId &&
        visibleRequests.find((req) => String(req.Id) === String(savedRequestId))) ||
      null;
    const preferredRequest =
      savedRequest && !terminalStatuses.has(getRequestStatusValue(savedRequest))
        ? savedRequest
        : null;
    const openRequest =
      visibleRequests.find(
        (req) =>
          !terminalStatuses.has(getRequestStatusValue(req)) &&
          !activeStatuses.has(getRequestStatusValue(req))
      ) ||
      null;
    const activeReq =
      preferredRequest ||
      visibleRequests.find((req) => activeStatuses.has(getRequestStatusValue(req))) ||
      openRequest ||
      visibleRequests.slice().sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))[0];

    if (!activeReq) {
      saveActiveProviderRequest(null);
      updateRequestUi(null);
      return;
    }

    const jobStatus = getRequestStatusValue(activeReq) || "new";
    const isDone = jobStatus === "completed";
    const isCancelled = jobStatus === "cancelled";
    if (isDone || isCancelled) {
      saveActiveProviderRequest(null);
    } else {
      saveActiveProviderRequest(activeReq.Id);
    }

    if (String(activeReq.Id) !== String(lastProviderRequestId)) {
      showToast(`Új kérés érkezett: #${activeReq.Id}`);
      notifyProvider("Új kérés", `#${activeReq.Id}`);
      lastProviderJobStatus = null;
      lastProviderRequestId = activeReq.Id;
    }

    if (jobStatus && jobStatus !== lastProviderJobStatus) {
      const label = jobStatusLabel(jobStatus) || jobStatus;
      showToast(`Statusz: ${label}`);
      notifyProvider("Kérés státusz frissült", label);
      lastProviderJobStatus = jobStatus;
    }

    const detailedReq = await fetchRequestDetails(activeReq);
    if (detailedReq && detailedReq.Id) {
      requestCache.set(String(detailedReq.Id), detailedReq);
    }
    updateRequestUi(detailedReq || activeReq);
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerult lekerni a kereseket.");
  }
}

async function updateRequestStatus(action) {
  if (!activeRequestId) return;
  try {
    if (action === "completed" || action === "cancelled") {
      saveActiveProviderRequest(null);
    } else {
      saveActiveProviderRequest(activeRequestId);
    }
    await apiFetch(`/api/requests/${activeRequestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action })
    });
    await loadRequests();
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerult frissiteni a statuszt.");
  }
}

function startRequestsPolling() {
  if (requestsPollTimer) return;
  loadRequests();
  requestsPollTimer = setInterval(loadRequests, 5000);
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function focusChat() {
  if (!activeRequestId) return;
  selectRequest(activeRequestId);
  providerChatInput?.focus();
  if (sidebarEl) {
    sidebarEl.scrollTo({ top: sidebarEl.scrollHeight, behavior: "smooth" });
  }
}

function setChatModalOpen(open) {
  if (!providerChatModal) return;
  providerChatModal.style.display = open ? "flex" : "none";
  if (open) {
    providerChatModalInput?.focus();
    if (lastChatMessageId) {
      lastChatSeenId = lastChatMessageId;
      setChatUnread(false);
    }
  }
}

async function handleChatModalSend() {
  const body = providerChatModalInput?.value?.trim();
  if (!body) return;
  await sendChatMessageBody(body);
  if (providerChatModalInput) {
    providerChatModalInput.value = "";
  }
  setChatModalOpen(false);
}

providerRequestAccept?.addEventListener("click", () => updateRequestStatus("accepted"));
providerRequestReject?.addEventListener("click", () => updateRequestStatus("cancelled"));
providerRequestEnroute?.addEventListener("click", () => updateRequestStatus("enroute"));
providerRequestArrived?.addEventListener("click", () => updateRequestStatus("arrived"));
providerRequestCompleted?.addEventListener("click", () => updateRequestStatus("completed"));
providerRequestCancel?.addEventListener("click", () => updateRequestStatus("cancelled"));
providerRequestChat?.addEventListener("click", focusChat);

providerOverlayAccept?.addEventListener("click", () => updateRequestStatus("accepted"));
providerOverlayReject?.addEventListener("click", () => updateRequestStatus("cancelled"));
providerOverlayEnroute?.addEventListener("click", () => updateRequestStatus("enroute"));
providerOverlayArrived?.addEventListener("click", () => updateRequestStatus("arrived"));
providerOverlayCompleted?.addEventListener("click", () => updateRequestStatus("completed"));
providerOverlayCancel?.addEventListener("click", () => updateRequestStatus("cancelled"));
providerOverlayChat?.addEventListener("click", focusChat);
providerOverlayChatIcon?.addEventListener("click", () => {
  if (!activeRequestId) return;
  selectRequest(activeRequestId);
  setChatModalOpen(true);
});
providerOverlayClose?.addEventListener("click", () => {
  setProviderOverlayVisible(false);
});

providerOverlay?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest(".overlay-grip")) {
    setProviderOverlayExpanded(!overlayExpanded);
  }
});

providerOverlay?.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  if (!touch || !providerOverlay) return;
  const rect = providerOverlay.getBoundingClientRect();
  if (touch.clientY - rect.top > 60) return;
  overlayDragStart = touch.clientY;
});

providerOverlay?.addEventListener("touchend", (event) => {
  if (overlayDragStart == null) return;
  const endY = event.changedTouches[0]?.clientY ?? overlayDragStart;
  const delta = endY - overlayDragStart;
  if (delta < -40) {
    setProviderOverlayExpanded(true);
  } else if (delta > 40) {
    setProviderOverlayExpanded(false);
  }
  overlayDragStart = null;
});

providerOverlay?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const copyBtn = target.closest(".address-copy");
  if (!copyBtn) return;
  const rawValue = copyBtn.getAttribute("data-copy") || "";
  const value = decodeURIComponent(rawValue);
  try {
    await navigator.clipboard.writeText(value);
    showToast("Cím másolva.");
  } catch {
    const temp = document.createElement("textarea");
    temp.value = value;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try {
      document.execCommand("copy");
      showToast("Cím másolva.");
    } catch {
      showToast("Nem sikerült másolni.");
    }
    document.body.removeChild(temp);
  }
});

providerChatModalClose?.addEventListener("click", () => setChatModalOpen(false));
providerChatModalCancel?.addEventListener("click", () => setChatModalOpen(false));
providerChatModalSend?.addEventListener("click", handleChatModalSend);
providerChatModalInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleChatModalSend();
  }
});

mobileListToggle?.addEventListener("click", () => {
  setSheetExpanded(!sheetExpanded);
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

providerMobileBack?.addEventListener("click", () => {
  setSheetExpanded(false);
});

providerMapCenterBtn?.addEventListener("click", centerMapToProvider);

toggleBtn?.addEventListener("click", toggleOnline);
toggleBtnMobile?.addEventListener("click", toggleOnline);

if (!getToken()) {
  if (statusEl) statusEl.textContent = "Belepes szukseges.";
} else {
  initMap(fallbackLocation.lat, fallbackLocation.lng);
  loadProfile();
  startRequestsPolling();
}

providerUseCurrentLocationBtn?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setLocationMessage("A böngésző nem támogatja a helymeghatározást.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      manualLocationOverride = false;
      clearManualProviderLocation();
      stopLocationUpdates();
      await setLocationSelectedText(lat, lng, "GPS hely");
      await sendLocation(lat, lng);
      updateProviderMarker(lat, lng);
      if (map) {
        map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
      }
      if (isOnline) {
        startLocationUpdates();
        setLocationMessage("GPS követés aktív.");
      } else {
        setLocationMessage("GPS hely frissítve. Online módban automatikusan frissül.");
      }
    },
    (err) => {
      setLocationMessage(`Nem sikerült lekérni a helyzetedet: ${err?.message || "ismeretlen hiba"}`);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
  );
});

providerManualAddressBtn?.addEventListener("click", handleManualAddressSubmit);
providerManualAddressInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleManualAddressSubmit();
  }
});

providerChatSend?.addEventListener("click", sendChatMessage);
providerChatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
});
