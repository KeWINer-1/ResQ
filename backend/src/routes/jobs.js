import express from "express";
import { getPool, sql } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/accept", authRequired, requireRole("User"), async (req, res) => {
  const { offerId } = req.body || {};
  if (!offerId) {
    return res.status(400).json({ error: "Missing offerId" });
  }

  try {
    const pool = await getPool();
    const offerResult = await pool
      .request()
      .input("offerId", sql.Int, offerId)
      .query(
        "SELECT RequestId, ProviderId FROM Offers WHERE Id = @offerId"
      );

    if (offerResult.recordset.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerResult.recordset[0];
    const jobResult = await pool
      .request()
      .input("requestId", sql.Int, offer.RequestId)
      .input("providerId", sql.Int, offer.ProviderId)
      .query(
        "INSERT INTO Jobs (RequestId, ProviderId, Status) OUTPUT INSERTED.Id VALUES (@requestId, @providerId, 'accepted')"
      );

    await pool
      .request()
      .input("offerId", sql.Int, offerId)
      .query("UPDATE Offers SET Status = 'accepted' WHERE Id = @offerId");

    await pool
      .request()
      .input("requestId", sql.Int, offer.RequestId)
      .query("UPDATE ServiceRequests SET Status = 'accepted' WHERE Id = @requestId");

    return res.status(201).json({ id: jobResult.recordset[0].Id });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/status", authRequired, requireRole("Provider"), async (req, res) => {
  const status = req.body?.status;
  const id = parseInt(req.params.id, 10);
  const allowed = ["accepted", "enroute", "arrived", "completed", "cancelled"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.VarChar, status)
      .query("UPDATE Jobs SET Status = @status, UpdatedAt = GETUTCDATE() WHERE Id = @id");

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/rating", authRequired, requireRole("User"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { stars, comment } = req.body || {};
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: "Invalid stars" });
  }

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("jobId", sql.Int, id)
      .input("userId", sql.Int, req.user.userId)
      .input("stars", sql.Int, stars)
      .input("comment", sql.VarChar, comment || null)
      .query(
        "INSERT INTO Ratings (JobId, UserId, Stars, Comment) VALUES (@jobId, @userId, @stars, @comment)"
      );

    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;