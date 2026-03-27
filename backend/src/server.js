import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import providerRoutes from "./routes/providers.js";
import requestRoutes from "./routes/requests.js";
import offerRoutes from "./routes/offers.js";
import jobRoutes from "./routes/jobs.js";
import { getPool } from "./db.js";
import supportRoutes from "./routes/support.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../../public");

const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

const allowedOriginSet = new Set(allowedOrigins.map(normalizeOrigin));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOriginSet.has("*")) {
        return callback(null, true);
      }
      if (allowedOriginSet.has(normalizeOrigin(origin))) {
        return callback(null, true);
      }
      // Do not throw here, because that turns CORS mismatch into a 500 error.
      return callback(null, false);
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/support", supportRoutes);

app.use(express.static(publicDir));

const pageRoutes = new Map([
  ["/", "map.html"],
  ["/auth", "auth.html"],
  ["/account", "account.html"],
  ["/map", "map.html"],
  ["/rolunk", "rolunk.html"],
  ["/about", "rolunk.html"],
  ["/provider", "provider.html"],
  ["/automento", "automento.html"],
  ["/ertekelesek", "ertekelesek.html"],
  ["/ratings", "ertekelesek.html"],
  ["/support", "support.html"],
  ["/admin", "admin.html"],
  ["/admin/", "admin.html"]
]);

for (const [routePath, fileName] of pageRoutes.entries()) {
  app.get(routePath, (_req, res) => {
    res.sendFile(path.join(publicDir, fileName));
  });
}

const port = process.env.PORT || 5000;

async function start() {
  await getPool();
  app.listen(port, () => {
    console.log(`ResQ API running on ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start: database connection error.");
  console.error(err);
  process.exit(1);
});
