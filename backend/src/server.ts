import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./api/routes/index";
import { liveChainService } from "./services/liveChain";
import { ensureApiKeySchema, hashApiKey, pool } from "./db/pool";

const app = express();
const PORT = process.env.PORT || 8081;
const chainIngestionEnabled = process.env.CHAIN_INGESTION_ENABLED !== "false";
const apiKey = process.env.INTELLEUM_API_KEY?.trim() || null;
const requireIssuedApiKeys = process.env.REQUIRE_API_KEYS === "true";
const allowedOrigins = new Set([
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[]);

app.use((req, _res, next) => {
  console.log(`[api] ${req.method} ${req.originalUrl} origin=${req.headers.origin ?? "-"}`);
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use("/api/streams/quicknode", (req, _res, next) => {
  if (req.method !== "POST") {
    next();
    return;
  }

  const chunks: Buffer[] = [];

  req.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  req.on("end", () => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });

  req.on("error", (error) => {
    next(error);
  });
});

app.use(express.json());

app.use("/api", async (req, res, next) => {
  const authExempt =
    req.path === "/access/request" ||
    req.path === "/access/api-key" ||
    req.path.startsWith("/streams/quicknode");

  if (authExempt) {
    next();
    return;
  }

  const providedKey = (req.headers["x-api-key"] as string | undefined)?.trim();
  const hasDb = Boolean(pool);

  if (!apiKey && !requireIssuedApiKeys) {
    next();
    return;
  }

  if (providedKey && apiKey && providedKey === apiKey) {
    next();
    return;
  }

  if (providedKey && hasDb) {
    try {
      await ensureApiKeySchema();
      const apiKeyHash = hashApiKey(providedKey);
      const result = await pool.query(
        `SELECT id, wallet_address, request_limit, request_count, status
         FROM api_clients
         WHERE api_key_hash = $1`,
        [apiKeyHash],
      );
      const client = result.rows[0];

      if (client && client.status === "active") {
        if (client.request_count >= client.request_limit) {
          res.status(429).json({
            error: "API key request limit reached",
            wallet_address: client.wallet_address,
            request_limit: client.request_limit,
            request_count: client.request_count,
          });
          return;
        }

        await pool.query(
          `UPDATE api_clients
           SET request_count = request_count + 1,
               last_request_at = NOW()
           WHERE id = $1`,
          [client.id],
        );
        next();
        return;
      }
    } catch (error) {
      console.error("[api] issued-key auth failed", error);
    }
  }

  res.status(401).json({
    error: "Missing or invalid API key",
    required_header: "x-api-key",
  });
});

app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    ts: Date.now(),
    mode: liveChainService.getStatus().mode,
    chainIngestionEnabled,
    chain: liveChainService.getStatus(),
  }),
);
app.use("/api", routes);

if (chainIngestionEnabled) {
  liveChainService.start();
} else {
  console.log("⏸️  Helius chain ingestion disabled via CHAIN_INGESTION_ENABLED=false");
}

app.listen(PORT, () => {
  console.log(`🚀 INTELLEUM API running on port ${PORT}`);
});
