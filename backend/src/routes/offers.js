import express from "express";
import { getPool, sql } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authRequired, requireRole("Provider"), async (req, res) => {
  const { requestId, offeredPrice, etaMinutes, message } = req.body || {};

  if (!requestId || typeof offeredPrice !== "number") {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("requestId", sql.Int, requestId)
      .input("providerId", sql.Int, req.user.providerId)
      .input("offeredPrice", sql.Decimal(10, 2), offeredPrice)
      .input("etaMinutes", sql.Int, etaMinutes || null)
      .input("message", sql.VarChar, message || null)
      .query(
        "INSERT INTO Offers (RequestId, ProviderId, OfferedPrice, EtaMinutes, Message, Status) OUTPUT INSERTED.Id VALUES (@requestId, @providerId, @offeredPrice, @etaMinutes, @message, 'open')"
      );

    return res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/", authRequired, requireRole("User"), async (req, res) => {
  const requestId = parseInt(req.query.requestId, 10);
  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("requestId", sql.Int, requestId)
      .query(
        "SELECT o.Id, o.OfferedPrice, o.EtaMinutes, o.Message, o.Status, p.Name, p.Phone FROM Offers o INNER JOIN Providers p ON p.Id = o.ProviderId WHERE o.RequestId = @requestId"
      );

    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;