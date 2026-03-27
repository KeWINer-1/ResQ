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

const loginPanel = document.getElementById("login-panel");
const registerPanel = document.getElementById("register-panel");
const forgotPanel = document.getElementById("forgot-panel");

const showRegisterLink = document.getElementById("show-register");
const showForgotLink = document.getElementById("show-forgot");
const showLoginFromRegisterLink = document.getElementById("show-login-from-register");
const showLoginFromForgotLink = document.getElementById("show-login-from-forgot");

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
  const tokenInput = resetForm.querySelector('input[name="token"]');
  tokenInput.value = tokenFromUrl;
}

showRegisterLink.addEventListener("click", (event) => {
  event.preventDefault();
  showPanel("register");
});

showForgotLink.addEventListener("click", (event) => {
  event.preventDefault();
  showPanel("forgot");
});

showLoginFromRegisterLink.addEventListener("click", (event) => {
  event.preventDefault();
  showPanel("login");
});

showLoginFromForgotLink.addEventListener("click", (event) => {
  event.preventDefault();
  showPanel("login");
});

roleSelect.addEventListener("change", () => {
  providerFields.style.display = roleSelect.value === "Provider" ? "block" : "none";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "");
  const form = new FormData(loginForm);
  try {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });
    setToken(data.token);
    setMessage(loginMessage, "Sikeres belépés.");
    window.location.href = getHomePathForRole(data.role);
  } catch (err) {
    let message = err.message || "Nem sikerült a belépés.";
    if (
      message === "Failed to fetch" ||
      message === "NetworkError when attempting to fetch resource."
    ) {
      message = `Nem érem el a szervert (${API_BASE}). Indítsd el a backendet (5000-es port) és próbáld újra.`;
    }
    setMessage(loginMessage, message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(registerMessage, "");
  const form = new FormData(registerForm);
  const capabilitiesRaw = form.get("capabilities") || "";
  const payload = {
    email: form.get("email"),
    password: form.get("password"),
    role: form.get("role"),
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
    setMessage(registerMessage, err.message);
  }
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(forgotMessage, "");
  setMessage(resetMessage, "");

  const form = new FormData(forgotForm);
  try {
    const data = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email")
      })
    });

    setMessage(
      forgotMessage,
      "Ha létezik ilyen email cím, elküldtük a jelszó-visszaállítási lépéseket."
    );
    resetForm.style.display = "block";

    if (data.resetToken) {
      const tokenInput = resetForm.querySelector('input[name="token"]');
      tokenInput.value = data.resetToken;
      setMessage(
        forgotMessage,
        "Fejlesztői mód: a token automatikusan kitöltve. Add meg az új jelszót."
      );
    }
  } catch (err) {
    setMessage(forgotMessage, err.message);
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(resetMessage, "");

  const form = new FormData(resetForm);
  try {
    await apiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: form.get("token"),
        newPassword: form.get("newPassword")
      })
    });

    setMessage(resetMessage, "A jelszó sikeresen frissítve. Most be tudsz lépni.");
    resetForm.reset();
    resetForm.style.display = "none";
    showPanel("login");
  } catch (err) {
    setMessage(resetMessage, err.message);
  }
});
