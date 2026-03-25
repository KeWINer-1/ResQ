import bcrypt from "bcrypt";
import { getPool, sql } from "./db.js";

async function upsertUser(pool, { email, password, role }) {
  const existing = await pool
    .request()
    .input("email", sql.VarChar, email)
    .query("SELECT TOP 1 Id FROM Users WHERE Email = @email");

  const hash = await bcrypt.hash(password, 10);

  if (existing.recordset.length > 0) {
    const id = existing.recordset[0].Id;
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("passwordHash", sql.VarChar, hash)
      .input("role", sql.VarChar, role)
      .query(
        "UPDATE Users SET PasswordHash = @passwordHash, Role = @role, UpdatedAt = GETUTCDATE() WHERE Id = @id"
      );
    return id;
  }

  const inserted = await pool
    .request()
    .input("email", sql.VarChar, email)
    .input("passwordHash", sql.VarChar, hash)
    .input("role", sql.VarChar, role)
    .query(
      "INSERT INTO Users (Email, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@email, @passwordHash, @role)"
    );

  return inserted.recordset[0].Id;
}

async function ensureProviderRow(pool, userId) {
  const existing = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query("SELECT TOP 1 Id FROM Providers WHERE UserId = @userId");

  if (existing.recordset.length > 0) {
    return;
  }

  await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("name", sql.VarChar, "Teszt Automento")
    .input("phone", sql.VarChar, "+36 30 000 0000")
    .input("serviceRadiusKm", sql.Int, 20)
    .input("baseFee", sql.Decimal(10, 2), 5000)
    .input("perKmFee", sql.Decimal(10, 2), 350)
    .query(
      "INSERT INTO Providers (UserId, Name, Phone, ServiceRadiusKm, BaseFee, PerKmFee, IsOnline) VALUES (@userId, @name, @phone, @serviceRadiusKm, @baseFee, @perKmFee, 0)"
    );
}

async function run() {
  const pool = await getPool();

  await upsertUser(pool, {
    email: "admin@test",
    password: "admin123",
    role: "Admin"
  });

  await upsertUser(pool, {
    email: "tesztauto@test",
    password: "teszt123",
    role: "User"
  });

  const providerUserId = await upsertUser(pool, {
    email: "tesztmento@test",
    password: "teszt123",
    role: "Provider"
  });

  await ensureProviderRow(pool, providerUserId);

  console.log("Teszt felhasznalok frissitve/letrehozva.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed test users hiba:", err);
  process.exit(1);
});
