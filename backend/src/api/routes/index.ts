import express, { Request, Response } from "express";
import crypto from "crypto";
import {
  evaluateRoute,
  getAttacks,
  getEntities,
  getEntity,
  getIntegrationFeeds,
  getExecutionQuality,
  getLiquidationFirewall,
  getLiveAlerts,
  getLpProtection,
  getPoolDetails,
  getPools,
  getPredictionMarketExecution,
  getRouteRecommendations,
  getRouteRisks,
  getSavingsSummary,
  getSourceAttribution,
  getStats,
  getToxicFlowTerminal,
  getValidators,
  getWallet,
  getFlowSegments,
  preventionGuard,
  protectedSendPlan,
  rankRoutes,
} from "../liveData";
import { ensureAccessSchema, ensureApiKeySchema, hashApiKey, hasDatabase, pool } from "../../db/pool";
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

router.get("/analytics/execution-quality", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "20", 10) || 20;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getExecutionQuality(limit)
      : getExecutionQuality(limit),
  );
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

router.get("/routes/policies", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "20", 10) || 20;
  const objective = (req.query.objective as string) ?? "protect_users";
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getRoutePolicies(limit, objective as any)
      : getRouteRisks(limit).map((route) => ({
          route_key: route.route_key,
          label: route.label,
          objective,
          policy_action: route.policy_action,
          recommended_max_notional_usd: route.recommended_max_notional_usd,
          estimated_savings_bps: route.estimated_savings_bps,
          estimated_savings_usd: route.estimated_savings_usd,
          reason_codes: route.reason_codes,
          decomposition: route.decomposition,
        })),
  );
});

router.get("/terminal/toxic-flow", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "8", 10) || 8;
  const interval = ((req.query.interval as string) ?? "5m") as "5m" | "15m" | "1h";
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getToxicFlowTerminal(limit, interval)
      : getToxicFlowTerminal(limit, interval),
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

router.post("/prevention/guard", (req: Request, res: Response) => {
  const body = req.body ?? {};
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.preventionGuard(body)
      : preventionGuard(body),
  );
});

router.post("/prevention/protected-send", (req: Request, res: Response) => {
  const body = req.body ?? {};
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.protectedSendPlan(body)
      : protectedSendPlan(body),
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

router.get("/flows/segments", (_req: Request, res: Response) => {
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getFlowSegments() : getFlowSegments());
});

router.get("/attribution/sources", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "8", 10) || 8;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getSourceAttribution(limit)
      : getSourceAttribution(limit),
  );
});

router.get("/pools/lp-protection", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "20", 10) || 20;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getLpProtection(limit) : getLpProtection(limit));
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

router.get("/validators/regimes", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "10", 10) || 10;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json((liveChainService.hasLiveData() ? liveChainService.getValidators() : getValidators()).slice(0, limit));
});

router.get("/savings/summary", (_req: Request, res: Response) => {
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(liveChainService.hasLiveData() ? liveChainService.getSavingsSummary() : getSavingsSummary());
});

router.get("/liquidations/firewall", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "8", 10) || 8;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getLiquidationFirewall(limit)
      : getLiquidationFirewall(limit),
  );
});

router.get("/prediction-markets/execution", (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "6", 10) || 6;
  res.setHeader("X-Intelleum-Source", liveChainService.hasLiveData() ? "chain" : "fallback");
  res.json(
    liveChainService.hasLiveData()
      ? liveChainService.getPredictionMarketExecution(limit)
      : getPredictionMarketExecution(limit),
  );
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
    if (!hasDatabase()) {
      return res.status(503).json({
        error: "DATABASE_URL is not configured, so access requests cannot be stored",
      });
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

router.post("/access/api-key", async (req: Request, res: Response) => {
  try {
    const { walletAddress, name, email, organization, useCase, message } = req.body ?? {};
    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({ error: "walletAddress is required" });
    }
    if (!hasDatabase()) {
      return res.status(503).json({
        error: "DATABASE_URL is not configured, so wallet-bound trial keys cannot be issued",
      });
    }

    await ensureApiKeySchema();

    const existing = await pool.query(
      `SELECT wallet_address, api_key_prefix, request_limit, request_count, status, created_at
       FROM api_clients
       WHERE wallet_address = $1`,
      [walletAddress],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];
      return res.status(409).json({
        error: "API key already issued for this wallet",
        wallet_address: row.wallet_address,
        api_key_prefix: row.api_key_prefix,
        request_limit: row.request_limit,
        request_count: row.request_count,
        remaining_requests: Math.max(0, row.request_limit - row.request_count),
        created_at: row.created_at,
      });
    }

    const rawKey = `itl_live_${crypto.randomBytes(18).toString("hex")}`;
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = `${rawKey.slice(0, 14)}...`;

    await pool.query(
      `INSERT INTO api_clients (
        wallet_address,
        name,
        email,
        organization,
        use_case,
        message,
        api_key_hash,
        api_key_prefix,
        request_limit,
        request_count,
        status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        walletAddress,
        name ?? null,
        email ?? null,
        organization ?? null,
        useCase ?? null,
        message ?? null,
        keyHash,
        keyPrefix,
        5,
        0,
        "active",
      ],
    );

    res.json({
      success: true,
      wallet_address: walletAddress,
      api_key: rawKey,
      api_key_prefix: keyPrefix,
      request_limit: 5,
      request_count: 0,
      remaining_requests: 5,
      required_header: "x-api-key",
      accepted_headers: ["x-api-key", "x-intelleum-key"],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to issue API key" });
  }
});

router.get("/access/api-key/status/:walletAddress", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.params.walletAddress;
    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({ error: "walletAddress is required" });
    }
    if (!hasDatabase()) {
      return res.status(503).json({
        error: "DATABASE_URL is not configured, so wallet-bound trial key status is unavailable",
      });
    }

    await ensureApiKeySchema();

    const result = await pool.query(
      `SELECT wallet_address, api_key_prefix, request_limit, request_count, status, created_at, last_request_at
       FROM api_clients
       WHERE wallet_address = $1`,
      [walletAddress],
    );

    const client = result.rows[0];
    if (!client) {
      return res.status(404).json({
        error: "No API key issued for this wallet",
        wallet_address: walletAddress,
      });
    }

    res.json({
      wallet_address: client.wallet_address,
      api_key_prefix: client.api_key_prefix,
      request_limit: client.request_limit,
      request_count: client.request_count,
      remaining_requests: Math.max(0, client.request_limit - client.request_count),
      status: client.status,
      created_at: client.created_at,
      last_request_at: client.last_request_at,
      required_header: "x-api-key",
      accepted_headers: ["x-api-key", "x-intelleum-key"],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch API key status" });
  }
});

export default router;
