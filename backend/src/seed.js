import bcrypt from "bcrypt";
import { getPool, sql } from "./db.js";

const providers = [
  {
    email: "provider1@resq.test",
    password: "Test123!",
    name: "ResQ Budai",
    phone: "+36 30 111 2222",
    serviceRadiusKm: 20,
    baseFee: 6000,
    perKmFee: 380,
    lat: 47.4979,
    lng: 19.0402,
    capabilities: ["treler", "csorlo", "autopalya"]
  },
  {
    email: "provider2@resq.test",
    password: "Test123!",
    name: "Pest Rapid",
    phone: "+36 30 333 4444",
    serviceRadiusKm: 25,
    baseFee: 5500,
    perKmFee: 360,
    lat: 47.5206,
    lng: 19.0728,
    capabilities: ["motormentes", "melygarazs"]
  },
  {
    email: "provider3@resq.test",
    password: "Test123!",
    name: "M0 Tow",
    phone: "+36 70 555 6666",
    serviceRadiusKm: 30,
    baseFee: 5000,
    perKmFee: 340,
    lat: 47.351,
    lng: 19.274,
    capabilities: ["4x4", "csorlo"]
  }
];

const userSeed = {
  email: "user@resq.test",
  password: "Test123!",
  role: "User"
};

const adminSeed = {
  email: "admin@test.hu",
  password: "Test123!",
  role: "Admin"
};

async function seed() {
  const pool = await getPool();
  const userHash = await bcrypt.hash(userSeed.password, 10);
  const adminHash = await bcrypt.hash(adminSeed.password, 10);

  const existingAdmin = await pool
    .request()
    .input("email", sql.VarChar, adminSeed.email)
    .query("SELECT TOP 1 Id FROM Users WHERE Email = @email");

  if (existingAdmin.recordset.length === 0) {
    const adminResult = await pool
      .request()
      .input("email", sql.VarChar, adminSeed.email)
      .input("passwordHash", sql.VarChar, adminHash)
      .input("role", sql.VarChar, adminSeed.role)
      .query(
        "INSERT INTO Users (Email, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@email, @passwordHash, @role)"
      );

    console.log(
      `Seeded admin ${adminSeed.email} (Id: ${adminResult.recordset[0].Id})`
    );
  } else {
    console.log(`Admin already exists: ${adminSeed.email}`);
  }

  const userResult = await pool
    .request()
    .input("email", sql.VarChar, userSeed.email)
    .input("passwordHash", sql.VarChar, userHash)
    .input("role", sql.VarChar, userSeed.role)
    .query(
      "INSERT INTO Users (Email, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@email, @passwordHash, @role)"
    );

  console.log(`Seeded user ${userSeed.email} (Id: ${userResult.recordset[0].Id})`);

  for (const provider of providers) {
    const hash = await bcrypt.hash(provider.password, 10);
    const userResultProvider = await pool
      .request()
      .input("email", sql.VarChar, provider.email)
      .input("passwordHash", sql.VarChar, hash)
      .input("role", sql.VarChar, "Provider")
      .query(
        "INSERT INTO Users (Email, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@email, @passwordHash, @role)"
      );

    const providerResult = await pool
      .request()
      .input("userId", sql.Int, userResultProvider.recordset[0].Id)
      .input("name", sql.VarChar, provider.name)
      .input("phone", sql.VarChar, provider.phone)
      .input("serviceRadiusKm", sql.Int, provider.serviceRadiusKm)
      .input("baseFee", sql.Decimal(10, 2), provider.baseFee)
      .input("perKmFee", sql.Decimal(10, 2), provider.perKmFee)
      .input("lat", sql.Decimal(10, 6), provider.lat)
      .input("lng", sql.Decimal(10, 6), provider.lng)
      .query(
        "INSERT INTO Providers (UserId, Name, Phone, ServiceRadiusKm, BaseFee, PerKmFee, IsOnline, LastLat, LastLng, LastSeenAt, LastLocationAt) OUTPUT INSERTED.Id VALUES (@userId, @name, @phone, @serviceRadiusKm, @baseFee, @perKmFee, 1, @lat, @lng, GETUTCDATE(), GETUTCDATE())"
      );

    for (const cap of provider.capabilities) {
      await pool
        .request()
        .input("providerId", sql.Int, providerResult.recordset[0].Id)
        .input("capability", sql.VarChar, cap)
        .query(
          "INSERT INTO ProviderCapabilities (ProviderId, Capability) VALUES (@providerId, @capability)"
        );
    }

    console.log(`Seeded provider ${provider.name}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
