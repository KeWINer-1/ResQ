const providersList = document.getElementById("providers-list");
const radiusInput = document.getElementById("radius-input");
const capabilitySelect = document.getElementById("capability-select");
const refreshBtn = document.getElementById("refresh-btn");
const mapMessage = document.getElementById("map-message");
const requestStatusCard = document.getElementById("request-status-card");
const requestStatusText = document.getElementById("request-status-text");
const requestStatusHideBtn = document.getElementById("request-status-hide");

let map;
let userMarker;
let providerMarkers = [];
let userLocation = null;
const fallbackLocation = { lat: 47.4979, lng: 19.0402 };
let activeRequestId = null;
let requestPollTimer = null;
let lastJobStatus = null;

function showRequestStatus(message) {
  if (requestStatusCard && requestStatusText) {
    requestStatusText.textContent = message || "";
    requestStatusCard.style.display = message ? "block" : "none";
  }
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

function startRequestPolling(requestId) {
  activeRequestId = requestId;
  try {
    localStorage.setItem("resq_active_request", String(requestId));
  } catch {}
  if (requestPollTimer) {
    clearInterval(requestPollTimer);
    requestPollTimer = null;
  }

  const tick = async () => {
    if (!activeRequestId) return;
    try {
      const data = await apiFetch(`/api/requests/${activeRequestId}`);
      const jobStatus = data.job?.Status || data.job?.status;
      const jobLabel = jobStatusLabel(jobStatus);
      const providerName = data.provider?.name ? ` (${data.provider.name})` : "";

      if (jobLabel) {
        const text = `Autómentő státusz${providerName}: ${jobLabel}`;
        mapMessage.textContent = text;
        showRequestStatus(text);
      } else {
        const text = "Kérés elküldve. Várjuk az autómentő visszajelzését…";
        mapMessage.textContent = text;
        showRequestStatus(text);
      }

      if (jobStatus && jobStatus !== lastJobStatus) {
        lastJobStatus = jobStatus;
      }

      if (jobStatus === "completed" || jobStatus === "cancelled") {
        clearInterval(requestPollTimer);
        requestPollTimer = null;
        activeRequestId = null;
        lastJobStatus = null;
        try {
          localStorage.removeItem("resq_active_request");
        } catch {}
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

function initMap(lat, lng) {
  map = L.map("map").setView([lat, lng], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  userMarker = L.marker([lat, lng]).addTo(map).bindPopup("Te itt vagy");
}

function clearProviders() {
  providerMarkers.forEach((marker) => marker.remove());
  providerMarkers = [];
  providersList.innerHTML = "";
}

function providerCard(provider) {
  const wrapper = document.createElement("div");
  wrapper.className = "provider-card";
  wrapper.innerHTML = `
    <strong>${provider.name}</strong>
    <div class="notice">${provider.distanceKm} km | Alapdíj: ${provider.baseFee} Ft | Km díj: ${provider.perKmFee} Ft</div>
    <div>${provider.capabilities.map((cap) => `<span class="tag">${cap}</span>`).join(" ")}</div>
    <div class="notice">Értékelés: ${provider.rating}</div>
    <div class="cta-row">
      <a class="btn secondary" href="tel:${provider.phone}">Hívás</a>
      <button class="btn" data-id="${provider.id}">Mentés kérése</button>
    </div>
  `;
  return wrapper;
}

async function loadProviders() {
  if (!userLocation) {
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

    providers.forEach((provider) => {
      const marker = L.marker([provider.lat, provider.lng]).addTo(map);
      marker.bindPopup(`${provider.name} - ${provider.baseFee} Ft`);
      providerMarkers.push(marker);

      const card = providerCard(provider);
      card.querySelector("button").addEventListener("click", () => {
        requestHelp(provider);
      });
      providersList.appendChild(card);
    });

    if (providers.length === 0) {
      providersList.innerHTML =
        "<p class=\"notice\">Nincs megjeleníthető online autómentő a kiválasztott területen. (Lehet, hogy az autómentők nem osztották meg a pozíciójukat.)</p>";
    }
  } catch (err) {
    providersList.innerHTML = `<p class="notice">${err.message}</p>`;
  }
}

async function requestHelp(provider) {
  const role = getUserRole();
  if (!role) {
    mapMessage.textContent = "A mentést csak bejelentkezve tudod kérni.";
    return;
  }
  if (role !== "User") {
    mapMessage.textContent = "A mentést csak felhasználók tudják kérni.";
    return;
  }
  if (!userLocation) {
    return;
  }
  const notes = prompt("Mi a probléma? (opcionális)") || "";
  try {
    const created = await apiFetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupLat: userLocation.lat,
        pickupLng: userLocation.lng,
        problemType: "breakdown",
        notes,
        selectedProviderId: provider.id
      })
    });
    mapMessage.textContent = "Kérés elküldve. Várjuk az autómentő visszajelzését…";
    if (created?.id) {
      startRequestPolling(created.id);
    }
  } catch (err) {
    alert(err.message);
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    providersList.innerHTML = "<p class=\"notice\">A böngésző nem támogatja a helymeghatározást. Budapestet mutatjuk.</p>";
    userLocation = fallbackLocation;
    initMap(userLocation.lat, userLocation.lng);
    loadProviders();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!map) {
        initMap(userLocation.lat, userLocation.lng);
      } else {
        map.setView([userLocation.lat, userLocation.lng], 13);
        userMarker.setLatLng([userLocation.lat, userLocation.lng]);
      }
      loadProviders();
    },
    () => {
      providersList.innerHTML = "<p class=\"notice\">Nem sikerült helymeghatározni. Budapestet mutatjuk.</p>";
      userLocation = fallbackLocation;
      if (!map) {
        initMap(userLocation.lat, userLocation.lng);
      } else {
        map.setView([userLocation.lat, userLocation.lng], 13);
        userMarker.setLatLng([userLocation.lat, userLocation.lng]);
      }
      loadProviders();
    }
  );
}

refreshBtn.addEventListener("click", loadProviders);

locateUser();

try {
  const existingId = Number.parseInt(localStorage.getItem("resq_active_request") || "", 10);
  if (Number.isInteger(existingId) && existingId > 0 && getToken()) {
    startRequestPolling(existingId);
  }
} catch {}
