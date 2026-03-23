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
      rating: "N/A"
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
