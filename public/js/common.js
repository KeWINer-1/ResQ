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
  if (role === "Admin") return "/admin";
  if (role === "Provider") return "/provider";
  return "/map";
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
    if (response.status === 401) {
      clearToken();
      if (!window.location.pathname.endsWith("/auth")) {
        window.location.href = "/auth";
      }
    }
    const err = new Error(data.error || "Request failed");
    err.status = response.status;
    throw err;
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
  if (!profile) return "Fiókom";
  if (profile.provider?.name) return profile.provider.name;
  if (profile.name) return profile.name;
  if (profile.email) return profile.email;
  return "Fiókom";
}

function navKeyForLink(link) {
  if (!link) return "other";
  if (link.hasAttribute("data-auth-link")) return "account";
  if (link.hasAttribute("data-provider-link")) return "provider";
  if (link.hasAttribute("data-support-link")) return "support";

  const href = String(link.getAttribute("href") || "").toLowerCase();
  if (href.endsWith("/map") || href === "map.html") {
    return "map";
  }
  if (
    href.endsWith("/rolunk") ||
    href === "rolunk.html" ||
    href.endsWith("/about")
  ) {
    return "about";
  }
  if (href.endsWith("/admin") || href === "admin.html") {
    return "admin";
  }
  if (
    href.endsWith("/provider") ||
    href === "provider.html" ||
    href.endsWith("/automento") ||
    href === "automento.html"
  ) {
    return "provider";
  }
  return "other";
}

function isHomeOrMapLink(link) {
  const href = String(link?.getAttribute("href") || "").toLowerCase();
  return (
    href === "index.html" ||
    href.endsWith("/") ||
    href === "/" ||
    href.endsWith("/map") ||
    href === "map.html"
  );
}

function applyFixedNavOrder(role) {
  const orderByRole = {
    Admin: ["support", "account"],
    Provider: ["map", "provider", "support", "about", "account"],
    User: ["map", "support", "about", "account"],
    Guest: ["map", "support", "about", "account", "provider"]
  };
  const orderedKeys = orderByRole[role] || orderByRole.Guest;
  const orderIndex = new Map(orderedKeys.map((key, idx) => [key, idx + 1]));

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.hasAttribute("data-brand-link")) return;
    const key = navKeyForLink(link);
    const order = orderIndex.get(key) || 99;
    link.style.order = String(order);
  });
}

function updateRoleNav(role) {
  const providerLinks = document.querySelectorAll("[data-provider-link]");
  const supportLinks = document.querySelectorAll("[data-support-link]");
  const navLinks = document.querySelectorAll(".nav-links a");

  navLinks.forEach((link) => {
    if (link.hasAttribute("data-brand-link")) return;
    if (!isHomeOrMapLink(link)) return;
    link.textContent = "Térkép";
    link.setAttribute("href", role === "Provider" ? "/provider" : "/map");
  });

  if (role === "User") {
    navLinks.forEach((link) => {
      if (link.hasAttribute("data-brand-link")) return;
      link.style.display = "";
    });
    providerLinks.forEach((link) => {
      link.style.display = "none";
    });
    supportLinks.forEach((link) => {
      link.textContent = "Ügyfélszolgálat";
      link.setAttribute("href", "/support");
    });
    applyFixedNavOrder("User");
    return;
  }

  if (role === "Admin") {
    navLinks.forEach((link) => {
      if (link.hasAttribute("data-brand-link")) return;
      const href = String(link.getAttribute("href") || "").toLowerCase();
      const isAuth = link.hasAttribute("data-auth-link");
      const isAdminSupport =
        link.hasAttribute("data-support-link") ||
        href.endsWith("/admin") ||
        href === "admin.html" ||
        href.endsWith("/admin");
      if (isAdminSupport) {
        link.textContent = "Segítségkérések";
        link.setAttribute("href", "/admin");
      }
      link.style.display = isAuth || isAdminSupport ? "" : "none";
    });
    applyFixedNavOrder("Admin");
    return;
  }

  if (role === "Provider") {
    navLinks.forEach((link) => {
      if (link.hasAttribute("data-brand-link")) return;
      if (isHomeOrMapLink(link) || navKeyForLink(link) === "map") {
        link.textContent = "Térkép";
        link.setAttribute("href", "/provider");
      }
    });
    providerLinks.forEach((link) => {
      link.setAttribute("href", "/automento");
      link.textContent = "Autómentő mód";
    });
  }

  navLinks.forEach((link) => {
    link.style.display = "";
  });
  providerLinks.forEach((link) => {
    link.style.display = "";
  });
  supportLinks.forEach((link) => {
    link.textContent = "Ügyfélszolgálat";
    link.setAttribute("href", "/support");
  });
  applyFixedNavOrder(role === "Provider" ? "Provider" : "Guest");
}

function initNavToggle() {
  const header = document.querySelector("header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav-links");
  if (!header || !toggle || !nav) return;

  let overlay = document.querySelector(".nav-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    document.body.appendChild(overlay);
  }

  const closeMenu = () => {
    header.classList.remove("nav-open");
    if (overlay) overlay.classList.remove("show");
  };

  toggle.addEventListener("click", () => {
    const shouldOpen = !header.classList.contains("nav-open");
    header.classList.toggle("nav-open", shouldOpen);
    if (overlay) {
      overlay.classList.toggle("show", shouldOpen);
    }
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  overlay.addEventListener("click", () => {
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!header.classList.contains("nav-open")) return;
    if (
      event.target.closest(".nav-toggle") ||
      event.target.closest(".nav-links") ||
      event.target.closest(".nav-overlay")
    ) {
      return;
    }
    closeMenu();
  });
}

function ensureAccountLinkAtEnd() {
  const navs = document.querySelectorAll(".nav-links");
  navs.forEach((nav) => {
    const accountLink = nav.querySelector("[data-auth-link]");
    if (!accountLink) return;
    nav.appendChild(accountLink);
  });
}

function ensureAboutBeforeAccount() {
  const navs = document.querySelectorAll(".nav-links");
  navs.forEach((nav) => {
    const accountLink = nav.querySelector("[data-auth-link]");
    if (!accountLink) return;
    const links = Array.from(nav.querySelectorAll("a"));
    const aboutLink = links.find((link) => navKeyForLink(link) === "about");
    if (!aboutLink || aboutLink === accountLink) return;
    nav.insertBefore(aboutLink, accountLink);
  });
}

function ensureBrandGoesHome() {
  const brandLinks = document.querySelectorAll("a.brand");
  brandLinks.forEach((link) => {
    link.setAttribute("href", "/");
  });
}

function ensureMobileNavBrand() {
  const nav = document.querySelector(".nav-links");
  if (!nav) return;
  if (nav.querySelector(".nav-brand-mobile")) return;
  const brand = document.querySelector("a.brand");
  if (!brand) return;
  const clone = brand.cloneNode(true);
  clone.classList.add("nav-brand-mobile");
  clone.setAttribute("data-brand-link", "true");
  clone.setAttribute("href", "/index.html");
  clone.style.order = "0";
  nav.prepend(clone);
}

function logout() {
  clearToken();
  window.location.href = "/auth";
}

async function updateAuthLinks() {
  ensureAccountLinkAtEnd();
  const authLinks = document.querySelectorAll("[data-auth-link]");
  if (authLinks.length === 0) return;

  const token = getToken();
  if (!token) {
    authLinks.forEach((link) => {
      link.textContent = "Belépés";
      link.setAttribute("href", "/auth");
    });
    updateRoleNav(null);
    return;
  }

  try {
    const profile = await getMyProfile();
    const name = getDisplayName(profile);
    const target = "/account";

    authLinks.forEach((link) => {
      link.textContent = name;
      link.setAttribute("href", target);
      link.classList.add("account-link");
    });
    updateRoleNav(profile?.role || null);
  } catch (err) {
    if (err?.status === 401) {
      clearToken();
      authLinks.forEach((link) => {
        link.textContent = "Belépés";
        link.setAttribute("href", "/auth");
      });
      updateRoleNav(null);
      return;
    }
    const token = getToken();
    if (token) {
      // Ha a profil lekérés hibázik (pl. backend nem elérhető), ne dobjuk ki a token-t.
      authLinks.forEach((link) => {
        link.textContent = "Fiókom";
        link.setAttribute("href", "/account");
        link.classList.add("account-link");
      });
      updateRoleNav(getUserRole());
      return;
    }

    authLinks.forEach((link) => {
      link.textContent = "Fiókom";
      link.setAttribute("href", "/account");
      link.classList.add("account-link");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensureBrandGoesHome();
  ensureMobileNavBrand();
  ensureAccountLinkAtEnd();
  ensureAboutBeforeAccount();
  updateAuthLinks();
  initNavToggle();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });
}
