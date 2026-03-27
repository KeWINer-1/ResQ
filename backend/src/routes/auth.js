import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { getPool, sql } from "../db.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

function getResetBaseUrl(req) {
  if (process.env.FRONTEND_BASE_URL) {
    return process.env.FRONTEND_BASE_URL.replace(/\/$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function fetchUserProfile(pool, userId) {
  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query(
      "SELECT u.Id, u.Email, u.Role, u.Name, u.Phone, p.Id AS ProviderId, p.Name AS ProviderName, p.Phone AS ProviderPhone FROM Users u LEFT JOIN Providers p ON p.UserId = u.Id WHERE u.Id = @userId"
    );

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];
  let provider = null;

  if (row.ProviderId) {
    const caps = await pool
      .request()
      .input("providerId", sql.Int, row.ProviderId)
      .query(
        "SELECT Capability FROM ProviderCapabilities WHERE ProviderId = @providerId ORDER BY Capability"
      );

    provider = {
      id: row.ProviderId,
      name: row.ProviderName,
      phone: row.ProviderPhone,
      capabilities: caps.recordset.map((capRow) => capRow.Capability)
    };
  }

  return {
    id: row.Id,
    email: row.Email,
    role: row.Role,
    name: row.Name || null,
    phone: row.Phone || null,
    provider
  };
}

router.get("/me", authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const profile = await fetchUserProfile(pool, req.user.userId);
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me", authRequired, async (req, res) => {
  const { name, phone } = req.body || {};
  const safeName = typeof name === "string" ? name.trim() : null;
  const safePhone = typeof phone === "string" ? phone.trim() : null;

  try {
    const pool = await getPool();

    if (req.user.role === "Provider") {
      await pool
        .request()
        .input("userId", sql.Int, req.user.userId)
        .input("name", sql.VarChar, safeName || null)
        .input("phone", sql.VarChar, safePhone || null)
        .query(
          "UPDATE Providers SET Name = COALESCE(@name, Name), Phone = COALESCE(@phone, Phone) WHERE UserId = @userId"
        );
    } else {
      await pool
        .request()
        .input("userId", sql.Int, req.user.userId)
        .input("name", sql.VarChar, safeName || null)
        .input("phone", sql.VarChar, safePhone || null)
        .query(
          "UPDATE Users SET Name = @name, Phone = @phone, UpdatedAt = GETUTCDATE() WHERE Id = @userId"
        );
    }

    const profile = await fetchUserProfile(pool, req.user.userId);
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/register", async (req, res) => {
  const {
    email,
    password,
    role,
    name,
    phone,
    serviceRadiusKm,
    baseFee,
    perKmFee,
    capabilities
  } = req.body || {};

  if (!email || !password || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!["User", "Provider"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userName = role === "User" ? name || null : null;
    const userPhone = role === "User" ? phone || null : null;
    const userResult = await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("passwordHash", sql.VarChar, passwordHash)
      .input("role", sql.VarChar, role)
      .input("name", sql.VarChar, userName)
      .input("phone", sql.VarChar, userPhone)
      .query(
        "INSERT INTO Users (Email, PasswordHash, Role, Name, Phone) OUTPUT INSERTED.Id VALUES (@email, @passwordHash, @role, @name, @phone)"
      );

    const userId = userResult.recordset[0].Id;
    let providerId = null;

    if (role === "Provider") {
      if (!name || !phone) {
        return res.status(400).json({ error: "Missing provider fields" });
      }

      const providerResult = await pool
        .request()
        .input("userId", sql.Int, userId)
        .input("name", sql.VarChar, name)
        .input("phone", sql.VarChar, phone)
        .input("serviceRadiusKm", sql.Int, serviceRadiusKm || 20)
        .input("baseFee", sql.Decimal(10, 2), baseFee || 5000)
        .input("perKmFee", sql.Decimal(10, 2), perKmFee || 350)
        .query(
          "INSERT INTO Providers (UserId, Name, Phone, ServiceRadiusKm, BaseFee, PerKmFee, IsOnline) OUTPUT INSERTED.Id VALUES (@userId, @name, @phone, @serviceRadiusKm, @baseFee, @perKmFee, 0)"
        );

      providerId = providerResult.recordset[0].Id;

      if (Array.isArray(capabilities)) {
        for (const capability of capabilities) {
          await pool
            .request()
            .input("providerId", sql.Int, providerId)
            .input("capability", sql.VarChar, capability)
            .query(
              "INSERT INTO ProviderCapabilities (ProviderId, Capability) VALUES (@providerId, @capability)"
            );
        }
      }
    }

    const token = jwt.sign(
      { userId, role, providerId },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    return res.status(201).json({ token });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query(
        "SELECT u.Id, u.PasswordHash, u.Role, p.Id AS ProviderId FROM Users u LEFT JOIN Providers p ON p.UserId = u.Id WHERE u.Email = @email"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const user = result.recordset[0];
    if (!user.PasswordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const match = await bcrypt.compare(password, user.PasswordHash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.Id, role: user.Role, providerId: user.ProviderId },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    return res.json({ token, role: user.Role });
  } catch (err) {
    console.error("Login failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  try {
    const pool = await getPool();
    const userResult = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const userId = userResult.recordset[0].Id;
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("DELETE FROM PasswordResetTokens WHERE UserId = @userId");

    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("tokenHash", sql.VarChar, tokenHash)
      .input("expiresAt", sql.DateTime2, expiresAt)
      .query(
        "INSERT INTO PasswordResetTokens (UserId, TokenHash, ExpiresAt) VALUES (@userId, @tokenHash, @expiresAt)"
      );

    const resetUrl = `${getResetBaseUrl(req)}/auth.html?mode=forgot&token=${encodeURIComponent(resetToken)}`;
    const from = process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@resq.local";
    const transporter = createSmtpTransport();

    let emailSent = false;
    if (transporter) {
      try {
        await transporter.sendMail({
          from,
          to: email,
          subject: "ResQ - Jelszo visszaallitas",
          text: `Jelszo visszaallitashoz nyisd meg ezt a linket: ${resetUrl}\n\nA token 30 percig ervenyes.`,
          html: `<p>Jelszo visszaallitashoz kattints ide:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>A token 30 percig ervenyes.</p>`
        });
        emailSent = true;
      } catch (mailErr) {
        console.error("Forgot-password email send failed:", mailErr);
      }
    } else {
      console.warn("SMTP not configured, forgot-password email was not sent.");
    }

    if (process.env.NODE_ENV !== "production") {
      return res.json({ ok: true, resetToken, emailSent });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Forgot-password failed:", err);
    return res.status(500).json({ error: "A jelszo-visszaallitas most nem elerheto." });
  }
});
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Missing token or new password" });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    const pool = await getPool();
    const tokenResult = await pool
      .request()
      .input("tokenHash", sql.VarChar, tokenHash)
      .query(
        "SELECT TOP 1 Id, UserId, ExpiresAt, UsedAt FROM PasswordResetTokens WHERE TokenHash = @tokenHash ORDER BY Id DESC"
      );

    if (tokenResult.recordset.length === 0) {
      return res.status(400).json({ error: "Invalid reset token" });
    }

    const row = tokenResult.recordset[0];
    if (row.UsedAt) {
      return res.status(400).json({ error: "Reset token already used" });
    }

    if (new Date(row.ExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Reset token expired" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool
      .request()
      .input("userId", sql.Int, row.UserId)
      .input("passwordHash", sql.VarChar, passwordHash)
      .query(
        "UPDATE Users SET PasswordHash = @passwordHash, UpdatedAt = GETUTCDATE() WHERE Id = @userId"
      );

    await pool
      .request()
      .input("id", sql.Int, row.Id)
      .query("UPDATE PasswordResetTokens SET UsedAt = GETUTCDATE() WHERE Id = @id");

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
