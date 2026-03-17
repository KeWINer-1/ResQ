import express from "express";
import { getPool, sql } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

const JOB_STATUSES = new Set([
  "accepted",
  "enroute",
  "arrived",
  "completed",
  "cancelled"
]);

router.post("/", authRequired, requireRole("User"), async (req, res) => {
  const { pickupLat, pickupLng, pickupAddress, problemType, notes, selectedProviderId } =
    req.body || {};

  if (typeof pickupLat !== "number" || typeof pickupLng !== "number") {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .input("pickupLat", sql.Decimal(10, 6), pickupLat)
      .input("pickupLng", sql.Decimal(10, 6), pickupLng)
      .input("pickupAddress", sql.VarChar, pickupAddress || null)
      .input("problemType", sql.VarChar, problemType || null)
      .input("notes", sql.VarChar, notes || null)
      .input("selectedProviderId", sql.Int, selectedProviderId || null)
      .query(
        "INSERT INTO ServiceRequests (UserId, PickupLat, PickupLng, PickupAddress, ProblemType, Notes, SelectedProviderId, Status) OUTPUT INSERTED.Id VALUES (@userId, @pickupLat, @pickupLng, @pickupAddress, @problemType, @notes, @selectedProviderId, 'new')"
      );

    return res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id(\\d+)", authRequired, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        "SELECT TOP 1 r.Id, r.UserId, r.SelectedProviderId, r.PickupLat, r.PickupLng, r.PickupAddress, r.ProblemType, r.Notes, r.Status, r.CreatedAt, r.UpdatedAt, p.Name AS ProviderName, p.Phone AS ProviderPhone FROM ServiceRequests r LEFT JOIN Providers p ON p.Id = r.SelectedProviderId WHERE r.Id = @id"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = result.recordset[0];

    const isUserOwner = req.user?.role === "User" && req.user?.userId === row.UserId;
    const isSelectedProvider =
      req.user?.role === "Provider" && req.user?.providerId === row.SelectedProviderId;

    if (!isUserOwner && !isSelectedProvider) {
      return res.status(403).json({ error: "Forbidden" });
    }

    let job = null;
    if (row.SelectedProviderId) {
      const jobResult = await pool
        .request()
        .input("requestId", sql.Int, row.Id)
        .input("providerId", sql.Int, row.SelectedProviderId)
        .query(
          "SELECT TOP 1 Id, Status, CreatedAt, UpdatedAt FROM Jobs WHERE RequestId = @requestId AND ProviderId = @providerId ORDER BY UpdatedAt DESC"
        );
      job = jobResult.recordset[0] || null;
    }

    return res.json({
      id: row.Id,
      pickupLat: row.PickupLat,
      pickupLng: row.PickupLng,
      pickupAddress: row.PickupAddress,
      problemType: row.ProblemType,
      notes: row.Notes,
      status: row.Status,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      provider: row.SelectedProviderId
        ? {
            id: row.SelectedProviderId,
            name: row.ProviderName,
            phone: row.ProviderPhone
          }
        : null,
      job
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", authRequired, requireRole("User"), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .query(
        "SELECT r.Id, r.PickupLat, r.PickupLng, r.PickupAddress, r.ProblemType, r.Notes, r.Status, r.CreatedAt, r.SelectedProviderId, p.Name AS ProviderName, p.Phone AS ProviderPhone, j.Status AS JobStatus FROM ServiceRequests r LEFT JOIN Providers p ON p.Id = r.SelectedProviderId LEFT JOIN Jobs j ON j.RequestId = r.Id AND j.ProviderId = r.SelectedProviderId WHERE r.UserId = @userId ORDER BY r.CreatedAt DESC"
      );

    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/provider", authRequired, requireRole("Provider"), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("providerId", sql.Int, req.user.providerId)
      .query(
        "SELECT r.Id, r.PickupLat, r.PickupLng, r.PickupAddress, r.ProblemType, r.Notes, r.Status, r.CreatedAt, j.Status AS JobStatus FROM ServiceRequests r LEFT JOIN Jobs j ON j.RequestId = r.Id AND j.ProviderId = r.SelectedProviderId WHERE r.SelectedProviderId = @providerId ORDER BY r.CreatedAt DESC"
      );

    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id(\\d+)/status", authRequired, requireRole("Provider"), async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  const { status } = req.body || {};
  if (typeof status !== "string" || !JOB_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const pool = await getPool();
    const requestResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT TOP 1 Id, SelectedProviderId FROM ServiceRequests WHERE Id = @id");

    if (requestResult.recordset.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = requestResult.recordset[0];
    if (!row.SelectedProviderId || row.SelectedProviderId !== req.user.providerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const mappedRequestStatus =
      status === "completed"
        ? "completed"
        : status === "cancelled"
          ? "cancelled"
          : "accepted";

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("providerId", sql.Int, req.user.providerId)
      .query(
        "IF EXISTS (SELECT 1 FROM Jobs WHERE RequestId = @requestId AND ProviderId = @providerId)\nUPDATE Jobs SET UpdatedAt = GETUTCDATE() WHERE RequestId = @requestId AND ProviderId = @providerId\nELSE\nINSERT INTO Jobs (RequestId, ProviderId, Status) VALUES (@requestId, @providerId, 'accepted')"
      );

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("providerId", sql.Int, req.user.providerId)
      .input("status", sql.VarChar, status)
      .query(
        "UPDATE Jobs SET Status = @status, UpdatedAt = GETUTCDATE() WHERE RequestId = @requestId AND ProviderId = @providerId"
      );

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("status", sql.VarChar, mappedRequestStatus)
      .query("UPDATE ServiceRequests SET Status = @status, UpdatedAt = GETUTCDATE() WHERE Id = @requestId");

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
