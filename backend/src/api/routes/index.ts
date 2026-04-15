import express, { Request, Response } from "express";
import {
  evaluateRoute,
  getAttacks,
  getEntities,
  getEntity,
  getIntegrationFeeds,
  getLiveAlerts,
  getPoolDetails,
  getPools,
  getRouteRecommendations,
  getRouteRisks,
  getStats,
  getValidators,
  getWallet,
  rankRoutes,
} from "../liveData";
import { ensureAccessSchema, pool } from "../../db/pool";
import { liveChainService } from "../../services/liveChain";
import { quickNodeStreamService } from "../../services/quickNodeStream";

const router = express.Router();

router.get("/streams/quicknode", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "intelleum-quicknode-webhook",
    status: quickNodeStreamService.getStatus(),
  });
});

router.post("/streams/quicknode", async (req: Request, res: Response) => {
  try {
    const result = await quickNodeStreamService.receive(req);
    res.json(result);
  } catch (error) {
    console.error("[streams] quicknode processing failed", error);
    res.json({ ok: false, error: error instanceof Error ? error.message : "QuickNode processing failed" });
  }
});

router.get("/stats", (_req: Request, res: Response) => {
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getStats() : getStats());
});

router.get("/attacks", (req: Request, res: Response) => {
  const { type, pool: poolAddress, limit = "50", offset = "0", since } = req.query as any;

  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getAttacks({
          type,
          pool: poolAddress,
          limit,
          offset,
          since,
        })
      : getAttacks({
          type,
          pool: poolAddress,
          limit,
          offset,
          since,
        }),
  );
});

router.get("/attacks/history", async (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "100", 10) || 100;
  res.json(liveChainService.getAttacks({ limit: String(limit) }));
});

router.get("/attacks/:id", async (req: Request, res: Response) => {
  const attackId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(attackId)) {
    return res.status(400).json({ error: "Invalid attack id" });
  }

  const attack = liveChainService.getAttacks({ limit: "500" }).find((item) => item.id === attackId);
  if (!attack) return res.status(404).json({ error: "Attack not found" });
  res.json(attack);
});

router.get("/entities", (req: Request, res: Response) => {
  const { strategy, min_risk, sort = "profit", limit = "50", offset = "0" } =
    req.query as any;

  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getEntities({
          strategy,
          min_risk,
          sort,
          limit,
          offset,
        })
      : getEntities({
          strategy,
          min_risk,
          sort,
          limit,
          offset,
        }),
  );
});

router.get("/entities/:id", (req: Request, res: Response) => {
  const entity = liveChainService.hasLiveData()
    ? liveChainService.getEntity(req.params.id)
    : getEntity(req.params.id);
  if (!entity) {
    return res.status(404).json({ error: "Entity not found" });
  }

  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(entity);
});

router.get("/pools", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "50", 10) || 50;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getPools(limit) : getPools(limit));
});

router.get("/routes/risk", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "25", 10) || 25;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getRouteRisks(limit) : getRouteRisks(limit));
});

router.get("/routes/recommendations", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "12", 10) || 12;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getRouteRecommendations(limit)
      : getRouteRecommendations(limit),
  );
});

router.post("/routes/evaluate", (req: Request, res: Response) => {
  const body = req.body ?? {};
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.evaluateRoute(body)
      : evaluateRoute(body),
  );
});

router.post("/routes/rank", (req: Request, res: Response) => {
  const body = req.body ?? {};
  if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
    return res.status(400).json({ error: "candidates array is required" });
  }

  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.rankRoutes(body)
      : rankRoutes(body),
  );
});

router.get("/integrations/live-alerts", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "20", 10) || 20;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData() ? liveChainService.getLiveAlerts(limit) : getLiveAlerts(limit),
  );
});

router.get("/integrations/feeds", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "20", 10) || 20;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getIntegrationFeeds(limit)
      : getIntegrationFeeds(limit),
  );
});

router.get("/pools/:address", (req: Request, res: Response) => {
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getPoolDetails(req.params.address)
      : getPoolDetails(req.params.address),
  );
});

router.get("/validators", (_req: Request, res: Response) => {
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getValidators() : getValidators());
});

router.get("/wallet/:address", (req: Request, res: Response) => {
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getWallet(req.params.address) : getWallet(req.params.address));
});

router.get("/system/status", (_req: Request, res: Response) => {
  res.json({
    ...liveChainService.getStatus(),
    quicknode: quickNodeStreamService.getStatus(),
  });
});

router.get("/system/history", async (_req: Request, res: Response) => {
  res.json([]);
});

router.post("/access/request", async (req: Request, res: Response) => {
  try {
    const { name, email, organization, useCase, message } = req.body;
    if (!name || !email || !organization || !useCase) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await ensureAccessSchema();
    await pool!.query(
      `INSERT INTO access_requests (name, email, organization, use_case, message)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING`,
      [name, email, organization, useCase, message ?? null],
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save access request" });
  }
});

export default router;
