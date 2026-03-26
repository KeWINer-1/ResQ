const messageEl = document.getElementById("account-message");
const detailsEl = document.getElementById("account-details");
const nameEl = document.getElementById("account-name");
const emailEl = document.getElementById("account-email");
const phoneEl = document.getElementById("account-phone");
const roleEl = document.getElementById("account-role");
const logoutBtn = document.getElementById("logout-btn");
const saveBtn = document.getElementById("account-save");
let currentProfile = null;

function roleLabel(profile) {
  if (profile?.role === "Provider") return "Automento";
  if (profile?.role === "User") return "Felhasznalo";
  if (profile?.role === "Admin") return "Admin";
  return profile?.role || "Ismeretlen";
}

async function loadAccount() {
  if (!getToken()) {
    messageEl.textContent = "Belepes szukseges.";
    detailsEl.style.display = "none";
    return;
  }

  try {
    const profile = await getMyProfile();
    if (profile?.role === "Admin") {
      window.location.href = "/admin.html";
      return;
    }

    currentProfile = profile;
    const displayName = profile.provider?.name || profile.name || profile.email || "Fiokom";
    nameEl.value = displayName;
    emailEl.value = profile.email || "";
    phoneEl.value = profile.provider?.phone || profile.phone || "";
    roleEl.value = roleLabel(profile);
    detailsEl.style.display = "block";
    messageEl.textContent = "";
  } catch (err) {
    messageEl.textContent =
      err.message || "Nem sikerult betolteni a fiok adatokat.";
    detailsEl.style.display = "none";
  }
}

logoutBtn.addEventListener("click", () => {
  logout();
});

saveBtn?.addEventListener("click", async () => {
  if (!currentProfile) return;
  const name = nameEl?.value?.trim() || "";
  const phone = phoneEl?.value?.trim() || "";
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
    }
    messageEl.textContent = "Adataid frissitve.";
    if (typeof updateAuthLinks === "function") {
      updateAuthLinks();
    }
  } catch (err) {
    messageEl.textContent = err.message || "Nem sikerult menteni.";
  }
});

loadAccount();
