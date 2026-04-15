"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_1 = __importDefault(require("./api/routes/index"));
const liveChain_1 = require("./services/liveChain");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8081;
const chainIngestionEnabled = process.env.CHAIN_INGESTION_ENABLED !== "false";
const allowedOrigins = new Set([
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_URL,
].filter(Boolean));
app.use((req, _res, next) => {
    console.log(`[api] ${req.method} ${req.originalUrl} origin=${req.headers.origin ?? "-"}`);
    next();
});
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ["GET", "POST", "OPTIONS"],
}));
app.use("/api/streams/quicknode", (req, _res, next) => {
    if (req.method !== "POST") {
        next();
        return;
    }
    const chunks = [];
    req.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
        req.rawBody = Buffer.concat(chunks);
        next();
    });
    req.on("error", (error) => {
        next(error);
    });
});
app.use(express_1.default.json());
app.get("/health", (_req, res) => res.json({
    status: "ok",
    ts: Date.now(),
    mode: liveChain_1.liveChainService.getStatus().mode,
    chainIngestionEnabled,
    chain: liveChain_1.liveChainService.getStatus(),
}));
app.use("/api", index_1.default);
if (chainIngestionEnabled) {
    liveChain_1.liveChainService.start();
}
else {
    console.log("⏸️  Helius chain ingestion disabled via CHAIN_INGESTION_ENABLED=false");
}
app.listen(PORT, () => {
    console.log(`🚀 INTELLEUM API running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map