import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./api/routes/index";
import { liveChainService } from "./services/liveChain";

const app = express();
const PORT = process.env.PORT || 8081;
const chainIngestionEnabled = process.env.CHAIN_INGESTION_ENABLED !== "false";
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
