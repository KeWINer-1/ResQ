const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const forgotForm = document.getElementById("forgot-form");
const resetForm = document.getElementById("reset-form");

const roleSelect = document.getElementById("role-select");
const providerFields = document.getElementById("provider-fields");

const loginMessage = document.getElementById("login-message");
const registerMessage = document.getElementById("register-message");
const forgotMessage = document.getElementById("forgot-message");
const resetMessage = document.getElementById("reset-message");

const loginAlert = document.getElementById("login-alert");
const registerAlert = document.getElementById("register-alert");
const forgotAlert = document.getElementById("forgot-alert");
const resetAlert = document.getElementById("reset-alert");

const loginPanel = document.getElementById("login-panel");
const registerPanel = document.getElementById("register-panel");
const forgotPanel = document.getElementById("forgot-panel");

const showRegisterLink = document.getElementById("show-register");
const showForgotLink = document.getElementById("show-forgot");
const showLoginFromRegisterLink = document.getElementById("show-login-from-register");
const showLoginFromForgotLink = document.getElementById("show-login-from-forgot");
const passwordToggleButtons = document.querySelectorAll("[data-toggle-password]");

function showAlert(el, message) {
  if (!message) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.style.display = "block";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function setPasswordToggleState(button, isVisible) {
  if (!button) return;
  button.textContent = "👁";
  button.classList.toggle("is-visible", isVisible);
  button.title = isVisible ? "Jelszó elrejtése" : "Jelszó megjelenítése";
  button.setAttribute("aria-label", button.title);
}

function showPanel(panel) {
  loginPanel.style.display = panel === "login" ? "block" : "none";
  registerPanel.style.display = panel === "register" ? "block" : "none";
  forgotPanel.style.display = panel === "forgot" ? "block" : "none";
}

const params = new URLSearchParams(window.location.search);
if (params.get("mode") === "forgot") {
  showPanel("forgot");
}
const tokenFromUrl = params.get("token");
if (tokenFromUrl) {
  resetForm.style.display = "block";
  resetForm.querySelector('input[name="token"]').value = tokenFromUrl;
}

showRegisterLink.addEventListener("click", (event) => {
  event.preventDefault();
  showAlert(loginAlert, "");
  showPanel("register");
});

showForgotLink.addEventListener("click", (event) => {
  event.preventDefault();
  showAlert(loginAlert, "");
  showPanel("forgot");
});

showLoginFromRegisterLink.addEventListener("click", (event) => {
  event.preventDefault();
  showAlert(registerAlert, "");
  showPanel("login");
});

showLoginFromForgotLink.addEventListener("click", (event) => {
  event.preventDefault();
  showAlert(forgotAlert, "");
  showAlert(resetAlert, "");
  showPanel("login");
});

roleSelect.addEventListener("change", () => {
  providerFields.style.display = roleSelect.value === "Provider" ? "block" : "none";
});

passwordToggleButtons.forEach((button) => {
  const input = button.parentElement?.querySelector('input[type="password"], input[type="text"]');
  if (!input) return;
  setPasswordToggleState(button, input.type === "text");
  button.addEventListener("click", () => {
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    setPasswordToggleState(button, !isVisible);
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "");
  showAlert(loginAlert, "");

  const form = new FormData(loginForm);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");

  if (!email) {
    showAlert(loginAlert, "Kérlek add meg az email címedet.");
    return;
  }
  if (!isValidEmail(email)) {
    showAlert(loginAlert, "Kérlek érvényes email címet adj meg (pl. nev@pelda.hu).");
    return;
  }
  if (!password) {
    showAlert(loginAlert, "Kérlek add meg a jelszavadat.");
    return;
  }

  try {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    setToken(data.token);
    setMessage(loginMessage, "Sikeres bejelentkezés.");
    window.location.href = getHomePathForRole(data.role);
  } catch (err) {
    let message = String(err.message || "");
    if (message === "Failed to fetch" || message === "NetworkError when attempting to fetch resource.") {
      message = `Nem érem el a szervert (${API_BASE}). Indítsd el a backendet (5000-es port) és próbáld újra.`;
    }
    const lower = message.toLowerCase();
    if (lower.includes("account not found")) {
      showAlert(loginAlert, "A fiókját nem találtuk. Ellenőrizd az email címet.");
      return;
    }
    if (lower.includes("invalid credentials")) {
      showAlert(loginAlert, "Hibás jelszó.");
      return;
    }
    if (
      lower.includes("server error") ||
      lower.includes("request failed")
    ) {
      showAlert(
        loginAlert,
        "A bejelentkezés most nem elérhető. Kérlek próbáld újra pár perc múlva."
      );
      return;
    }
    showAlert(loginAlert, message || "Váratlan hiba történt a bejelentkezésnél.");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(registerMessage, "");
  showAlert(registerAlert, "");

  const form = new FormData(registerForm);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const role = String(form.get("role") || "");

  if (!email) {
    showAlert(registerAlert, "Kérlek add meg az email címedet.");
    return;
  }
  if (!isValidEmail(email)) {
    showAlert(registerAlert, "Kérlek érvényes email címet adj meg (pl. nev@pelda.hu).");
    return;
  }
  if (!password) {
    showAlert(registerAlert, "Kérlek add meg a jelszavadat.");
    return;
  }
  if (!role) {
    showAlert(registerAlert, "Kérlek válassz szerepkört.");
    return;
  }

  const capabilitiesRaw = form.get("capabilities") || "";
  const payload = {
    email,
    password,
    role,
    name: form.get("name"),
    phone: form.get("phone"),
    serviceRadiusKm: parseInt(form.get("serviceRadiusKm"), 10) || undefined,
    baseFee: parseFloat(form.get("baseFee")) || undefined,
    perKmFee: parseFloat(form.get("perKmFee")) || undefined,
    capabilities: capabilitiesRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };

  try {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setToken(data.token);
    setMessage(registerMessage, "Sikeres regisztráció.");
    window.location.href = getHomePathForRole(payload.role);
  } catch (err) {
    const message = String(err.message || "");
    if (message.toLowerCase().includes("email already registered")) {
      showAlert(registerAlert, "Az email cím már foglalt.");
      return;
    }
    setMessage(registerMessage, message);
  }
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(forgotMessage, "");
  setMessage(resetMessage, "");
  showAlert(forgotAlert, "");
  showAlert(resetAlert, "");

  const form = new FormData(forgotForm);
  const email = String(form.get("email") || "").trim();

  if (!email) {
    showAlert(forgotAlert, "Kérlek add meg az email címedet.");
    return;
  }
  if (!isValidEmail(email)) {
    showAlert(forgotAlert, "Kérlek érvényes email címet adj meg (pl. nev@pelda.hu).");
    return;
  }

  try {
    const data = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    setMessage(
      forgotMessage,
      "Ha létezik ilyen email cím, elküldtük a jelszó-visszaállítási lépéseket."
    );
    resetForm.style.display = "block";

    if (data.resetToken) {
      resetForm.querySelector('input[name="token"]').value = data.resetToken;
      setMessage(
        forgotMessage,
        "Fejlesztői mód: a token automatikusan kitöltve. Add meg az új jelszót."
      );
    }
  } catch (err) {
    const message = String(err.message || "");
    if (message.toLowerCase().includes("account not found")) {
      showAlert(forgotAlert, "Nincs ilyen email címhez tartozó fiók.");
      return;
    }
    if (
      message.toLowerCase().includes("server error") ||
      message.toLowerCase().includes("request failed")
    ) {
      showAlert(
        forgotAlert,
        "A jelszó-visszaállítás most nem elérhető. Kérlek próbáld újra később."
      );
      return;
    }
    showAlert(forgotAlert, message || "Nem sikerült elindítani a jelszó-visszaállítást.");
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(resetMessage, "");
  showAlert(resetAlert, "");

  const form = new FormData(resetForm);
  const token = String(form.get("token") || "").trim();
  const newPassword = String(form.get("newPassword") || "");

  if (!token) {
    showAlert(resetAlert, "Kérlek add meg a visszaállító kódot vagy tokent.");
    return;
  }
  if (!newPassword) {
    showAlert(resetAlert, "Kérlek add meg az új jelszót.");
    return;
  }

  try {
    await apiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword })
    });

    setMessage(resetMessage, "A jelszó sikeresen frissítve. Most be tudsz lépni.");
    resetForm.reset();
    resetForm.style.display = "none";
    showPanel("login");
  } catch (err) {
    setMessage(resetMessage, err.message);
  }
});
