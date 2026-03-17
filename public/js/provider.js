const statusEl = document.getElementById("provider-status");
const locationMessageEl = document.getElementById("provider-location-message");
const onlinePill = document.getElementById("online-pill");
const toggleBtn = document.getElementById("toggle-online");
const requestList = document.getElementById("request-list");
const manualLatEl = document.getElementById("manual-lat");
const manualLngEl = document.getElementById("manual-lng");
const saveLocationBtn = document.getElementById("save-location");

let isOnline = false;
let locationTimer = null;

function setLocationMessage(message) {
  if (!locationMessageEl) return;
  locationMessageEl.textContent = message || "";
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
  if (locationTimer) {
    return;
  }

  const tickLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(
        "A böngésző nem támogatja a helymeghatározást. Adj meg kézi pozíciót."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await sendLocation(pos.coords.latitude, pos.coords.longitude);
          setLocationMessage("");
        } catch (err) {
          setLocationMessage(err.message || "Nem sikerült elküldeni a pozíciót.");
        }
      },
      (err) => {
        const needsSecureContext =
          window.location.protocol !== "https:" &&
          !window.location.hostname.includes("localhost") &&
          window.location.hostname !== "127.0.0.1";
        const extra = needsSecureContext
          ? " (Tipp: a GPS-hez HTTPS vagy localhost kell.)"
          : "";

        setLocationMessage(
          `Nem tudjuk lekérni a GPS pozíciót: ${err?.message || "ismeretlen hiba"}${extra}`
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  };

  tickLocation();
  locationTimer = setInterval(tickLocation, 20000);
}

function stopLocationUpdates() {
  if (locationTimer) {
    clearInterval(locationTimer);
    locationTimer = null;
  }
}

async function loadRequests() {
  try {
    const data = await apiFetch("/api/requests/provider");
    if (data.length === 0) {
      requestList.textContent = "Nincs új kérés.";
      return;
    }

    requestList.innerHTML = data
      .map((req) => {
        const jobStatus = req.JobStatus || null;
        const isDone = jobStatus === "completed";
        const isCancelled = jobStatus === "cancelled";
        const job = jobStatus ? ` | ${jobStatus}` : "";

        const actions =
          isDone || isCancelled
            ? `<div class="notice" style="margin-top: 10px;">${isDone ? "✓ Kész" : "✕ Lemondva"}</div>`
            : `<div class="cta-row" style="margin-top: 10px;">
              <button class="btn secondary" data-action="accepted">Elfogad</button>
              <button class="btn secondary" data-action="enroute">Úton vagyok</button>
              <button class="btn secondary" data-action="arrived">Megérkeztem</button>
              <button class="btn" data-action="completed">Kész</button>
              <button class="btn secondary" data-action="cancelled">Lemond</button>
            </div>`;

        return `<div class="provider-card" data-request-id="${req.Id}">
            <strong>Kérés #${req.Id}</strong>
            <div class="notice">${req.ProblemType || "ismeretlen"} | ${req.Status}${job}</div>
            <div class="notice">${req.PickupLat}, ${req.PickupLng}</div>
            ${actions}
          </div>`;
      })
      .join("");

    requestList.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-request-id]");
        const requestId = card?.getAttribute("data-request-id");
        const action = button.getAttribute("data-action");
        if (!requestId || !action) return;
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
    setLocationMessage("Pozíció mentve.");
  } catch (err) {
    setLocationMessage(err.message || "Nem sikerült menteni a pozíciót.");
  }
});
