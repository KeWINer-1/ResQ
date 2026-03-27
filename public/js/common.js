const urlParams = new URLSearchParams(window.location.search);
const apiBaseParam = urlParams.get("apiBase");
if (apiBaseParam) {
  localStorage.setItem("apiBase", apiBaseParam);
}

function getDefaultApiBase() {
  const { protocol, hostname, port, origin } = window.location;
  const isFile = protocol === "file:";
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (isFile || !hostname) {
    return "http://localhost:5000";
  }

  if (isLocalHost && port && port !== "5000") {
    return `${protocol}//${hostname}:5000`;
  }

  return origin;
}

function normalizeApiBase(value) {
  if (!value || value === "null") {
    localStorage.removeItem("apiBase");
    return getDefaultApiBase();
  }
  if (value.startsWith("file:")) {
    localStorage.removeItem("apiBase");
    return getDefaultApiBase();
  }
  return value.replace(/\/$/, "");
}

const API_BASE = normalizeApiBase(
  localStorage.getItem("apiBase") || getDefaultApiBase()
);

function getToken() {
  return localStorage.getItem("resq_token");
}

function setToken(token) {
  localStorage.setItem("resq_token", token);
}

function clearToken() {
  localStorage.removeItem("resq_token");
  localStorage.removeItem("resq_profile");
  localStorage.removeItem("resq_profile_ts");
}

function decodeJwtPayload(token) {
  if (!token || !token.includes(".")) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

function getUserRole() {
  const token = getToken();
  const data = decodeJwtPayload(token);
  return data?.role || null;
}

function getHomePathForRole(role) {
  if (role === "Admin") return "/admin.html";
  if (role === "Provider") return "/provider.html";
  return "/map.html";
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Request failed" }));
    if (response.status === 401 || response.status === 403) {
      clearToken();
      if (!window.location.pathname.endsWith("/auth.html")) {
        window.location.href = "/auth.html";
      }
    }
    throw new Error(data.error || "Request failed");
  }

  return response.json();
}

function setMessage(el, message) {
  el.textContent = message;
}

function getCachedProfile() {
  const raw = localStorage.getItem("resq_profile");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedProfile(profile) {
  localStorage.setItem("resq_profile", JSON.stringify(profile));
  localStorage.setItem("resq_profile_ts", String(Date.now()));
}

async function getMyProfile() {
  const cached = getCachedProfile();
  if (cached) return cached;

  const profile = await apiFetch("/api/auth/me");
  setCachedProfile(profile);
  return profile;
}

function getDisplayName(profile) {
  if (!profile) return "Fiokom";
  if (profile.provider?.name) return profile.provider.name;
  if (profile.name) return profile.name;
  if (profile.email) return profile.email;
  return "Fiokom";
}

function updateRoleNav(role) {
  const providerLinks = document.querySelectorAll("[data-provider-link]");
  const supportLinks = document.querySelectorAll("[data-support-link]");

  if (role === "User") {
    providerLinks.forEach((link) => {
      link.style.display = "none";
    });
    supportLinks.forEach((link) => {
      link.textContent = "Ugyfelszolgalat";
    });
    return;
  }

  providerLinks.forEach((link) => {
    link.style.display = "";
  });
  supportLinks.forEach((link) => {
    link.textContent = "Uzenet adminnak";
  });
}

function initNavToggle() {
  const header = document.querySelector("header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav-links");
  if (!header || !toggle || !nav) return;

  toggle.addEventListener("click", () => {
    header.classList.toggle("nav-open");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("nav-open");
    });
  });

  document.addEventListener("click", (event) => {
    if (!header.classList.contains("nav-open")) return;
    if (event.target.closest(".nav-toggle") || event.target.closest(".nav-links")) {
      return;
    }
    header.classList.remove("nav-open");
  });
}

function logout() {
  clearToken();
  window.location.href = "/auth.html";
}

async function updateAuthLinks() {
  const authLinks = document.querySelectorAll("[data-auth-link]");
  if (authLinks.length === 0) return;

  const token = getToken();
  if (!token) {
    authLinks.forEach((link) => {
      link.textContent = "Belepes";
      link.setAttribute("href", "/auth.html");
    });
    updateRoleNav(null);
    return;
  }

  try {
    const profile = await getMyProfile();
    const name = getDisplayName(profile);
    const target = profile?.role === "Admin" ? "/admin.html" : "/account.html";

    authLinks.forEach((link) => {
      link.textContent = name;
      link.setAttribute("href", target);
      link.classList.add("account-link");
    });
    updateRoleNav(profile?.role || null);
  } catch (err) {
    const token = getToken();
    if (token) {
      // Ha a profil lekÃ©rÃ©s hibÃ¡zik (pl. backend nem elÃ©rhetÅ‘),
      // ne dobjuk ki a token-t.
      authLinks.forEach((link) => {
        link.textContent = "Fiokom";
        link.setAttribute("href", "/account.html");
        link.classList.add("account-link");
      });
      updateRoleNav(getUserRole());
      return;
    }

    authLinks.forEach((link) => {
      link.textContent = "Belepes";
      link.setAttribute("href", "/auth.html");
    });
    updateRoleNav(null);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateAuthLinks();
  initNavToggle();
});
