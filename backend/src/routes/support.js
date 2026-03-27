import express from "express";
import { getPool, sql } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

function sanitizeBody(body) {
  const value = typeof body === "string" ? body.trim() : "";
  return value.length > 2000 ? value.slice(0, 2000) : value;
}

async function getOrCreateOpenConversation(pool, participantUserId) {
  const existing = await pool
    .request()
    .input("participantUserId", sql.Int, participantUserId)
    .query(
      "SELECT TOP 1 Id FROM SupportConversations WHERE ParticipantUserId = @participantUserId AND Status = 'open' ORDER BY UpdatedAt DESC"
    );

  if (existing.recordset.length > 0) {
    return existing.recordset[0].Id;
  }

  const created = await pool
    .request()
    .input("participantUserId", sql.Int, participantUserId)
    .query(
      "INSERT INTO SupportConversations (ParticipantUserId, Status) OUTPUT INSERTED.Id VALUES (@participantUserId, 'open')"
    );

  return created.recordset[0].Id;
}

async function getConversationWithMessages(pool, conversationId) {
  const convo = await pool
    .request()
    .input("id", sql.Int, conversationId)
    .query(
      "SELECT TOP 1 c.Id, c.ParticipantUserId, c.Status, c.CreatedAt, c.UpdatedAt, u.Email AS ParticipantEmail, u.Role AS ParticipantRole, p.Name AS ParticipantProviderName FROM SupportConversations c JOIN Users u ON u.Id = c.ParticipantUserId LEFT JOIN Providers p ON p.UserId = u.Id WHERE c.Id = @id"
    );

  if (convo.recordset.length === 0) return null;

  const messages = await pool
    .request()
    .input("id", sql.Int, conversationId)
    .query(
      "SELECT m.Id, m.ConversationId, m.SenderUserId, m.Body, m.CreatedAt, u.Email AS SenderEmail, u.Role AS SenderRole FROM SupportMessages m JOIN Users u ON u.Id = m.SenderUserId WHERE m.ConversationId = @id ORDER BY m.CreatedAt ASC"
    );

  return {
    ...convo.recordset[0],
    ParticipantDisplayName:
      convo.recordset[0].ParticipantProviderName ||
      convo.recordset[0].ParticipantEmail,
    messages: messages.recordset
  };
}

// User/Provider: get my open conversation (if exists)
router.get("/me", authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input("participantUserId", sql.Int, req.user.userId)
      .query(
        "SELECT TOP 1 Id FROM SupportConversations WHERE ParticipantUserId = @participantUserId AND Status = 'open' ORDER BY UpdatedAt DESC"
      );

    if (existing.recordset.length === 0) {
      return res.json({ conversation: null });
    }

    const conversation = await getConversationWithMessages(
      pool,
      existing.recordset[0].Id
    );
    return res.json({ conversation });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// User/Provider: send message to admin (creates conversation if needed)
router.post("/me/messages", authRequired, async (req, res) => {
  const body = sanitizeBody(req.body?.body);
  if (!body) {
    return res.status(400).json({ error: "Missing message body" });
  }

  try {
    const pool = await getPool();
    const conversationId = await getOrCreateOpenConversation(pool, req.user.userId);

    await pool
      .request()
      .input("conversationId", sql.Int, conversationId)
      .input("senderUserId", sql.Int, req.user.userId)
      .input("body", sql.VarChar, body)
      .query(
        "INSERT INTO SupportMessages (ConversationId, SenderUserId, Body) VALUES (@conversationId, @senderUserId, @body)"
      );

    await pool
      .request()
      .input("id", sql.Int, conversationId)
      .query("UPDATE SupportConversations SET UpdatedAt = GETUTCDATE() WHERE Id = @id");

    return res.status(201).json({ ok: true, conversationId });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// Admin: list conversations
router.get("/admin/conversations", authRequired, requireRole("Admin"), async (req, res) => {
  const status = String(req.query.status || "").toLowerCase();
  try {
    const pool = await getPool();
    let list;
    if (status === "open" || status === "closed") {
      list = await pool
        .request()
        .input("status", sql.VarChar, status)
        .query(
          "SELECT c.Id, c.ParticipantUserId, c.Status, c.CreatedAt, c.UpdatedAt, u.Email AS ParticipantEmail, u.Role AS ParticipantRole, p.Name AS ParticipantProviderName, lastMsg.Body AS LastMessageBody, lastSender.Role AS LastSenderRole, lastMsg.CreatedAt AS LastMessageAt FROM SupportConversations c JOIN Users u ON u.Id = c.ParticipantUserId LEFT JOIN Providers p ON p.UserId = u.Id OUTER APPLY (SELECT TOP 1 m.Body, m.SenderUserId, m.CreatedAt FROM SupportMessages m WHERE m.ConversationId = c.Id ORDER BY m.CreatedAt DESC, m.Id DESC) lastMsg LEFT JOIN Users lastSender ON lastSender.Id = lastMsg.SenderUserId WHERE c.Status = @status ORDER BY c.UpdatedAt DESC"
        );
    } else {
      list = await pool.request().query(
        "SELECT c.Id, c.ParticipantUserId, c.Status, c.CreatedAt, c.UpdatedAt, u.Email AS ParticipantEmail, u.Role AS ParticipantRole, p.Name AS ParticipantProviderName, lastMsg.Body AS LastMessageBody, lastSender.Role AS LastSenderRole, lastMsg.CreatedAt AS LastMessageAt FROM SupportConversations c JOIN Users u ON u.Id = c.ParticipantUserId LEFT JOIN Providers p ON p.UserId = u.Id OUTER APPLY (SELECT TOP 1 m.Body, m.SenderUserId, m.CreatedAt FROM SupportMessages m WHERE m.ConversationId = c.Id ORDER BY m.CreatedAt DESC, m.Id DESC) lastMsg LEFT JOIN Users lastSender ON lastSender.Id = lastMsg.SenderUserId ORDER BY c.UpdatedAt DESC"
      );
    }
    return res.json(
      list.recordset.map((row) => ({
        ...row,
        ParticipantDisplayName: row.ParticipantProviderName || row.ParticipantEmail
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// Admin: get conversation + messages
router.get(
  "/admin/conversations/:id(\\d+)",
  authRequired,
  requireRole("Admin"),
  async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    try {
      const pool = await getPool();
      const conversation = await getConversationWithMessages(pool, id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      return res.json({ conversation });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  }
);

// Admin: send message
router.post(
  "/admin/conversations/:id(\\d+)/messages",
  authRequired,
  requireRole("Admin"),
  async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const body = sanitizeBody(req.body?.body);
    if (!body) {
      return res.status(400).json({ error: "Missing message body" });
    }
    try {
      const pool = await getPool();
      const convo = await pool
        .request()
        .input("id", sql.Int, id)
        .query("SELECT TOP 1 Id, Status FROM SupportConversations WHERE Id = @id");
      if (convo.recordset.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (convo.recordset[0].Status !== "open") {
        return res.status(409).json({ error: "Conversation is closed" });
      }

      await pool
        .request()
        .input("conversationId", sql.Int, id)
        .input("senderUserId", sql.Int, req.user.userId)
        .input("body", sql.VarChar, body)
        .query(
          "INSERT INTO SupportMessages (ConversationId, SenderUserId, Body) VALUES (@conversationId, @senderUserId, @body)"
        );

      await pool
        .request()
        .input("id", sql.Int, id)
        .query("UPDATE SupportConversations SET UpdatedAt = GETUTCDATE() WHERE Id = @id");

      return res.status(201).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  }
);

// Admin: close conversation and delete it (and messages) right away
router.post(
  "/admin/conversations/:id(\\d+)/close",
  authRequired,
  requireRole("Admin"),
  async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    try {
      const pool = await getPool();
      const convo = await pool
        .request()
        .input("id", sql.Int, id)
        .query("SELECT TOP 1 Id FROM SupportConversations WHERE Id = @id");
      if (convo.recordset.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Close (for audit) then delete.
      await pool
        .request()
        .input("id", sql.Int, id)
        .query(
          "UPDATE SupportConversations SET Status = 'closed', UpdatedAt = GETUTCDATE() WHERE Id = @id"
        );

      // Messages will cascade delete.
      await pool
        .request()
        .input("id", sql.Int, id)
        .query("DELETE FROM SupportConversations WHERE Id = @id");

      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
