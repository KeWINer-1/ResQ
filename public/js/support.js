const messageEl = document.getElementById("support-message");
const chatEl = document.getElementById("support-chat");
const messagesEl = document.getElementById("support-messages");
const inputEl = document.getElementById("support-input");
const sendBtn = document.getElementById("support-send");

let pollTimer = null;

function renderMessages(conversation) {
  const msgs = conversation?.messages || [];
  messagesEl.innerHTML = msgs
    .map((m) => {
      const mine = m.SenderUserId === conversation.ParticipantUserId;
      const who = m.SenderRole === "Admin" ? "Admin" : mine ? "Te" : "Másik fél";
      const cls = m.SenderRole === "Admin" ? "admin" : mine ? "me" : "other";
      return `<div class="chat-line ${cls}">
        <div class="chat-meta">${who} • ${new Date(m.CreatedAt).toLocaleString()}</div>
        <div class="chat-bubble">${escapeHtml(m.Body)}</div>
      </div>`;
    })
    .join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function loadConversation() {
  const data = await apiFetch("/api/support/me");
  if (!data.conversation) {
    messagesEl.innerHTML =
      "<p class=\"notice\">Még nincs beszélgetés. Írj egy üzenetet, és létrejön.</p>";
    return;
  }
  renderMessages(data.conversation);
}

async function sendMessage() {
  const body = (inputEl.value || "").trim();
  if (!body) return;
  await apiFetch("/api/support/me/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body })
  });
  inputEl.value = "";
  await loadConversation();
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    loadConversation().catch(() => {});
  }, 3000);
}

sendBtn.addEventListener("click", () => {
  sendMessage().catch((err) => {
    messageEl.textContent = err.message;
  });
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage().catch((err) => {
      messageEl.textContent = err.message;
    });
  }
});

async function init() {
  if (!getToken()) {
    messageEl.textContent = "Belépés szükséges az üzenetküldéshez.";
    chatEl.style.display = "none";
    return;
  }
  messageEl.textContent = "";
  chatEl.style.display = "block";
  await loadConversation();
  startPolling();
}

init().catch((err) => {
  messageEl.textContent = err.message;
});

