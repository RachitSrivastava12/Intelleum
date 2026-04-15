"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const liveData_1 = require("../liveData");
const pool_1 = require("../../db/pool");
const liveChain_1 = require("../../services/liveChain");
const quickNodeStream_1 = require("../../services/quickNodeStream");
const router = express_1.default.Router();
router.get("/streams/quicknode", (_req, res) => {
    res.json({
        ok: true,
        service: "intelleum-quicknode-webhook",
        status: quickNodeStream_1.quickNodeStreamService.getStatus(),
    });
});
router.post("/streams/quicknode", async (req, res) => {
    try {
        const result = await quickNodeStream_1.quickNodeStreamService.receive(req);
        res.json(result);
    }
    catch (error) {
        console.error("[streams] quicknode processing failed", error);
        res.json({ ok: false, error: error instanceof Error ? error.message : "QuickNode processing failed" });
    }
});
router.get("/stats", (_req, res) => {
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData() ? liveChain_1.liveChainService.getStats() : (0, liveData_1.getStats)());
});
router.get("/attacks", (req, res) => {
    const { type, pool: poolAddress, limit = "50", offset = "0", since } = req.query;
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.getAttacks({
            type,
            pool: poolAddress,
            limit,
            offset,
            since,
        })
        : (0, liveData_1.getAttacks)({
            type,
            pool: poolAddress,
            limit,
            offset,
            since,
        }));
});
router.get("/attacks/history", async (req, res) => {
    const limit = Number.parseInt(req.query.limit ?? "100", 10) || 100;
    res.json(liveChain_1.liveChainService.getAttacks({ limit: String(limit) }));
});
router.get("/attacks/:id", async (req, res) => {
    const attackId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(attackId)) {
        return res.status(400).json({ error: "Invalid attack id" });
    }
    const attack = liveChain_1.liveChainService.getAttacks({ limit: "500" }).find((item) => item.id === attackId);
    if (!attack)
        return res.status(404).json({ error: "Attack not found" });
    res.json(attack);
});
router.get("/entities", (req, res) => {
    const { strategy, min_risk, sort = "profit", limit = "50", offset = "0" } = req.query;
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.getEntities({
            strategy,
            min_risk,
            sort,
            limit,
            offset,
        })
        : (0, liveData_1.getEntities)({
            strategy,
            min_risk,
            sort,
            limit,
            offset,
        }));
});
router.get("/entities/:id", (req, res) => {
    const entity = liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.getEntity(req.params.id)
        : (0, liveData_1.getEntity)(req.params.id);
    if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
    }
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(entity);
});
router.get("/pools", (req, res) => {
    const limit = Number.parseInt(req.query.limit ?? "50", 10) || 50;
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData() ? liveChain_1.liveChainService.getPools(limit) : (0, liveData_1.getPools)(limit));
});
router.get("/routes/risk", (req, res) => {
    const limit = Number.parseInt(req.query.limit ?? "25", 10) || 25;
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData() ? liveChain_1.liveChainService.getRouteRisks(limit) : (0, liveData_1.getRouteRisks)(limit));
});
router.get("/routes/recommendations", (req, res) => {
    const limit = Number.parseInt(req.query.limit ?? "12", 10) || 12;
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.getRouteRecommendations(limit)
        : (0, liveData_1.getRouteRecommendations)(limit));
});
router.post("/routes/evaluate", (req, res) => {
    const body = req.body ?? {};
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.evaluateRoute(body)
        : (0, liveData_1.evaluateRoute)(body));
});
router.post("/routes/rank", (req, res) => {
    const body = req.body ?? {};
    if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
        return res.status(400).json({ error: "candidates array is required" });
    }
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.rankRoutes(body)
        : (0, liveData_1.rankRoutes)(body));
});
router.get("/integrations/live-alerts", (req, res) => {
    const limit = Number.parseInt(req.query.limit ?? "20", 10) || 20;
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData() ? liveChain_1.liveChainService.getLiveAlerts(limit) : (0, liveData_1.getLiveAlerts)(limit));
});
router.get("/integrations/feeds", (req, res) => {
    const limit = Number.parseInt(req.query.limit ?? "20", 10) || 20;
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.getIntegrationFeeds(limit)
        : (0, liveData_1.getIntegrationFeeds)(limit));
});
router.get("/pools/:address", (req, res) => {
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData()
        ? liveChain_1.liveChainService.getPoolDetails(req.params.address)
        : (0, liveData_1.getPoolDetails)(req.params.address));
});
router.get("/validators", (_req, res) => {
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData() ? liveChain_1.liveChainService.getValidators() : (0, liveData_1.getValidators)());
});
router.get("/wallet/:address", (req, res) => {
    res.setHeader("X-Intelleum-Source", liveChain_1.liveChainService.hasLiveData() ? "chain" : "fallback");
    res.json(liveChain_1.liveChainService.hasLiveData() ? liveChain_1.liveChainService.getWallet(req.params.address) : (0, liveData_1.getWallet)(req.params.address));
});
router.get("/system/status", (_req, res) => {
    res.json({
        ...liveChain_1.liveChainService.getStatus(),
        quicknode: quickNodeStream_1.quickNodeStreamService.getStatus(),
    });
});
router.get("/system/history", async (_req, res) => {
    res.json([]);
});
router.post("/access/request", async (req, res) => {
    try {
        const { name, email, organization, useCase, message } = req.body;
        if (!name || !email || !organization || !useCase) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        await (0, pool_1.ensureAccessSchema)();
        await pool_1.pool.query(`INSERT INTO access_requests (name, email, organization, use_case, message)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING`, [name, email, organization, useCase, message ?? null]);
        res.json({ success: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save access request" });
    }
});
exports.default = router;
//# sourceMappingURL=index.js.map