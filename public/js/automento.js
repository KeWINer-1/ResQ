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
      const comment = String(item.Comment || "").trim() || "Nincs szoveges velemeny.";
      const dateText = item.CreatedAt ? new Date(item.CreatedAt).toLocaleString("hu-HU") : "";
      const user = item.UserEmail || "Felhasznalo";
      return `<article class="card rating-item">
        <div class="rating-item-top">
          <strong class="rating-stars">${starsText} <span class="rating-value">(${stars}/5)</span></strong>
          <span class="notice">${dateText}</span>
        </div>
        <div class="notice">Ertekelte: ${user}</div>
        <p class="rating-comment">${comment}</p>
      </article>`;
    })
    .join("");
}

async function loadData() {
  const [profile, stats, ratings] = await Promise.all([
    apiFetch("/api/providers/me"),
    apiFetch("/api/providers/me/stats"),
    apiFetch("/api/providers/me/ratings")
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
    window.location.href = "/auth.html";
    return;
  }
  if (getUserRole() !== "Provider") {
    window.location.href = "/map.html";
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
