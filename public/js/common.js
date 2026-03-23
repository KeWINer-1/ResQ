const urlParams = new URLSearchParams(window.location.search);
const apiBaseParam = urlParams.get("apiBase");
if (apiBaseParam) {
  localStorage.setItem("apiBase", apiBaseParam);
}

function getDefaultApiBase() {
  const { protocol, hostname, port, origin } = window.location;
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (isLocalHost && port && port !== "5000") {
    return `${protocol}//${hostname}:5000`;
  }

  return origin;
}

const API_BASE = localStorage.getItem("apiBase") || getDefaultApiBase();

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
  if (profile.email) return profile.email;
  return "Fiokom";
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
  } catch (err) {
    clearToken();
    authLinks.forEach((link) => {
      link.textContent = "Belepes";
      link.setAttribute("href", "/auth.html");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateAuthLinks();
});
