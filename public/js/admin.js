const messageEl = document.getElementById("admin-message");
const listEl = document.getElementById("admin-conversations");
const titleEl = document.getElementById("admin-convo-title");
const messagesEl = document.getElementById("admin-messages");
const inputEl = document.getElementById("admin-input");
const sendBtn = document.getElementById("admin-send");
const closeBtn = document.getElementById("admin-close");

let selectedConversationId = null;
let pollTimer = null;

function ensureLogoutButton() {
  let logoutBtn = document.getElementById("admin-logout");
  if (logoutBtn) return logoutBtn;

  const sidebar = document.querySelector(".sidebar");
  const anchor = listEl || messageEl;
  if (!sidebar || !anchor) return null;

  const row = document.createElement("div");
  row.className = "cta-row";
  row.style.marginTop = "12px";
  row.style.marginBottom = "12px";

  logoutBtn = document.createElement("button");
  logoutBtn.id = "admin-logout";
  logoutBtn.type = "button";
  logoutBtn.className = "btn secondary";
  logoutBtn.textContent = "Kijelentkezes";

  row.appendChild(logoutBtn);
  sidebar.insertBefore(row, anchor.nextSibling);
  return logoutBtn;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderConversationList(items) {
  if (!items || items.length === 0) {
    listEl.innerHTML = "<p class=\"notice\">Nincs nyitott beszelgetes.</p>";
    return;
  }

  listEl.innerHTML = items
    .map((conversation) => {
      const displayName =
        conversation.ParticipantDisplayName || conversation.ParticipantEmail;
      const hasIncomingMessage =
        conversation.LastSenderRole && conversation.LastSenderRole !== "Admin";
      const statusLabel = hasIncomingMessage
        ? `${displayName} uzenetet kuldott`
        : "Legutobbi aktivitasa";
      const preview = conversation.LastMessageBody
        ? escapeHtml(conversation.LastMessageBody)
        : "Nincs meg uzenet.";
      const updatedAt = new Date(
        conversation.LastMessageAt || conversation.UpdatedAt
      ).toLocaleString();

      return `<div class="provider-card conversation-card${
        hasIncomingMessage ? " conversation-card-unread" : ""
      }">
        <strong>${escapeHtml(displayName)}</strong>
        <div class="notice">${escapeHtml(conversation.ParticipantEmail)} (${escapeHtml(conversation.ParticipantRole)})</div>
        <div class="notice">${escapeHtml(statusLabel)} - ${updatedAt}</div>
        <div style="margin-top: 6px;">${preview}</div>
        <div class="cta-row" style="margin-top: 10px;">
          <button class="btn secondary" data-open="${conversation.Id}">Megnyit</button>
        </div>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll("button[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number.parseInt(btn.getAttribute("data-open"), 10);
      if (Number.isInteger(id)) {
        openConversation(id).catch((err) => {
          messageEl.textContent = err.message;
        });
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
  const items = await apiFetch("/api/support/admin/conversations?status=open");
  renderConversationList(items);
}

async function openConversation(id) {
  selectedConversationId = id;
  const data = await apiFetch(`/api/support/admin/conversations/${id}`);
  const displayName =
    data.conversation.ParticipantDisplayName || data.conversation.ParticipantEmail;
  titleEl.textContent = `Beszelgetes #${id} - ${displayName}`;
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
  titleEl.textContent = "Valassz beszelgetest";
  messagesEl.innerHTML = "";
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
    messageEl.textContent = "Belepes szukseges.";
    return;
  }

  const role = getUserRole();
  if (role !== "Admin") {
    messageEl.textContent = "Nincs jogosultsagod ehhez az oldalhoz.";
    return;
  }

  messageEl.textContent = "";
  const logoutBtn = ensureLogoutButton();
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
    });
  }
  await loadConversations();
  startPolling();
}

init().catch((err) => {
  messageEl.textContent = err.message;
});
