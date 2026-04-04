const messageEl = document.getElementById("admin-message");
const mainLayoutEl = document.getElementById("admin-main-layout");
const filtersEl = document.getElementById("admin-filters");
const listEl = document.getElementById("admin-conversations");
const titleEl = document.getElementById("admin-convo-title");
const chatPanelEl = document.getElementById("admin-chat-panel");
const chatCardEl = document.getElementById("admin-chat-card");
const messagesEl = document.getElementById("admin-messages");
const inputEl = document.getElementById("admin-input");
const sendBtn = document.getElementById("admin-send");
const closeBtn = document.getElementById("admin-close");
const requestsListEl = document.getElementById("admin-requests-list");
const requestsMessageEl = document.getElementById("admin-requests-message");
const requestsRefreshBtn = document.getElementById("admin-requests-refresh");
const historyListEl = document.getElementById("admin-history-list");
const historyMessageEl = document.getElementById("admin-history-message");
const historyRefreshBtn = document.getElementById("admin-history-refresh");
const historyClearBtn = document.getElementById("admin-history-clear");
const historyDateExactEl = document.getElementById("admin-history-date-exact");
const historyDateFromEl = document.getElementById("admin-history-date-from");
const historyDateToEl = document.getElementById("admin-history-date-to");
const historyProviderEl = document.getElementById("admin-history-provider");
const historyUserEl = document.getElementById("admin-history-user");
const historyRangeEl = document.getElementById("admin-history-range");
const historyPageSizeEl = document.getElementById("admin-history-page-size");
const historyPageInfoEl = document.getElementById("admin-history-page-info");
const historyPaginationEl = document.getElementById("admin-history-pagination");

let selectedConversationId = null;
let pollTimer = null;
let allConversations = [];
let activeFilter = "all";
let allRequests = [];
let historyItems = [];
let historyPage = 1;
let historyPageSize = 5;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getRoleGroup(role) {
  if (role === "Provider") return "provider";
  return "user";
}

function renderFilters(items) {
  if (!filtersEl) return;
  const userCount = items.filter((item) => getRoleGroup(item.ParticipantRole) === "user").length;
  const providerCount = items.filter((item) => getRoleGroup(item.ParticipantRole) === "provider").length;
  const allCount = items.length;

  const filters = [
    { key: "all", label: "Osszes", count: allCount },
    { key: "user", label: "Autos", count: userCount },
    { key: "provider", label: "Autómentő", count: providerCount }
  ];

  filtersEl.innerHTML = filters
    .map(
      (filter) =>
        `<button type="button" class="filter-chip${
          activeFilter === filter.key ? " is-active" : ""
        }" data-filter="${filter.key}">${filter.label} (${filter.count})</button>`
    )
    .join("");

  filtersEl.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.getAttribute("data-filter") || "all";
      renderConversationList(allConversations);
    });
  });
}

function renderConversationList(items) {
  renderFilters(items);
  const filtered = items.filter((conversation) => {
    if (activeFilter === "all") return true;
    return getRoleGroup(conversation.ParticipantRole) === activeFilter;
  });

  if (!filtered || filtered.length === 0) {
    listEl.innerHTML = "<p class=\"notice\">Nincs beszélgetés ebben a csoportban.</p>";
    return;
  }

  listEl.innerHTML = filtered
    .map((conversation) => {
      const displayName =
        conversation.ParticipantDisplayName || conversation.ParticipantEmail;
      const hasIncomingMessage =
        conversation.LastSenderRole && conversation.LastSenderRole !== "Admin";
      const statusLabel = hasIncomingMessage
        ? `${displayName} üzenetet küldött`
        : "Legutobbi aktivitasa";
      const preview = conversation.LastMessageBody
        ? escapeHtml(conversation.LastMessageBody)
        : "Nincs még üzenet.";
      const statusText = conversation.Status === "closed" ? "Lezart" : "Nyitott";
      const roleGroup = getRoleGroup(conversation.ParticipantRole);
      const roleLabel = roleGroup === "provider" ? "Autómentő" : "Autos";
      const updatedAt = new Date(
        conversation.LastMessageAt || conversation.UpdatedAt
      ).toLocaleString();

      return `<div class="provider-card conversation-card${
        hasIncomingMessage ? " conversation-card-unread" : ""
      } conversation-role-${roleGroup}" role="button" tabindex="0" data-open="${conversation.Id}">
        <strong>${escapeHtml(displayName)}</strong>
        <div class="notice">${escapeHtml(conversation.ParticipantEmail)} (${escapeHtml(roleLabel)})</div>
        <div class="notice">${escapeHtml(statusLabel)} - ${updatedAt}</div>
        <div class="notice">Allapot: ${escapeHtml(statusText)}</div>
        <div style="margin-top: 6px;">${preview}</div>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll("[data-open]").forEach((row) => {
    const openSelected = () => {
      const id = Number.parseInt(row.getAttribute("data-open"), 10);
      if (Number.isInteger(id)) {
        openConversation(id).catch((err) => {
          messageEl.textContent = err.message;
        });
      }
    };

    row.addEventListener("click", openSelected);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSelected();
      }
    });
  });
}

function renderMessages(conversation) {
  const messages = conversation?.messages || [];
  messagesEl.innerHTML = messages
    .map((message) => {
      const senderName =
        message.SenderRole === "Admin"
          ? "Admin (te)"
          : conversation.ParticipantDisplayName || message.SenderEmail;
      const lineClass = message.SenderRole === "Admin" ? "admin" : "other";

      return `<div class="chat-line ${lineClass}">
        <div class="chat-meta">${escapeHtml(senderName)} - ${new Date(message.CreatedAt).toLocaleString()}</div>
        <div class="chat-bubble">${escapeHtml(message.Body)}</div>
      </div>`;
    })
    .join("");

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatStatus(status) {
  const map = {
    new: "Új",
    accepted: "Elfogadva",
    enroute: "Úton",
    arrived: "Megérkezett",
    completed: "Befejezett",
    cancelled: "Lemondva"
  };
  return map[status] || String(status || "ismeretlen");
}

function canAdminCancelRequest(item) {
  return item && !["completed", "cancelled"].includes(String(item.Status || "").toLowerCase());
}

function renderLabeledRow(label, value) {
  return `<div class="notice admin-detail-row"><span class="admin-detail-label">${label}</span><span class="admin-detail-value">${value}</span></div>`;
}

function renderAdminRequests(items) {
  if (!requestsListEl) return;
  if (!items || items.length === 0) {
    requestsListEl.innerHTML = "<p class=\"notice\">Nincs mentés az adatbázisban.</p>";
    return;
  }

  requestsListEl.innerHTML = items
    .map((item) => {
      const provider = item.ProviderName
        ? `${escapeHtml(item.ProviderName)} (${escapeHtml(item.ProviderPhone || "n/a")})`
        : "Nincs kiválasztott autómentő";
      const pickup = escapeHtml(item.PickupAddress || "Nincs cím");
      const destination = escapeHtml(item.DestinationAddress || "Nincs célcím");
      const jobStatus = formatStatus(item.JobStatus || item.Status);
      const requestStatus = formatStatus(item.Status);
      const updatedAt = new Date(item.UpdatedAt || item.CreatedAt).toLocaleString();
      const canCancel = canAdminCancelRequest(item);

      return `<article class="card" style="margin-top: 10px;">
        <div class="split" style="grid-template-columns: 1fr auto; gap: 10px;">
          <div>
            <strong>Mentés #${item.Id}</strong>
            ${renderLabeledRow("Ügyfél:", escapeHtml(item.UserEmail || "ismeretlen"))}
            ${renderLabeledRow("Indulás:", pickup)}
            ${renderLabeledRow("Cél:", destination)}
            ${renderLabeledRow("Autómentő:", provider)}
            ${renderLabeledRow("Kérés:", `${escapeHtml(requestStatus)} | Munka: ${escapeHtml(jobStatus)}`)}
            ${renderLabeledRow("Frissítve:", updatedAt)}
          </div>
          <div>
            <button class="btn secondary" type="button" data-admin-cancel="${item.Id}" ${
              canCancel ? "" : "disabled"
            }>Lemondás</button>
          </div>
        </div>
      </article>`;
    })
    .join("");

  requestsListEl.querySelectorAll("[data-admin-cancel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number.parseInt(btn.getAttribute("data-admin-cancel"), 10);
      if (!Number.isInteger(id)) return;
      btn.disabled = true;
      try {
        await apiFetch(`/api/requests/${id}/admin-cancel`, { method: "PATCH" });
        if (requestsMessageEl) requestsMessageEl.textContent = `A #${id} mentés le lett mondva.`;
        await loadAdminRequests();
      } catch (err) {
        if (requestsMessageEl) requestsMessageEl.textContent = err.message || "Nem sikerült lemondani a mentést.";
        btn.disabled = false;
      }
    });
  });
}

async function loadAdminRequests() {
  allRequests = await apiFetch("/api/requests/admin/active");
  renderAdminRequests(allRequests);
}

function buildHistoryQuery() {
  const params = new URLSearchParams();
  const dateExact = String(historyDateExactEl?.value || "").trim();
  const dateFrom = String(historyDateFromEl?.value || "").trim();
  const dateTo = String(historyDateToEl?.value || "").trim();
  const provider = String(historyProviderEl?.value || "").trim();
  const user = String(historyUserEl?.value || "").trim();
  const rangeDays = String(historyRangeEl?.value || "").trim();

  if (dateExact) {
    params.set("dateExact", dateExact);
  } else if (rangeDays === "7" || rangeDays === "30") {
    params.set("rangeDays", rangeDays);
  } else {
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
  }

  if (provider) params.set("provider", provider);
  if (user) params.set("user", user);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function renderHistory(items) {
  if (!historyListEl) return;
  const safeItems = Array.isArray(items) ? items : [];
  const totalItems = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / historyPageSize));
  if (historyPage > totalPages) historyPage = totalPages;
  const startIndex = (historyPage - 1) * historyPageSize;
  const endIndex = startIndex + historyPageSize;
  const pagedItems = safeItems.slice(startIndex, endIndex);

  if (historyPageInfoEl) {
    if (totalItems === 0) {
      historyPageInfoEl.textContent = "Nincs találat.";
    } else {
      historyPageInfoEl.textContent = `${startIndex + 1}-${Math.min(endIndex, totalItems)} / ${totalItems}`;
    }
  }

  renderHistoryPagination(totalPages);

  if (!items || items.length === 0) {
    historyListEl.innerHTML = "<p class=\"notice\">Nincs találat a szűrőkre.</p>";
    return;
  }

  historyListEl.innerHTML = pagedItems
    .map((item) => {
      const provider = item.ProviderName
        ? `${escapeHtml(item.ProviderName)} (${escapeHtml(item.ProviderPhone || "n/a")})`
        : "Nincs kiválasztott autómentő";
      const pickup = escapeHtml(item.PickupAddress || "Nincs cím");
      const destination = escapeHtml(item.DestinationAddress || "Nincs célcím");
      const jobStatus = formatStatus(item.JobStatus || item.Status);
      const requestStatus = formatStatus(item.Status);
      const createdAt = new Date(item.CreatedAt).toLocaleString();
      const updatedAt = new Date(item.UpdatedAt || item.CreatedAt).toLocaleString();

      return `<article class="card" style="margin-top: 10px;">
        <strong>Mentés #${item.Id}</strong>
        ${renderLabeledRow("Ügyfél:", escapeHtml(item.UserName || item.UserEmail || "ismeretlen"))}
        ${renderLabeledRow("Ügyfél email:", escapeHtml(item.UserEmail || "ismeretlen"))}
        ${renderLabeledRow("Autómentő:", provider)}
        ${renderLabeledRow("Indulás:", pickup)}
        ${renderLabeledRow("Cél:", destination)}
        ${renderLabeledRow("Kérés:", `${escapeHtml(requestStatus)} | Munka: ${escapeHtml(jobStatus)}`)}
        ${renderLabeledRow("Létrehozva:", createdAt)}
        ${renderLabeledRow("Frissítve:", updatedAt)}
      </article>`;
    })
    .join("");
}

function renderHistoryPagination(totalPages) {
  if (!historyPaginationEl) return;
  if (totalPages <= 1) {
    historyPaginationEl.innerHTML = "";
    return;
  }

  const pageButtons = [];
  for (let i = 1; i <= totalPages; i += 1) {
    pageButtons.push(
      `<button type="button" class="page-btn${i === historyPage ? " is-active" : ""}" data-history-page="${i}">${i}</button>`
    );
  }

  historyPaginationEl.innerHTML = `
    <button type="button" class="page-btn" data-history-page="${Math.max(1, historyPage - 1)}" ${
      historyPage === 1 ? "disabled" : ""
    }>Előző</button>
    ${pageButtons.join("")}
    <button type="button" class="page-btn" data-history-page="${Math.min(totalPages, historyPage + 1)}" ${
      historyPage === totalPages ? "disabled" : ""
    }>Következő</button>
  `;

  historyPaginationEl.querySelectorAll("[data-history-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextPage = Number.parseInt(btn.getAttribute("data-history-page"), 10);
      if (!Number.isInteger(nextPage) || nextPage === historyPage) return;
      historyPage = nextPage;
      renderHistory(historyItems);
    });
  });
}

async function loadHistory() {
  if (historyMessageEl) historyMessageEl.textContent = "";
  const query = buildHistoryQuery();
  historyItems = await apiFetch(`/api/requests/admin/history${query}`);
  historyPage = 1;
  if (historyMessageEl) historyMessageEl.textContent = `${historyItems.length} találat.`;
  renderHistory(historyItems);
}

async function loadConversations() {
  allConversations = await apiFetch("/api/support/admin/conversations");
  renderConversationList(allConversations);
}

async function openConversation(id) {
  selectedConversationId = id;
  const data = await apiFetch(`/api/support/admin/conversations/${id}`);
  const displayName =
    data.conversation.ParticipantDisplayName || data.conversation.ParticipantEmail;
  if (chatCardEl) chatCardEl.style.display = "block";
  if (mainLayoutEl) mainLayoutEl.classList.remove("chat-collapsed");
  titleEl.textContent = `Beszélgetés #${id} - ${displayName}`;
  if (chatPanelEl) chatPanelEl.style.display = "block";
  renderMessages(data.conversation);
}

async function sendMessage() {
  const body = (inputEl.value || "").trim();
  if (!body || !selectedConversationId) return;

  await apiFetch(`/api/support/admin/conversations/${selectedConversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body })
  });

  inputEl.value = "";
  await openConversation(selectedConversationId);
  await loadConversations();
}

async function closeAndDelete() {
  if (!selectedConversationId) return;

  await apiFetch(`/api/support/admin/conversations/${selectedConversationId}/close`, {
    method: "POST"
  });

  selectedConversationId = null;
  titleEl.textContent = "Válassz beszélgetést";
  if (messagesEl) messagesEl.innerHTML = "";
  if (chatPanelEl) chatPanelEl.style.display = "none";
  if (chatCardEl) chatCardEl.style.display = "none";
  if (mainLayoutEl) mainLayoutEl.classList.add("chat-collapsed");
  await loadConversations();
}

function startPolling() {
  if (pollTimer) return;

  pollTimer = setInterval(() => {
    loadConversations().catch(() => {});
    loadAdminRequests().catch(() => {});
    if (selectedConversationId) {
      openConversation(selectedConversationId).catch(() => {});
    }
  }, 3000);
}

sendBtn.addEventListener("click", () => {
  sendMessage().catch((err) => {
    messageEl.textContent = err.message;
  });
});

inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage().catch((err) => {
      messageEl.textContent = err.message;
    });
  }
});

closeBtn.addEventListener("click", () => {
  closeAndDelete().catch((err) => {
    messageEl.textContent = err.message;
  });
});

if (requestsRefreshBtn) {
  requestsRefreshBtn.addEventListener("click", () => {
    if (requestsMessageEl) requestsMessageEl.textContent = "";
    loadAdminRequests().catch((err) => {
      if (requestsMessageEl) {
        requestsMessageEl.textContent = `Hiba a betöltésnél: ${err.message || "Frissítési hiba."}`;
      }
    });
  });
}

if (historyRefreshBtn) {
  historyRefreshBtn.addEventListener("click", () => {
    loadHistory().catch((err) => {
      if (historyMessageEl) {
        historyMessageEl.textContent = `Hiba a betöltésnél: ${err.message || "Frissítési hiba."}`;
      }
    });
  });
}

if (historyClearBtn) {
  historyClearBtn.addEventListener("click", () => {
    if (historyDateExactEl) historyDateExactEl.value = "";
    if (historyDateFromEl) historyDateFromEl.value = "";
    if (historyDateToEl) historyDateToEl.value = "";
    if (historyProviderEl) historyProviderEl.value = "";
    if (historyUserEl) historyUserEl.value = "";
    if (historyRangeEl) historyRangeEl.value = "";
    loadHistory().catch((err) => {
      if (historyMessageEl) {
        historyMessageEl.textContent = `Hiba a betöltésnél: ${err.message || "Frissítési hiba."}`;
      }
    });
  });
}

if (historyPageSizeEl) {
  historyPageSizeEl.addEventListener("change", () => {
    const parsed = Number.parseInt(historyPageSizeEl.value, 10);
    historyPageSize = Number.isInteger(parsed) ? Math.max(1, Math.min(5, parsed)) : 5;
    historyPage = 1;
    renderHistory(historyItems);
  });
}

async function init() {
  if (!getToken()) {
    messageEl.textContent = "Belépés szukseges.";
    return;
  }

  const role = getUserRole();
  if (role !== "Admin") {
    messageEl.textContent = "Nincs jogosultsagod ehhez az oldalhoz.";
    return;
  }

  messageEl.textContent = "";
  if (requestsMessageEl) requestsMessageEl.textContent = "";
  titleEl.textContent = "Válassz beszélgetést";
  if (chatPanelEl) chatPanelEl.style.display = "none";
  if (chatCardEl) chatCardEl.style.display = "none";
  if (mainLayoutEl) mainLayoutEl.classList.add("chat-collapsed");
  await loadConversations();
  await loadAdminRequests();
  await loadHistory();
  startPolling();
}

init().catch((err) => {
  messageEl.textContent = err.message;
});



