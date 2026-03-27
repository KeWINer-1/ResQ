const statusEl = document.getElementById("provider-status");
const locationMessageEl = document.getElementById("provider-location-message");
const onlinePill = document.getElementById("online-pill");
const toggleBtn = document.getElementById("toggle-online");
const requestList = document.getElementById("request-list");
const manualLatEl = document.getElementById("manual-lat");
const manualLngEl = document.getElementById("manual-lng");
const saveLocationBtn = document.getElementById("save-location");
const providerChatHint = document.getElementById("provider-chat-hint");
const providerChatBox = document.getElementById("provider-chat-box");
const providerChatInput = document.getElementById("provider-chat-input");
const providerChatSend = document.getElementById("provider-chat-send");
const providerMapEl = document.getElementById("provider-map");
const statusToast = document.getElementById("status-toast");
const avgRatingEl = document.getElementById("provider-avg-rating");
const tripCountEl = document.getElementById("provider-trip-count");
const totalEarningsEl = document.getElementById("provider-total-earnings");
const ratingsToggleBtn = document.getElementById("provider-ratings-toggle");
const ratingsPanelEl = document.getElementById("provider-ratings-panel");
const ratingsListEl = document.getElementById("provider-ratings-list");
const settingsRadiusEl = document.getElementById("provider-service-radius");
const settingsBaseFeeEl = document.getElementById("provider-base-fee");
const settingsPerKmFeeEl = document.getElementById("provider-per-km-fee");
const settingsCapabilitiesEl = document.getElementById("provider-capabilities");
const settingsSaveBtn = document.getElementById("provider-settings-save");

const currentRole = getUserRole();
if (!currentRole) {
  window.location.href = "/auth.html";
}
if (currentRole && currentRole !== "Provider") {
  window.location.href = currentRole === "Admin" ? "/admin.html" : "/map.html";
}

let isOnline = false;
let locationTimer = null;
let locationWatchId = null;
let lastLocationSentAt = 0;
let lastLocationCoords = null;
let activeChatRequestId = null;
let chatPollTimer = null;
let map = null;
let providerMarker = null;
let requestMarkers = new Map();
let selectedRequestId = null;
const fallbackLocation = { lat: 47.4979, lng: 19.0402 };
let requestCache = new Map();
let manualLocationOverride = false;
const manualProviderLocationStorageKey = "resq_manual_provider_location";
const activeProviderRequestStorageKey = "resq_provider_active_request";
let requestsPollTimer = null;
let lastProviderJobStatus = null;
let lastProviderRequestId = null;

function jobStatusLabel(status) {
  if (!status) return null;
  const labels = {
    new: "Uj keres",
    accepted: "Elfogadva",
    enroute: "Uton van",
    arrived: "Megerkezett",
    completed: "Kesz",
    cancelled: "Lemondva"
  };
  return labels[status] || status;
}

function problemTypeLabel(value) {
  const key = String(value || "").toLowerCase();
  if (key === "breakdown") return "Lerobbanas";
  if (key === "flat_tire") return "Defekt";
  if (key === "battery") return "Akkumulator hiba";
  return value ? String(value) : "Ismeretlen";
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

function saveManualProviderLocation(lat, lng) {
  try {
    localStorage.setItem(
      manualProviderLocationStorageKey,
      JSON.stringify({ lat, lng })
    );
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

function initMap(lat, lng) {
  if (!providerMapEl || map) return;
  map = L.map("provider-map").setView([lat, lng], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  providerMarker = L.marker([lat, lng]).addTo(map).bindPopup("Te itt vagy");
}

function updateProviderMarker(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (!map) {
    initMap(lat, lng);
    return;
  }
  if (!providerMarker) {
    providerMarker = L.marker([lat, lng]).addTo(map).bindPopup("Te itt vagy");
  } else {
    providerMarker.setLatLng([lat, lng]);
  }
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

function shouldSendLocation(lat, lng) {
  const now = Date.now();
  if (!lastLocationCoords) return true;
  const distanceKm = haversineKm(lat, lng, lastLocationCoords.lat, lastLocationCoords.lng);
  if (distanceKm > 0.05) return true;
  if (now - lastLocationSentAt > 15000) return true;
  return false;
}

function getRequestStatusValue(req) {
  return req?.JobStatus || req?.Status || null;
}

function clearRequestMarkers() {
  for (const marker of requestMarkers.values()) {
    marker.remove();
  }
  requestMarkers.clear();
}

function selectRequest(requestId) {
  selectedRequestId = requestId;
  saveActiveProviderRequest(requestId);
  activeChatRequestId = requestId;
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

function getMyUserId() {
  const token = getToken();
  const data = decodeJwtPayload(token);
  return data?.userId || null;
}

function renderChatMessages(messages) {
  if (!providerChatBox) return;
  const myUserId = getMyUserId();
  if (!messages || messages.length === 0) {
    providerChatBox.innerHTML = "<p class=\"notice\">Nincs üzenet.</p>";
    return;
  }

  providerChatBox.innerHTML = messages
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
  providerChatBox.scrollTop = providerChatBox.scrollHeight;
}

async function loadChatMessages() {
  if (!activeChatRequestId) return;
  try {
    const data = await apiFetch(`/api/requests/${activeChatRequestId}/messages`);
    renderChatMessages(data.messages || []);
  } catch (err) {
    if (providerChatBox) {
      providerChatBox.innerHTML = `<p class="notice">${err.message}</p>`;
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
    setLocationMessage(err.message || "Nem sikerült elküldeni az üzenetet.");
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
    if (settingsRadiusEl) settingsRadiusEl.value = String(profile.ServiceRadiusKm ?? "");
    if (settingsBaseFeeEl) settingsBaseFeeEl.value = String(profile.BaseFee ?? "");
    if (settingsPerKmFeeEl) settingsPerKmFeeEl.value = String(profile.PerKmFee ?? "");
    if (settingsCapabilitiesEl) {
      settingsCapabilitiesEl.value = Array.isArray(profile.capabilities)
        ? profile.capabilities.join(",")
        : "";
    }
    isOnline = profile.IsOnline === true || profile.IsOnline === 1;
    updateStatus();
    const savedManualLocation = loadManualProviderLocation();
    if (savedManualLocation) {
      manualLocationOverride = true;
      if (manualLatEl) manualLatEl.value = String(savedManualLocation.lat);
      if (manualLngEl) manualLngEl.value = String(savedManualLocation.lng);
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
  onlinePill.textContent = isOnline ? "Online" : "Offline";
  onlinePill.classList.toggle("is-online", isOnline);
  onlinePill.classList.toggle("is-offline", !isOnline);
  statusEl.textContent = isOnline ? "Elérhető vagy." : "Offline módban vagy.";
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
      "A böngésző nem támogatja a helymeghatározást. Adj meg kézi pozíciót."
    );
    return;
  }

  const isSecureContext =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isSecureContext) {
    setLocationMessage("A pontos GPS-hez HTTPS (vagy localhost) szükséges.");
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
        setLocationMessage(err.message || "Nem sikerült elküldeni a pozíciót.");
      }
    },
    (err) => {
      setLocationMessage(
        `Nem tudjuk lekérni a GPS pozíciót: ${err?.message || "ismeretlen hiba"}`
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

function startRequestsPolling() {
  if (requestsPollTimer) return;
  loadRequests();
  requestsPollTimer = setInterval(loadRequests, 5000);
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
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
    clearRequestMarkers();
    requestCache = new Map();
    data.forEach((req) => {
      requestCache.set(String(req.Id), req);
    });
    if (visibleRequests.length === 0) {
      requestList.textContent = "Nincs új kérés.";
      selectedRequestId = null;
      saveActiveProviderRequest(null);
      activeChatRequestId = null;
      stopChatPolling();
      lastProviderJobStatus = null;
      lastProviderRequestId = null;
      if (providerChatBox) {
        providerChatBox.innerHTML = "";
      }
      if (providerChatHint) {
        providerChatHint.textContent = "Válassz egy kérést az üzenetküldéshez.";
      }
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
    const activeRequest =
      preferredRequest ||
      visibleRequests.find((req) => activeStatuses.has(getRequestStatusValue(req))) ||
      openRequest ||
      visibleRequests.slice().sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))[0];

    if (!activeRequest) {
      requestList.textContent = "Nincs új kérés.";
      selectedRequestId = null;
      saveActiveProviderRequest(null);
      return;
    }

    const req = activeRequest;
    const jobStatus = getRequestStatusValue(req);
    const isDone = jobStatus === "completed";
    const isCancelled = jobStatus === "cancelled";
    if (isDone || isCancelled) {
      saveActiveProviderRequest(null);
    } else {
      saveActiveProviderRequest(req.Id);
    }
    const statusText = jobStatusLabel(jobStatus) || jobStatusLabel(req.Status) || req.Status;
    const requestType = problemTypeLabel(req.ProblemType);
    const addressText = String(req.PickupAddress || "").trim();
    const fallbackCoords = `${req.PickupLat}, ${req.PickupLng}`;
    const isSelected = String(req.Id) === String(selectedRequestId);

    if (String(req.Id) !== String(lastProviderRequestId)) {
      lastProviderJobStatus = null;
      lastProviderRequestId = req.Id;
    }

    if (jobStatus && jobStatus !== lastProviderJobStatus) {
      const label = jobStatusLabel(jobStatus) || jobStatus;
      showToast(`Statusz: ${label}`);
      notifyProvider("Keres statusz frissult", label);
      lastProviderJobStatus = jobStatus;
    }

    const actions =
      isDone || isCancelled
        ? `<div class="cta-row" style="margin-top: 10px;">
          <button class="btn secondary" data-action="chat">Üzenet</button>
          <span class="notice">${isDone ? "✓ Kész" : "✕ Lemondva"}</span>
        </div>`
        : `<div class="cta-row" style="margin-top: 10px;">
          <button class="btn secondary" data-action="accepted">Elfogad</button>
          <button class="btn secondary" data-action="enroute">Úton vagyok</button>
          <button class="btn secondary" data-action="arrived">Megérkeztem</button>
          <button class="btn" data-action="completed">Kész</button>
          <button class="btn secondary" data-action="cancelled">Lemond</button>
          <button class="btn secondary" data-action="chat">Üzenet</button>
        </div>`;

    requestList.innerHTML = `<div class="provider-card provider-request-card${isSelected ? " is-selected" : ""}" data-request-id="${req.Id}" data-lat="${req.PickupLat}" data-lng="${req.PickupLng}">
        <strong>Keres #${req.Id}</strong>
        <div class="notice">Tipus: ${requestType}</div>
        <div class="notice">Statusz: ${statusText || "Ismeretlen"}</div>
        <div class="notice">Cím: ${addressText || fallbackCoords}</div>
        ${actions}
      </div>`;

    const lat = Number(req.PickupLat);
    const lng = Number(req.PickupLng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && map) {
      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(`Kérés #${req.Id}`);
      marker.on("click", () => {
        selectRequest(String(req.Id));
      });
      requestMarkers.set(String(req.Id), marker);
    }

    requestList.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-request-id]");
        const requestId = card?.getAttribute("data-request-id");
        const action = button.getAttribute("data-action");
        if (!requestId || !action) return;
        if (action === "chat") {
          selectRequest(requestId);
          return;
        }
        try {
          if (action === "completed" || action === "cancelled") {
            saveActiveProviderRequest(null);
          } else {
            saveActiveProviderRequest(requestId);
          }
          await apiFetch(`/api/requests/${requestId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: action })
          });
          await loadRequests();
        } catch (err) {
          setLocationMessage(err.message || "Nem sikerült frissíteni a státuszt.");
        }
      });
    });

    const card = requestList.querySelector("[data-request-id]");
    card?.addEventListener("click", (event) => {
      if (event.target?.closest("button")) return;
      const requestId = card.getAttribute("data-request-id");
      if (!requestId) return;
      selectRequest(requestId);
      const cardLat = Number(card.getAttribute("data-lat"));
      const cardLng = Number(card.getAttribute("data-lng"));
      if (map && Number.isFinite(cardLat) && Number.isFinite(cardLng)) {
        map.setView([cardLat, cardLng], 14);
        const marker = requestMarkers.get(requestId);
        marker?.openPopup();
      }
    });

    if (!selectedRequestId || String(selectedRequestId) !== String(req.Id)) {
      selectRequest(String(req.Id));
    }
  } catch (err) {
    requestList.textContent = err.message;
  }
}

toggleBtn.addEventListener("click", toggleOnline);

if (!getToken()) {
  statusEl.textContent = "Belépés szükséges.";
} else {
  initMap(fallbackLocation.lat, fallbackLocation.lng);
  loadProfile();
  startRequestsPolling();
}

saveLocationBtn?.addEventListener("click", async () => {
  const lat = parseFloat(manualLatEl?.value || "");
  const lng = parseFloat(manualLngEl?.value || "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    setLocationMessage("Adj meg érvényes lat/lng értékeket.");
    return;
  }
  try {
    manualLocationOverride = true;
    saveManualProviderLocation(lat, lng);
    stopLocationUpdates();
    await sendLocation(lat, lng);
    updateProviderMarker(lat, lng);
    setLocationMessage("Pozíció mentve.");
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerült menteni a pozíciót.");
  }
});

providerChatSend?.addEventListener("click", sendChatMessage);
providerChatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
});

function formatProviderCurrency(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0 Ft";
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

function renderProviderRatings(items) {
  if (!ratingsListEl) return;
  if (!Array.isArray(items) || items.length === 0) {
    ratingsListEl.innerHTML = "Még nincs értékelés.";
    return;
  }
  ratingsListEl.innerHTML = items
    .map((item) => {
      const stars = Number(item.Stars || 0);
      const clipped = Math.max(0, Math.min(5, stars));
      const starsText = "★".repeat(clipped) + "☆".repeat(5 - clipped);
      const comment = String(item.Comment || "").trim() || "Nincs szoveges velemeny.";
      const dateText = item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString("hu-HU") : "";
      return `<div class="provider-card"><strong>${starsText} (${stars}/5)</strong><div class="notice">${dateText}</div><div class="notice">${comment}</div></div>`;
    })
    .join("");
}

async function loadProviderInsightsPanel() {
  try {
    const [stats, ratings] = await Promise.all([
      apiFetch("/api/providers/me/stats"),
      apiFetch("/api/providers/me/ratings")
    ]);
    if (avgRatingEl) {
      avgRatingEl.textContent =
      stats?.avgStars == null ? "Még nincs értékelés" : `${Number(stats.avgStars).toFixed(1)} / 5`;
    }
    if (tripCountEl) {
      tripCountEl.textContent = String(Number(stats?.completedTrips || 0));
    }
    if (totalEarningsEl) {
      totalEarningsEl.textContent = formatProviderCurrency(stats?.totalEarnings || 0);
    }
    renderProviderRatings(ratings?.items || []);
  } catch {
    if (avgRatingEl) avgRatingEl.textContent = "Nincs adat";
    if (tripCountEl) tripCountEl.textContent = "0";
    if (totalEarningsEl) totalEarningsEl.textContent = "0 Ft";
    renderProviderRatings([]);
  }
}

async function saveProviderSettingsPanel() {
  const serviceRadiusKm = Number.parseInt(settingsRadiusEl?.value || "", 10);
  const baseFee = Number.parseFloat(settingsBaseFeeEl?.value || "");
  const perKmFee = Number.parseFloat(settingsPerKmFeeEl?.value || "");
  const capabilities = String(settingsCapabilitiesEl?.value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  try {
    await apiFetch("/api/providers/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceRadiusKm, baseFee, perKmFee, capabilities })
    });
    showToast("Beállítások mentve.");
    await loadProfile();
    await loadProviderInsightsPanel();
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerült menteni a beállításokat.");
  }
}

ratingsToggleBtn?.addEventListener("click", () => {
  if (!ratingsPanelEl) return;
  const open = ratingsPanelEl.style.display !== "none";
  ratingsPanelEl.style.display = open ? "none" : "block";
});

settingsSaveBtn?.addEventListener("click", () => {
  saveProviderSettingsPanel();
});
