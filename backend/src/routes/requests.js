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

function sanitizeBody(body) {
  const value = typeof body === "string" ? body.trim() : "";
  return value.length > 2000 ? value.slice(0, 2000) : value;
}

router.get("/admin/all", authRequired, requireRole("Admin"), async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT TOP 300 r.Id, r.UserId, r.SelectedProviderId, r.PickupAddress, r.DestinationAddress, r.Status, r.CreatedAt, r.UpdatedAt, u.Email AS UserEmail, p.Name AS ProviderName, p.Phone AS ProviderPhone, j.Status AS JobStatus FROM ServiceRequests r JOIN Users u ON u.Id = r.UserId LEFT JOIN Providers p ON p.Id = r.SelectedProviderId LEFT JOIN Jobs j ON j.RequestId = r.Id AND j.ProviderId = r.SelectedProviderId ORDER BY r.UpdatedAt DESC, r.Id DESC"
    );
    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/active", authRequired, requireRole("Admin"), async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT TOP 300 r.Id, r.UserId, r.SelectedProviderId, r.PickupAddress, r.DestinationAddress, r.Status, r.CreatedAt, r.UpdatedAt, u.Email AS UserEmail, p.Name AS ProviderName, p.Phone AS ProviderPhone, j.Status AS JobStatus FROM ServiceRequests r JOIN Users u ON u.Id = r.UserId LEFT JOIN Providers p ON p.Id = r.SelectedProviderId LEFT JOIN Jobs j ON j.RequestId = r.Id AND j.ProviderId = r.SelectedProviderId WHERE r.Status IN ('new', 'accepted') OR j.Status IN ('accepted', 'enroute', 'arrived') ORDER BY r.UpdatedAt DESC, r.Id DESC"
    );
    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/history", authRequired, requireRole("Admin"), async (req, res) => {
  const dateExactRaw = String(req.query.dateExact || "").trim();
  const rangeDaysRaw = String(req.query.rangeDays || "").trim();
  const dateFromRaw = String(req.query.dateFrom || "").trim();
  const dateToRaw = String(req.query.dateTo || "").trim();
  const providerRaw = String(req.query.provider || "").trim();
  const userRaw = String(req.query.user || "").trim();
  const isDateExactValid = /^\d{4}-\d{2}-\d{2}$/.test(dateExactRaw);
  const isDateFromValid = /^\d{4}-\d{2}-\d{2}$/.test(dateFromRaw);
  const isDateToValid = /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw);
  const rangeDays =
    rangeDaysRaw === "7" || rangeDaysRaw === "30" ? Number.parseInt(rangeDaysRaw, 10) : null;

  let dateFrom = null;
  let dateTo = null;

  if (isDateExactValid) {
    dateFrom = new Date(`${dateExactRaw}T00:00:00.000Z`);
    dateTo = new Date(`${dateExactRaw}T23:59:59.999Z`);
  } else if (rangeDays) {
    const now = new Date();
    dateTo = new Date(now);
    dateFrom = new Date(now);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - rangeDays);
  } else {
    dateFrom = isDateFromValid ? new Date(`${dateFromRaw}T00:00:00.000Z`) : null;
    dateTo = isDateToValid ? new Date(`${dateToRaw}T23:59:59.999Z`) : null;
  }

  const providerLike = providerRaw ? `%${providerRaw}%` : null;
  const userLike = userRaw ? `%${userRaw}%` : null;

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input("dateFrom", sql.DateTime2, dateFrom);
    request.input("dateTo", sql.DateTime2, dateTo);
    request.input("providerLike", sql.VarChar, providerLike);
    request.input("userLike", sql.VarChar, userLike);

    const result = await request.query(
      "SELECT TOP 1000 r.Id, r.UserId, r.SelectedProviderId, r.PickupAddress, r.DestinationAddress, r.Status, r.CreatedAt, r.UpdatedAt, u.Email AS UserEmail, u.Name AS UserName, p.Name AS ProviderName, p.Phone AS ProviderPhone, j.Status AS JobStatus FROM ServiceRequests r JOIN Users u ON u.Id = r.UserId LEFT JOIN Providers p ON p.Id = r.SelectedProviderId LEFT JOIN Jobs j ON j.RequestId = r.Id AND j.ProviderId = r.SelectedProviderId WHERE (@dateFrom IS NULL OR r.CreatedAt >= @dateFrom) AND (@dateTo IS NULL OR r.CreatedAt <= @dateTo) AND (@providerLike IS NULL OR p.Name LIKE @providerLike OR p.Phone LIKE @providerLike) AND (@userLike IS NULL OR u.Email LIKE @userLike OR u.Name LIKE @userLike) ORDER BY r.CreatedAt DESC, r.Id DESC"
    );
    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authRequired, requireRole("User"), async (req, res) => {
  const {
    pickupLat,
    pickupLng,
    pickupAddress,
    destinationLat,
    destinationLng,
    destinationAddress,
    problemType,
    notes,
    selectedProviderId,
    estimatedPrice
  } = req.body || {};

  if (typeof pickupLat !== "number" || typeof pickupLng !== "number") {
    return res.status(400).json({ error: "Invalid coordinates" });
  }
  if (
    (destinationLat !== null && destinationLat !== undefined && typeof destinationLat !== "number") ||
    (destinationLng !== null && destinationLng !== undefined && typeof destinationLng !== "number") ||
    ((destinationLat !== null && destinationLat !== undefined) !== (destinationLng !== null && destinationLng !== undefined))
  ) {
    return res.status(400).json({ error: "Invalid destination coordinates" });
  }

  try {
    const pool = await getPool();
    if (selectedProviderId) {
      const providerCheck = await pool
        .request()
        .input("providerId", sql.Int, selectedProviderId)
        .query(
          "SELECT TOP 1 p.Id, p.IsOnline FROM Providers p WHERE p.Id = @providerId"
        );
      if (providerCheck.recordset.length === 0) {
        return res.status(404).json({ error: "Provider not found" });
      }
      const isOnline = providerCheck.recordset[0].IsOnline === true || providerCheck.recordset[0].IsOnline === 1;
      if (!isOnline) {
        return res.status(409).json({ error: "Az autómentő jelenleg nem elérhető." });
      }

      const activeJob = await pool
        .request()
        .input("providerId", sql.Int, selectedProviderId)
        .query(
          "SELECT TOP 1 Id FROM Jobs WHERE ProviderId = @providerId AND Status IN ('accepted', 'enroute', 'arrived')"
        );
      if (activeJob.recordset.length > 0) {
        return res.status(409).json({ error: "Az autómentő már másik mentésen van." });
      }
    }
    const result = await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .input("pickupLat", sql.Decimal(10, 6), pickupLat)
      .input("pickupLng", sql.Decimal(10, 6), pickupLng)
      .input("pickupAddress", sql.VarChar, pickupAddress || null)
      .input("destinationLat", sql.Decimal(10, 6), destinationLat ?? null)
      .input("destinationLng", sql.Decimal(10, 6), destinationLng ?? null)
      .input("destinationAddress", sql.VarChar, destinationAddress || null)
      .input("problemType", sql.VarChar, problemType || null)
      .input("notes", sql.VarChar, notes || null)
      .input("selectedProviderId", sql.Int, selectedProviderId || null)
      .query(
        "INSERT INTO ServiceRequests (UserId, PickupLat, PickupLng, PickupAddress, DestinationLat, DestinationLng, DestinationAddress, ProblemType, Notes, SelectedProviderId, Status) OUTPUT INSERTED.Id VALUES (@userId, @pickupLat, @pickupLng, @pickupAddress, @destinationLat, @destinationLng, @destinationAddress, @problemType, @notes, @selectedProviderId, 'new')"
      );
    const requestId = result.recordset[0].Id;
    const safeEstimatedPrice = Number(estimatedPrice);
    if (
      selectedProviderId &&
      Number.isFinite(safeEstimatedPrice) &&
      safeEstimatedPrice >= 0
    ) {
      await pool
        .request()
        .input("requestId", sql.Int, requestId)
        .input("providerId", sql.Int, selectedProviderId)
        .input("offeredPrice", sql.Decimal(10, 2), safeEstimatedPrice)
        .query(
          "INSERT INTO Offers (RequestId, ProviderId, OfferedPrice, Status) VALUES (@requestId, @providerId, @offeredPrice, 'accepted')"
        );
    }

    return res.status(201).json({ id: requestId });
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
        "SELECT TOP 1 r.Id, r.UserId, r.SelectedProviderId, r.PickupLat, r.PickupLng, r.PickupAddress, r.DestinationLat, r.DestinationLng, r.DestinationAddress, r.ProblemType, r.Notes, r.Status, r.CreatedAt, r.UpdatedAt, p.Name AS ProviderName, p.Phone AS ProviderPhone, p.LastLat AS ProviderLat, p.LastLng AS ProviderLng, p.LastLocationAt AS ProviderLocationAt, p.BaseFee AS ProviderBaseFee, p.PerKmFee AS ProviderPerKmFee FROM ServiceRequests r LEFT JOIN Providers p ON p.Id = r.SelectedProviderId WHERE r.Id = @id"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = result.recordset[0];

    const isUserOwner = req.user?.role === "User" && req.user?.userId === row.UserId;
    const isSelectedProvider =
      req.user?.role === "Provider" && req.user?.providerId === row.SelectedProviderId;
    const isAdmin = req.user?.role === "Admin";

    if (!isUserOwner && !isSelectedProvider && !isAdmin) {
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
      destinationLat: row.DestinationLat,
      destinationLng: row.DestinationLng,
      destinationAddress: row.DestinationAddress,
      problemType: row.ProblemType,
      notes: row.Notes,
      status: row.Status,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      provider: row.SelectedProviderId
        ? {
            id: row.SelectedProviderId,
            name: row.ProviderName,
            phone: row.ProviderPhone,
            lat: row.ProviderLat,
            lng: row.ProviderLng,
            lastLocationAt: row.ProviderLocationAt,
            baseFee: row.ProviderBaseFee,
            perKmFee: row.ProviderPerKmFee
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
        "SELECT r.Id, r.PickupLat, r.PickupLng, r.PickupAddress, r.DestinationLat, r.DestinationLng, r.DestinationAddress, r.ProblemType, r.Notes, r.Status, r.CreatedAt, r.SelectedProviderId, p.Name AS ProviderName, p.Phone AS ProviderPhone, j.Status AS JobStatus, o.OfferedPrice AS EstimatedPrice FROM ServiceRequests r LEFT JOIN Providers p ON p.Id = r.SelectedProviderId LEFT JOIN Jobs j ON j.RequestId = r.Id AND j.ProviderId = r.SelectedProviderId OUTER APPLY (SELECT TOP 1 OfferedPrice FROM Offers WHERE RequestId = r.Id AND ProviderId = r.SelectedProviderId AND Status = 'accepted' ORDER BY UpdatedAt DESC, Id DESC) o WHERE r.UserId = @userId ORDER BY r.CreatedAt DESC"
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
        "SELECT r.Id, r.PickupLat, r.PickupLng, r.PickupAddress, r.DestinationLat, r.DestinationLng, r.DestinationAddress, r.ProblemType, r.Notes, r.Status, r.CreatedAt, j.Status AS JobStatus, o.OfferedPrice AS EstimatedPrice FROM ServiceRequests r LEFT JOIN Jobs j ON j.RequestId = r.Id AND j.ProviderId = r.SelectedProviderId OUTER APPLY (SELECT TOP 1 OfferedPrice FROM Offers WHERE RequestId = r.Id AND ProviderId = r.SelectedProviderId AND Status = 'accepted' ORDER BY UpdatedAt DESC, Id DESC) o WHERE r.SelectedProviderId = @providerId ORDER BY r.CreatedAt DESC"
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

    if (status === "accepted" || status === "enroute" || status === "arrived") {
      await pool
        .request()
        .input("providerId", sql.Int, req.user.providerId)
        .query(
          "UPDATE Providers SET IsOnline = 0, LastSeenAt = GETUTCDATE() WHERE Id = @providerId"
        );
    }
    if (status === "completed" || status === "cancelled") {
      await pool
        .request()
        .input("providerId", sql.Int, req.user.providerId)
        .query(
          "UPDATE Providers SET IsOnline = 1, LastSeenAt = GETUTCDATE() WHERE Id = @providerId"
        );
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id(\\d+)/cancel", authRequired, requireRole("User"), async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  try {
    const pool = await getPool();
    const requestResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT TOP 1 Id, UserId, Status, SelectedProviderId FROM ServiceRequests WHERE Id = @id");

    if (requestResult.recordset.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = requestResult.recordset[0];
    if (row.UserId !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const jobResult = await pool
      .request()
      .input("requestId", sql.Int, id)
      .query("SELECT TOP 1 Status FROM Jobs WHERE RequestId = @requestId");
    const jobStatus = jobResult.recordset[0]?.Status || null;
    if (["enroute", "arrived"].includes(jobStatus)) {
      return res.status(409).json({ error: "Lemondas csak ugyfelszolgalaton." });
    }

    if (row.Status === "completed") {
      return res.status(409).json({ error: "Request already completed" });
    }

    if (row.Status === "cancelled") {
      return res.json({ ok: true });
    }

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("status", sql.VarChar, "cancelled")
      .query(
        "UPDATE ServiceRequests SET Status = @status, UpdatedAt = GETUTCDATE() WHERE Id = @requestId"
      );

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("providerId", sql.Int, row.SelectedProviderId || null)
      .input("status", sql.VarChar, "cancelled")
      .query(
        "UPDATE Jobs SET Status = @status, UpdatedAt = GETUTCDATE() WHERE RequestId = @requestId AND ProviderId = @providerId"
      );

    if (row.SelectedProviderId) {
      await pool
        .request()
        .input("providerId", sql.Int, row.SelectedProviderId)
        .query("UPDATE Providers SET IsOnline = 1 WHERE Id = @providerId");
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id(\\d+)/admin-cancel", authRequired, requireRole("Admin"), async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  try {
    const pool = await getPool();
    const requestResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT TOP 1 Id, Status, SelectedProviderId FROM ServiceRequests WHERE Id = @id");

    if (requestResult.recordset.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = requestResult.recordset[0];
    if (row.Status === "completed" || row.Status === "cancelled") {
      return res.json({ ok: true });
    }

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .query(
        "UPDATE ServiceRequests SET Status = 'cancelled', UpdatedAt = GETUTCDATE() WHERE Id = @requestId"
      );

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .query(
        "UPDATE Jobs SET Status = 'cancelled', UpdatedAt = GETUTCDATE() WHERE RequestId = @requestId AND Status IN ('accepted', 'enroute', 'arrived')"
      );

    if (row.SelectedProviderId) {
      await pool
        .request()
        .input("providerId", sql.Int, row.SelectedProviderId)
        .query(
          "UPDATE Providers SET IsOnline = 1, LastSeenAt = GETUTCDATE() WHERE Id = @providerId"
        );
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id(\\d+)/messages", authRequired, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  try {
    const pool = await getPool();
    const requestResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        "SELECT TOP 1 Id, UserId, SelectedProviderId, Status FROM ServiceRequests WHERE Id = @id"
      );

    if (requestResult.recordset.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = requestResult.recordset[0];
    const isUserOwner = req.user?.role === "User" && req.user?.userId === row.UserId;
    const isSelectedProvider =
      req.user?.role === "Provider" && req.user?.providerId === row.SelectedProviderId;
    const isAdmin = req.user?.role === "Admin";

    if (!isUserOwner && !isSelectedProvider && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const messages = await pool
      .request()
      .input("requestId", sql.Int, id)
      .query(
        "SELECT m.Id, m.RequestId, m.SenderUserId, m.Body, m.CreatedAt, u.Role AS SenderRole, u.Email AS SenderEmail, p.Name AS SenderProviderName FROM RequestMessages m JOIN Users u ON u.Id = m.SenderUserId LEFT JOIN Providers p ON p.UserId = u.Id WHERE m.RequestId = @requestId ORDER BY m.CreatedAt ASC, m.Id ASC"
      );

    return res.json({ messages: messages.recordset });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id(\\d+)/messages", authRequired, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  const body = sanitizeBody(req.body?.body);
  if (!body) {
    return res.status(400).json({ error: "Missing message body" });
  }

  try {
    const pool = await getPool();
    const requestResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        "SELECT TOP 1 Id, UserId, SelectedProviderId, Status FROM ServiceRequests WHERE Id = @id"
      );

    if (requestResult.recordset.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = requestResult.recordset[0];
    const isUserOwner = req.user?.role === "User" && req.user?.userId === row.UserId;
    const isSelectedProvider =
      req.user?.role === "Provider" && req.user?.providerId === row.SelectedProviderId;
    const isAdmin = req.user?.role === "Admin";

    if (!isUserOwner && !isSelectedProvider && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!row.SelectedProviderId) {
      return res.status(409).json({ error: "Provider not selected yet" });
    }

    if (row.Status === "cancelled" || row.Status === "completed") {
      return res.status(409).json({ error: "Request already closed" });
    }

    await pool
      .request()
      .input("requestId", sql.Int, id)
      .input("senderUserId", sql.Int, req.user.userId)
      .input("body", sql.VarChar, body)
      .query(
        "INSERT INTO RequestMessages (RequestId, SenderUserId, Body) VALUES (@requestId, @senderUserId, @body)"
      );

    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
