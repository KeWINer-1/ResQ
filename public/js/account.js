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
  if (profile?.role === "User") return "Felhasznalo";
  if (profile?.role === "Admin") return "Admin";
  return profile?.role || "Ismeretlen";
}

function renderProfile(profile) {
  const displayName = profile.provider?.name || profile.name || profile.email || "Fiókom";
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
    return "Nincs jogosultsagod ehhez az oldalhoz.";
  }
  return "Hiba történt a fiókadatok betöltése közben.";
}

async function loadAccount() {
  if (!getToken()) {
    showAlert("A folytatashoz jelentkezz be.");
    messageEl.textContent = "";
    detailsEl.style.display = "none";
    return;
  }

  try {
    const profile = await getMyProfile();
    currentProfile = profile;
    if (profile?.role === "Admin") {
      if (detailsEl) detailsEl.style.display = "none";
      if (adminProfileEl) adminProfileEl.style.display = "block";
      renderAdminProfile(profile);
    } else {
      renderProfile(profile);
      if (detailsEl) detailsEl.style.display = "block";
      if (adminProfileEl) adminProfileEl.style.display = "none";
      setEditMode(false);
    }
    showAlert("");
    messageEl.textContent = "";
  } catch (err) {
    showAlert(friendlyAccountError(err));
    messageEl.textContent = "";
    if (detailsEl) detailsEl.style.display = "none";
    if (adminProfileEl) adminProfileEl.style.display = "none";
  }
}

logoutBtn.addEventListener("click", () => {
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
    messageEl.textContent = "Adataid frissitve.";
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
