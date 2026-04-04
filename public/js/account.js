const messageEl = document.getElementById("account-message");
const alertEl = document.getElementById("account-alert");
const detailsEl = document.getElementById("account-details");
const nameEl = document.getElementById("account-name");
const emailEl = document.getElementById("account-email");
const phoneEl = document.getElementById("account-phone");
const roleEl = document.getElementById("account-role");
const logoutBtn = document.getElementById("logout-btn");
const editBtn = document.getElementById("account-edit");
const saveBtn = document.getElementById("account-save");
const cancelBtn = document.getElementById("account-cancel");
const adminProfileEl = document.getElementById("admin-profile");
const adminEmailEl = document.getElementById("admin-email");
const adminRoleEl = document.getElementById("admin-role");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const historyCardEl = document.getElementById("account-history-card");
const historySummaryEl = document.getElementById("account-history-summary");
const historyListEl = document.getElementById("account-history-list");
const accountLayoutEl = document.querySelector(".account-layout");

let currentProfile = null;
let isEditMode = false;

function showAlert(message) {
  if (!alertEl) return;
  if (!message) {
    alertEl.style.display = "none";
    alertEl.textContent = "";
    return;
  }
  alertEl.style.display = "block";
  alertEl.textContent = message;
}

function roleLabel(profile) {
  if (profile?.role === "Provider") return "Autómentő";
  if (profile?.role === "User") return "Felhasználó";
  if (profile?.role === "Admin") return "Admin";
  return profile?.role || "Ismeretlen";
}

function renderProfile(profile) {
  const displayName = profile.provider?.name || profile.name || profile.email || "Adataim";
  nameEl.value = displayName;
  emailEl.value = profile.email || "";
  phoneEl.value = profile.provider?.phone || profile.phone || "";
  roleEl.value = roleLabel(profile);
}

function renderAdminProfile(profile) {
  if (adminEmailEl) adminEmailEl.value = profile?.email || "";
  if (adminRoleEl) adminRoleEl.value = roleLabel(profile);
}

function setEditMode(enabled) {
  isEditMode = enabled;
  nameEl.disabled = !enabled;
  phoneEl.disabled = !enabled;
  editBtn.style.display = enabled ? "none" : "";
  saveBtn.style.display = enabled ? "" : "none";
  cancelBtn.style.display = enabled ? "" : "none";
}

function sanitizePhone(value) {
  const raw = String(value || "");
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "+" && out.length === 0) {
      out += ch;
    }
  }
  return out;
}

function friendlyAccountError(error) {
  const msg = String(error?.message || "").toLowerCase();
  if (msg.includes("server error")) {
    return "A fiókadatok betöltése most nem sikerült. Próbáld újra pár másodperc múlva.";
  }
  if (msg.includes("user not found")) {
    return "A fiók nem található. Jelentkezz be újra.";
  }
  if (msg.includes("forbidden")) {
    return "Nincs jogosultságod ehhez az oldalhoz.";
  }
  return "Hiba történt a fiókadatok betöltése közben.";
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

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "Nincs adat";
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
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
  historySummaryEl.textContent = `Eddig ${safeItems.length} mentőt hívtál.`;

  if (!safeItems.length) {
    historyListEl.innerHTML = '<p class="notice">Még nincs mentési előzményed.</p>';
    return;
  }

  historyListEl.innerHTML = safeItems
    .map((item) => {
      const fromAddress = item?.PickupAddress || "Nincs megadva indulási cím";
      const toAddress = extractDestinationFromNotes(item?.Notes);
      const problem = item?.ProblemType || "Nincs megadva hiba";
      const provider = item?.ProviderName || "Még nincs hozzárendelve";
      const estimatedPrice = formatCurrency(item?.EstimatedPrice);
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
          <p class="history-row"><strong>Autómentő:</strong><span>${provider}</span></p>
        </article>
      `;
    })
    .join("");
}

async function loadHistory() {
  if (!historyCardEl || !historySummaryEl || !historyListEl) return;
  historyCardEl.style.display = "flex";
  historySummaryEl.textContent = "Betöltés...";
  historyListEl.innerHTML = "";
  try {
    const rows = await apiFetch("/api/requests/me");
    renderHistory(rows);
  } catch (error) {
    historySummaryEl.textContent = "Az előzmények betöltése sikertelen.";
    historyListEl.innerHTML = "";
  }
}

async function loadAccount() {
  if (!getToken()) {
    showAlert("A folytatáshoz jelentkezz be.");
    messageEl.textContent = "";
    detailsEl.style.display = "none";
    if (historyCardEl) historyCardEl.style.display = "none";
    return;
  }

  try {
    showAlert("");
    const profile = await getMyProfile();
    currentProfile = profile;
    if (profile?.role === "Admin") {
      if (accountLayoutEl) accountLayoutEl.classList.add("account-layout-single");
      if (detailsEl) detailsEl.style.display = "none";
      if (adminProfileEl) adminProfileEl.style.display = "block";
      if (historyCardEl) historyCardEl.style.display = "none";
      renderAdminProfile(profile);
    } else {
      renderProfile(profile);
      if (detailsEl) detailsEl.style.display = "block";
      if (adminProfileEl) adminProfileEl.style.display = "none";
      setEditMode(false);
      if (profile?.role === "User") {
        if (accountLayoutEl) accountLayoutEl.classList.remove("account-layout-single");
        await loadHistory();
      } else if (historyCardEl) {
        historyCardEl.style.display = "none";
        if (accountLayoutEl) accountLayoutEl.classList.add("account-layout-single");
      }
    }
    showAlert("");
    messageEl.textContent = "";
  } catch (err) {
    const cached = getCachedProfile();
    if (cached) {
      currentProfile = cached;
      renderProfile(cached);
      if (detailsEl) detailsEl.style.display = "block";
      if (adminProfileEl) adminProfileEl.style.display = "none";
      setEditMode(false);
      showAlert("");
      messageEl.textContent = "";
      return;
    }
    showAlert("");
    messageEl.textContent = "";
    if (detailsEl) detailsEl.style.display = "none";
    if (adminProfileEl) adminProfileEl.style.display = "none";
    if (historyCardEl) historyCardEl.style.display = "none";
  }
}

logoutBtn?.addEventListener("click", () => {
  logout();
});

adminLogoutBtn?.addEventListener("click", () => {
  logout();
});

editBtn?.addEventListener("click", () => {
  setEditMode(true);
  showAlert("");
  messageEl.textContent = "";
});

cancelBtn?.addEventListener("click", () => {
  if (currentProfile) {
    renderProfile(currentProfile);
  }
  setEditMode(false);
  showAlert("");
  messageEl.textContent = "";
});

phoneEl?.addEventListener("input", () => {
  const cleaned = sanitizePhone(phoneEl.value);
  if (phoneEl.value !== cleaned) {
    phoneEl.value = cleaned;
  }
});

saveBtn?.addEventListener("click", async () => {
  if (!currentProfile || !isEditMode) return;
  const name = nameEl?.value?.trim() || "";
  const phone = sanitizePhone(phoneEl?.value?.trim() || "");
  showAlert("");
  messageEl.textContent = "";
  try {
    const updated = await apiFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone })
    });
    if (updated) {
      localStorage.setItem("resq_profile", JSON.stringify(updated));
      localStorage.setItem("resq_profile_ts", String(Date.now()));
      currentProfile = updated;
      renderProfile(updated);
    }
    setEditMode(false);
    messageEl.textContent = "Adataid frissítve.";
    if (typeof updateAuthLinks === "function") {
      updateAuthLinks();
    }
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.toLowerCase().includes("server error")) {
      showAlert("Most nem sikerült menteni a módosításokat. Próbáld újra.");
      return;
    }
    showAlert(msg || "A mentés nem sikerült.");
  }
});

loadAccount();
