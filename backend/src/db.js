import sql from "mssql";
import dotenv from "dotenv";

dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env")
});

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function parseOptionalInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildSqlConfigFromEnv() {
  let server = process.env.DB_SERVER || "localhost";
  let instanceName = process.env.DB_INSTANCE;

  // Support "HOST\\INSTANCE" in DB_SERVER (common Windows notation).
  if (server.includes("\\") && !instanceName) {
    const [host, instance] = server.split("\\");
    if (host) server = host;
    if (instance) instanceName = instance;
  }

  const port = parseOptionalInt(process.env.DB_PORT);
  const hasPort = Number.isInteger(port) && port > 0;

  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server,
    database: process.env.DB_NAME || "ResQ",
    connectionTimeout: parseOptionalInt(process.env.DB_CONNECTION_TIMEOUT_MS) ?? 15000,
    requestTimeout: parseOptionalInt(process.env.DB_REQUEST_TIMEOUT_MS) ?? 30000,
    ...(hasPort ? { port } : {}),
    options: {
      encrypt: parseBoolean(process.env.DB_ENCRYPT, false),
      trustServerCertificate: parseBoolean(
        process.env.DB_TRUST_SERVER_CERTIFICATE,
        true
      ),
      ...(!hasPort && instanceName ? { instanceName } : {})
    }
  };
}

const config = buildSqlConfigFromEnv();

let pool;

export async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log("Connected to SQL Server");
    } catch (err) {
      const safeConfig = {
        user: config.user,
        server: config.server,
        database: config.database,
        port: config.port,
        options: config.options
      };
      console.error("SQL connection failed.");
      console.error(
        "Tip: For a named instance, SQL Browser (UDP 1434) must be reachable; if it's blocked, set DB_PORT to the instance TCP port instead."
      );
      console.error("Effective config (password omitted):", safeConfig);
      throw err;
    }
  }
  return pool;
}

export { sql };
