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

function setLocationMessage(message) {
  if (!locationMessageEl) return;
  locationMessageEl.textContent = message || "";
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

function clearRequestMarkers() {
  for (const marker of requestMarkers.values()) {
    marker.remove();
  }
  requestMarkers.clear();
}

function selectRequest(requestId) {
  selectedRequestId = requestId;
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
    isOnline = profile.IsOnline === true || profile.IsOnline === 1;
    updateStatus();
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
  onlinePill.style.background = isOnline ? "#fbe7d5" : "#ececec";
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

async function loadRequests() {
  try {
    const data = await apiFetch("/api/requests/provider");
    if (!map) {
      initMap(fallbackLocation.lat, fallbackLocation.lng);
    }
    clearRequestMarkers();
    requestCache = new Map();
    data.forEach((req) => {
      requestCache.set(String(req.Id), req);
    });
    if (data.length === 0) {
      requestList.textContent = "Nincs új kérés.";
      selectedRequestId = null;
      if (providerChatHint) {
        providerChatHint.textContent = "Válassz egy kérést az üzenetküldéshez.";
      }
      return;
    }

    const activeStatuses = new Set(["accepted", "enroute", "arrived"]);
    const activeRequest =
      data.find((req) => activeStatuses.has(req.JobStatus)) ||
      data.slice().sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))[0];

    if (!activeRequest) {
      requestList.textContent = "Nincs új kérés.";
      selectedRequestId = null;
      return;
    }

    const req = activeRequest;
    const jobStatus = req.JobStatus || null;
    const isDone = jobStatus === "completed";
    const isCancelled = jobStatus === "cancelled";
    const job = jobStatus ? ` | ${jobStatus}` : "";
    const isSelected = String(req.Id) === String(selectedRequestId);

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

    requestList.innerHTML = `<div class="provider-card" data-request-id="${req.Id}" data-lat="${req.PickupLat}" data-lng="${req.PickupLng}" style="${isSelected ? "background:#fff3e6;border-radius:12px;padding:12px;" : ""}">
        <strong>Kérés #${req.Id}</strong>
        <div class="notice">${req.ProblemType || "ismeretlen"} | ${req.Status}${job}</div>
        <div class="notice">${req.PickupLat}, ${req.PickupLng}</div>
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
  loadProfile();
  loadRequests();
}

saveLocationBtn?.addEventListener("click", async () => {
  const lat = parseFloat(manualLatEl?.value || "");
  const lng = parseFloat(manualLngEl?.value || "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    setLocationMessage("Adj meg érvényes lat/lng értékeket.");
    return;
  }
  try {
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
