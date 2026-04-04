const messageEl = document.getElementById("automento-message");
const avgRatingEl = document.getElementById("provider-avg-rating");
const avgStarsFillEl = document.getElementById("provider-avg-stars-fill");
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
const statusToast = document.getElementById("status-toast");
const historySummaryEl = document.getElementById("provider-history-summary");
const historyListEl = document.getElementById("provider-history-list");

function showToast(message) {
  if (!statusToast) return;
  statusToast.textContent = message;
  statusToast.classList.add("show");
  setTimeout(() => statusToast.classList.remove("show"), 3500);
}

function formatCurrency(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0 Ft";
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

function formatEstimatedPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "Nincs adat";
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (value === "new") return "Új";
  if (value === "accepted") return "Elfogadva";
  if (value === "enroute") return "Úton";
  if (value === "arrived") return "Megérkezett";
  if (value === "completed") return "Kész";
  if (value === "cancelled") return "Lemondva";
  return status || "Ismeretlen";
}

function extractDestinationFromNotes(notes) {
  const value = String(notes || "");
  const marker = "__DESTINATION__:";
  const idx = value.indexOf(marker);
  if (idx < 0) return "";
  return value.slice(idx + marker.length).split("\n")[0].trim();
}

function renderHistory(items) {
  if (!historySummaryEl || !historyListEl) return;
  const safeItems = Array.isArray(items) ? items : [];
  historySummaryEl.textContent = `Összes fuvar: ${safeItems.length} db`;

  if (!safeItems.length) {
    historyListEl.innerHTML = '<p class="notice">Még nincs fuvar előzmény.</p>';
    return;
  }

  historyListEl.innerHTML = safeItems
    .map((item) => {
      const fromAddress = item?.PickupAddress || "Nincs megadva indulási cím";
      const toAddress = item?.DestinationAddress || extractDestinationFromNotes(item?.Notes);
      const problem = item?.ProblemType || "Nincs megadva hiba";
      const estimatedPrice = formatEstimatedPrice(item?.EstimatedPrice);
      const created = formatDateTime(item?.CreatedAt);
      const status = statusLabel(item?.JobStatus || item?.Status);
      const statusKey = String(item?.JobStatus || item?.Status || "").toLowerCase();
      return `
        <article class="account-history-item">
          <h3>#${item?.Id || "-"}</h3>
          <span class="history-status-badge history-status-${statusKey}">${status}</span>
          <p class="history-row"><strong>Dátum:</strong><span>${created}</span></p>
          <p class="history-row"><strong>Indulás:</strong><span>${fromAddress}</span></p>
          <p class="history-row"><strong>Cél:</strong><span>${toAddress || "Nincs megadva célcím"}</span></p>
          <p class="history-row"><strong>Hiba:</strong><span>${problem}</span></p>
          <p class="history-row"><strong>Becsült ár:</strong><span>${estimatedPrice}</span></p>
        </article>
      `;
    })
    .join("");
}

function renderRatings(items) {
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
      const comment = String(item.Comment || "").trim() || "Nincs szöveges vélemény.";
      const dateText = item.CreatedAt ? new Date(item.CreatedAt).toLocaleString("hu-HU") : "";
      const user = item.UserEmail || "Felhasználó";
      return `<article class="card rating-item">
        <div class="rating-item-top">
          <strong class="rating-stars">${starsText} <span class="rating-value">(${stars}/5)</span></strong>
          <span class="notice">${dateText}</span>
        </div>
        <div class="notice">Értékelte: ${user}</div>
        <p class="rating-comment">${comment}</p>
      </article>`;
    })
    .join("");
}

async function loadData() {
  const [profile, stats, ratings, historyRows] = await Promise.all([
    apiFetch("/api/providers/me"),
    apiFetch("/api/providers/me/stats"),
    apiFetch("/api/providers/me/ratings"),
    apiFetch("/api/requests/provider")
  ]);

  if (settingsRadiusEl) settingsRadiusEl.value = String(profile.ServiceRadiusKm ?? "");
  if (settingsBaseFeeEl) settingsBaseFeeEl.value = String(profile.BaseFee ?? "");
  if (settingsPerKmFeeEl) settingsPerKmFeeEl.value = String(profile.PerKmFee ?? "");
  if (settingsCapabilitiesEl) {
    settingsCapabilitiesEl.value = Array.isArray(profile.capabilities)
      ? profile.capabilities.join(",")
      : "";
  }

  if (avgRatingEl) {
    avgRatingEl.textContent =
      stats?.avgStars == null ? "Még nincs értékelés" : `${Number(stats.avgStars).toFixed(1)} / 5`;
  }
  if (avgStarsFillEl) {
    const safeAvg =
      stats?.avgStars == null ? 0 : Math.max(0, Math.min(5, Number(stats.avgStars)));
    avgStarsFillEl.style.width = `${(safeAvg / 5) * 100}%`;
  }
  if (tripCountEl) tripCountEl.textContent = String(Number(stats?.completedTrips || 0));
  if (totalEarningsEl) totalEarningsEl.textContent = formatCurrency(stats?.totalEarnings || 0);
  renderRatings(ratings?.items || []);
  renderHistory(historyRows || []);
}

async function saveSettings() {
  const serviceRadiusKm = Number.parseInt(settingsRadiusEl?.value || "", 10);
  const baseFee = Number.parseFloat(settingsBaseFeeEl?.value || "");
  const perKmFee = Number.parseFloat(settingsPerKmFeeEl?.value || "");
  const capabilities = String(settingsCapabilitiesEl?.value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  await apiFetch("/api/providers/me/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceRadiusKm, baseFee, perKmFee, capabilities })
  });
  showToast("Beállítások mentve.");
  await loadData();
}

ratingsToggleBtn?.addEventListener("click", () => {
  if (!ratingsPanelEl) return;
  const open = ratingsPanelEl.style.display !== "none";
  ratingsPanelEl.style.display = open ? "none" : "block";
});

settingsSaveBtn?.addEventListener("click", async () => {
  try {
    await saveSettings();
    messageEl.textContent = "";
  } catch (err) {
    messageEl.textContent = err.message || "Nem sikerült menteni a beállításokat.";
  }
});

async function init() {
  if (!getToken()) {
    window.location.href = "/auth";
    return;
  }
  if (getUserRole() !== "Provider") {
    window.location.href = "/map";
    return;
  }

  try {
    await loadData();
    messageEl.textContent = "";
  } catch (err) {
    messageEl.textContent = err.message || "Nem sikerült betölteni az adatokat.";
  }
}

init();
