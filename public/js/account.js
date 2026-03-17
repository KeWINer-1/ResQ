const messageEl = document.getElementById("account-message");
const detailsEl = document.getElementById("account-details");
const nameEl = document.getElementById("account-name");
const emailEl = document.getElementById("account-email");
const phoneEl = document.getElementById("account-phone");
const roleEl = document.getElementById("account-role");
const logoutBtn = document.getElementById("logout-btn");

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

    const displayName = profile.provider?.name || profile.email || "Fiokom";
    nameEl.value = displayName;
    emailEl.value = profile.email || "";
    phoneEl.value = profile.provider?.phone || "Nincs megadva";
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

loadAccount();
