import express from "express";
import { getPool, sql } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/nearby", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusKm = parseFloat(req.query.radiusKm || "20");
  const capability = req.query.capability;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  try {
    const pool = await getPool();
    const providers = await pool.request().query(
      "SELECT p.Id, p.Name, p.Phone, p.LastLat, p.LastLng, p.BaseFee, p.PerKmFee, p.IsOnline FROM Providers p WHERE p.IsOnline = 1 AND p.LastLat IS NOT NULL AND p.LastLng IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Jobs j WHERE j.ProviderId = p.Id AND j.Status IN ('accepted', 'enroute', 'arrived'))"
    );

    let filtered = providers.recordset
      .map((provider) => {
        const distanceKm = haversineKm(lat, lng, provider.LastLat, provider.LastLng);
        return { ...provider, DistanceKm: distanceKm };
      })
      .filter((provider) => provider.DistanceKm <= radiusKm);

    if (capability) {
      const capsResult = await pool.request().query(
        "SELECT ProviderId, Capability FROM ProviderCapabilities"
      );
      const capMap = new Map();
      for (const row of capsResult.recordset) {
        if (!capMap.has(row.ProviderId)) {
          capMap.set(row.ProviderId, []);
        }
        capMap.get(row.ProviderId).push(row.Capability);
      }
      filtered = filtered.filter((provider) => {
        const caps = capMap.get(provider.Id) || [];
        return caps.includes(capability);
      });
    }

    const caps = await pool.request().query(
      "SELECT ProviderId, Capability FROM ProviderCapabilities"
    );
    const capMap = new Map();
    for (const row of caps.recordset) {
      if (!capMap.has(row.ProviderId)) {
        capMap.set(row.ProviderId, []);
      }
      capMap.get(row.ProviderId).push(row.Capability);
    }

    const ratingsResult = await pool.request().query(
      "SELECT p.Id AS ProviderId, CAST(AVG(CAST(r.Stars AS DECIMAL(10,2))) AS DECIMAL(10,2)) AS AvgStars FROM Providers p LEFT JOIN Jobs j ON j.ProviderId = p.Id LEFT JOIN Ratings r ON r.JobId = j.Id GROUP BY p.Id"
    );
    const ratingMap = new Map();
    for (const row of ratingsResult.recordset) {
      if (row.AvgStars == null) continue;
      ratingMap.set(row.ProviderId, Number(row.AvgStars));
    }

    const response = filtered.map((provider) => ({
      id: provider.Id,
      name: provider.Name,
      phone: provider.Phone,
      lat: provider.LastLat,
      lng: provider.LastLng,
      baseFee: provider.BaseFee,
      perKmFee: provider.PerKmFee,
      distanceKm: Math.round(provider.DistanceKm * 10) / 10,
      capabilities: capMap.get(provider.Id) || [],
      rating: ratingMap.has(provider.Id) ? ratingMap.get(provider.Id) : null
    }));

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", authRequired, requireRole("Provider"), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("providerId", sql.Int, req.user.providerId)
      .query(
        "SELECT Id, Name, Phone, ServiceRadiusKm, BaseFee, PerKmFee, IsOnline, LastLat, LastLng FROM Providers WHERE Id = @providerId"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const caps = await pool
      .request()
      .input("providerId", sql.Int, req.user.providerId)
      .query(
        "SELECT Capability FROM ProviderCapabilities WHERE ProviderId = @providerId"
      );

    return res.json({
      ...result.recordset[0],
      capabilities: caps.recordset.map((row) => row.Capability)
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/me/ratings", authRequired, requireRole("Provider"), async (req, res) => {
  try {
    const pool = await getPool();
    let providerId = req.user.providerId;
    if (!providerId) {
      const providerRow = await pool
        .request()
        .input("userId", sql.Int, req.user.userId)
        .query("SELECT TOP 1 Id FROM Providers WHERE UserId = @userId");
      providerId = providerRow.recordset[0]?.Id || null;
    }

    if (!providerId) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const summaryResult = await pool
      .request()
      .input("providerId", sql.Int, providerId)
      .query(
        "SELECT COUNT(1) AS TotalCount, CAST(AVG(CAST(r.Stars AS DECIMAL(10,2))) AS DECIMAL(10,2)) AS AvgStars FROM Ratings r JOIN Jobs j ON j.Id = r.JobId JOIN ServiceRequests s ON s.Id = j.RequestId WHERE j.ProviderId = @providerId OR s.SelectedProviderId = @providerId"
      );

    const itemsResult = await pool
      .request()
      .input("providerId", sql.Int, providerId)
      .query(
        "SELECT TOP 200 r.Id, r.Stars, r.Comment, r.CreatedAt, u.Email AS UserEmail FROM Ratings r JOIN Jobs j ON j.Id = r.JobId JOIN ServiceRequests s ON s.Id = j.RequestId JOIN Users u ON u.Id = r.UserId WHERE j.ProviderId = @providerId OR s.SelectedProviderId = @providerId ORDER BY r.CreatedAt DESC, r.Id DESC"
      );

    const summary = summaryResult.recordset[0] || { TotalCount: 0, AvgStars: null };
    return res.json({
      totalCount: Number(summary.TotalCount || 0),
      avgStars: summary.AvgStars == null ? null : Number(summary.AvgStars),
      items: itemsResult.recordset
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/me/stats", authRequired, requireRole("Provider"), async (req, res) => {
  try {
    const pool = await getPool();
    let providerId = req.user.providerId;
    if (!providerId) {
      const providerRow = await pool
        .request()
        .input("userId", sql.Int, req.user.userId)
        .query("SELECT TOP 1 Id FROM Providers WHERE UserId = @userId");
      providerId = providerRow.recordset[0]?.Id || null;
    }

    if (!providerId) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const statsResult = await pool
      .request()
      .input("providerId", sql.Int, providerId)
      .query(
        "SELECT COUNT(1) AS CompletedTrips, ISNULL(SUM(COALESCE(o.OfferedPrice, 0)), 0) AS TotalEarnings FROM Jobs j OUTER APPLY (SELECT TOP 1 OfferedPrice FROM Offers WHERE RequestId = j.RequestId AND ProviderId = j.ProviderId AND Status = 'accepted' ORDER BY UpdatedAt DESC, Id DESC) o WHERE j.ProviderId = @providerId AND j.Status = 'completed'"
      );

    const ratingResult = await pool
      .request()
      .input("providerId", sql.Int, providerId)
      .query(
        "SELECT COUNT(1) AS TotalRatings, CAST(AVG(CAST(r.Stars AS DECIMAL(10,2))) AS DECIMAL(10,2)) AS AvgStars FROM Ratings r JOIN Jobs j ON j.Id = r.JobId JOIN ServiceRequests s ON s.Id = j.RequestId WHERE j.ProviderId = @providerId OR s.SelectedProviderId = @providerId"
      );

    const stats = statsResult.recordset[0] || {};
    const rating = ratingResult.recordset[0] || {};
    return res.json({
      completedTrips: Number(stats.CompletedTrips || 0),
      totalEarnings: Number(stats.TotalEarnings || 0),
      totalRatings: Number(rating.TotalRatings || 0),
      avgStars: rating.AvgStars == null ? null : Number(rating.AvgStars)
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me/settings", authRequired, requireRole("Provider"), async (req, res) => {
  const {
    serviceRadiusKm,
    baseFee,
    perKmFee,
    capabilities
  } = req.body || {};

  const safeRadius = Number.parseInt(serviceRadiusKm, 10);
  const safeBaseFee = Number.parseFloat(baseFee);
  const safePerKmFee = Number.parseFloat(perKmFee);
  const safeCapabilities = Array.isArray(capabilities)
    ? capabilities
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  if (!Number.isFinite(safeRadius) || safeRadius < 1 || safeRadius > 1000) {
    return res.status(400).json({ error: "Invalid serviceRadiusKm" });
  }
  if (!Number.isFinite(safeBaseFee) || safeBaseFee < 0) {
    return res.status(400).json({ error: "Invalid baseFee" });
  }
  if (!Number.isFinite(safePerKmFee) || safePerKmFee < 0) {
    return res.status(400).json({ error: "Invalid perKmFee" });
  }

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("providerId", sql.Int, req.user.providerId)
      .input("serviceRadiusKm", sql.Int, safeRadius)
      .input("baseFee", sql.Decimal(10, 2), safeBaseFee)
      .input("perKmFee", sql.Decimal(10, 2), safePerKmFee)
      .query(
        "UPDATE Providers SET ServiceRadiusKm = @serviceRadiusKm, BaseFee = @baseFee, PerKmFee = @perKmFee, UpdatedAt = GETUTCDATE() WHERE Id = @providerId"
      );

    await pool
      .request()
      .input("providerId", sql.Int, req.user.providerId)
      .query("DELETE FROM ProviderCapabilities WHERE ProviderId = @providerId");

    for (const cap of safeCapabilities) {
      await pool
        .request()
        .input("providerId", sql.Int, req.user.providerId)
        .input("capability", sql.VarChar, cap)
        .query(
          "INSERT INTO ProviderCapabilities (ProviderId, Capability) VALUES (@providerId, @capability)"
        );
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me/status", authRequired, requireRole("Provider"), async (req, res) => {
  const { isOnline } = req.body || {};
  if (typeof isOnline !== "boolean") {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const pool = await getPool();
    if (isOnline) {
      const activeJob = await pool
        .request()
        .input("providerId", sql.Int, req.user.providerId)
        .query(
          "SELECT TOP 1 Id FROM Jobs WHERE ProviderId = @providerId AND Status IN ('accepted', 'enroute', 'arrived')"
        );
      if (activeJob.recordset.length > 0) {
        return res.status(409).json({ error: "Aktív mentés közben nem állítható online." });
      }
    }
    await pool
      .request()
      .input("providerId", sql.Int, req.user.providerId)
      .input("isOnline", sql.Bit, isOnline)
      .query(
        "UPDATE Providers SET IsOnline = @isOnline, LastSeenAt = GETUTCDATE() WHERE Id = @providerId"
      );

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me/location", authRequired, requireRole("Provider"), async (req, res) => {
  const { lat, lng } = req.body || {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("providerId", sql.Int, req.user.providerId)
      .input("lat", sql.Decimal(10, 6), lat)
      .input("lng", sql.Decimal(10, 6), lng)
      .query(
        "UPDATE Providers SET LastLat = @lat, LastLng = @lng, LastLocationAt = GETUTCDATE(), LastSeenAt = GETUTCDATE() WHERE Id = @providerId"
      );

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
