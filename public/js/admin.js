const messageEl = document.getElementById("admin-message");
const filtersEl = document.getElementById("admin-filters");
const listEl = document.getElementById("admin-conversations");
const titleEl = document.getElementById("admin-convo-title");
const chatPanelEl = document.getElementById("admin-chat-panel");
const messagesEl = document.getElementById("admin-messages");
const inputEl = document.getElementById("admin-input");
const sendBtn = document.getElementById("admin-send");
const closeBtn = document.getElementById("admin-close");

let selectedConversationId = null;
let pollTimer = null;
let allConversations = [];
let activeFilter = "all";

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

async function loadConversations() {
  allConversations = await apiFetch("/api/support/admin/conversations");
  renderConversationList(allConversations);
}

async function openConversation(id) {
  selectedConversationId = id;
  const data = await apiFetch(`/api/support/admin/conversations/${id}`);
  const displayName =
    data.conversation.ParticipantDisplayName || data.conversation.ParticipantEmail;
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
  await loadConversations();
}

function startPolling() {
  if (pollTimer) return;

  pollTimer = setInterval(() => {
    loadConversations().catch(() => {});
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
  titleEl.textContent = "Válassz beszélgetést";
  if (chatPanelEl) chatPanelEl.style.display = "none";
  await loadConversations();
  startPolling();
}

init().catch((err) => {
  messageEl.textContent = err.message;
});
