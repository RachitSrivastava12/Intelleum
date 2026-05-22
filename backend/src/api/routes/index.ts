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

router.get("/terminal/toxic-flow", async (req: Request, res: Response) => {
  const limit = Number.parseInt((req.query.limit as string) ?? "8", 10) || 8;
  const interval = ((req.query.interval as string) ?? "1m") as "1m" | "5m" | "15m" | "1h";

  if (liveChainService.hasLiveData()) {
    res.setHeader("X-Intelleum-Source", "chain");
    return res.json(liveChainService.getToxicFlowTerminal(limit, interval));
  }

  if (hasDatabase()) {
    try {
      const dbResult = await buildToxicFlowTerminalFromDB(limit, interval);
      if (dbResult) {
        res.setHeader("X-Intelleum-Source", "db");
        return res.json(dbResult);
      }
    } catch (err) {
      console.error("[toxic-flow] DB query failed, falling back", err);
    }
  }

  res.setHeader("X-Intelleum-Source", "fallback");
  res.json(getToxicFlowTerminal(limit, interval));
});

async function buildToxicFlowTerminalFromDB(
  limit: number,
  interval: "1m" | "5m" | "15m" | "1h",
) {
  const bucketSql = interval === "1h" ? "1 hour" : interval === "15m" ? "15 minutes" : interval === "5m" ? "5 minutes" : "1 minute";
  const windowHours = interval === "1h" ? 120 : interval === "15m" ? 90 : interval === "5m" ? 300 : 60;
  const bucketCount = interval === "1h" ? 120 : interval === "15m" ? 90 : interval === "5m" ? 60 : 60;

  // Top pools by attack count in last 24h
  const topPools = await pool!.query<{
    pool_address: string;
    total_attacks: string;
    total_profit: number | null;
    total_victim_loss: number | null;
    avg_confidence: number;
    primary_type: string;
  }>(
    `SELECT
       pool_address,
       COUNT(*)                                              AS total_attacks,
       SUM(profit_usd)                                      AS total_profit,
       SUM(victim_loss_usd)                                 AS total_victim_loss,
       AVG(confidence)                                      AS avg_confidence,
       mode() WITHIN GROUP (ORDER BY attack_type)           AS primary_type
     FROM mev_attacks
     WHERE block_time > NOW() - INTERVAL '24 hours'
     GROUP BY pool_address
     ORDER BY COUNT(*) DESC
     LIMIT $1`,
    [limit],
  );

  if (topPools.rows.length === 0) return null;

  const surfaces = await Promise.all(
    topPools.rows.map(async (pool_row, idx) => {
      const candles_res = await pool!.query<{
        bucket: string;
        attack_count: string;
        profit_usd: number | null;
        victim_loss_usd: number | null;
        avg_confidence: number;
        attack_type: string | null;
      }>(
        `SELECT
           date_trunc($1, block_time)                         AS bucket,
           COUNT(*)                                           AS attack_count,
           SUM(profit_usd)                                    AS profit_usd,
           SUM(victim_loss_usd)                               AS victim_loss_usd,
           AVG(confidence)                                    AS avg_confidence,
           mode() WITHIN GROUP (ORDER BY attack_type)         AS attack_type
         FROM mev_attacks
         WHERE pool_address = $2
           AND block_time > NOW() - ($3 || ' minutes')::INTERVAL
         GROUP BY date_trunc($1, block_time)
         ORDER BY bucket ASC`,
        [bucketSql, pool_row.pool_address, windowHours],
      );

      const totalAttacks = parseInt(pool_row.total_attacks) || 0;
      const avgConf = pool_row.avg_confidence ?? 0.8;
      const toxicScore = Math.round(Math.min(99, totalAttacks * 3 + avgConf * 30));
      const lossAtRisk24h = pool_row.total_victim_loss ?? pool_row.total_profit ?? 0;

      // Build full candle array filling gaps with zeros
      const now = Date.now();
      const bucketMs = (windowHours / bucketCount) * 60 * 1000;
      const candleMap = new Map(candles_res.rows.map((r) => [new Date(r.bucket).getTime(), r]));

      const candles = Array.from({ length: bucketCount }, (_, i) => {
        const ts = new Date(now - (bucketCount - i) * bucketMs).toISOString();
        const key = Math.round(new Date(ts).getTime() / bucketMs) * bucketMs;
        const row = candleMap.get(key);
        const attackCount = parseInt(row?.attack_count ?? "0") || 0;
        const lossUsd = Math.round((row?.victim_loss_usd ?? row?.profit_usd ?? 0) * 100) / 100;
        return {
          timestamp: ts,
          label: ts,
          open: 0, high: 0, low: 0, close: 0,
          volume_usd: 0,
          toxic_flow_score: attackCount > 0 ? Math.min(99, attackCount * 12 + (row?.avg_confidence ?? 0) * 30) : 0,
          markout_bps: 0,
          lvr_bps: 0,
          loss_at_risk_usd: lossUsd,
          prevented_loss_usd: 0,
          attack_count: attackCount,
          event_type: (row?.attack_type ?? null) as any,
        };
      });

      const overlays = candles
        .filter((c) => c.attack_count > 0)
        .slice(-5)
        .map((c) => ({
          timestamp: c.timestamp,
          event_type: (c.event_type ?? "arbitrage") as any,
          severity: (toxicScore >= 82 ? "critical" : toxicScore >= 55 ? "high" : "medium") as any,
          label: `${(c.event_type ?? "arbitrage").replace(/_/g, " ")} on ${pool_row.pool_address.slice(0, 8)}...`,
          loss_usd: c.loss_at_risk_usd,
          confidence: avgConf,
        }));

      return {
        route_key: `pool:${pool_row.pool_address}`,
        label: `Pool ${pool_row.pool_address.slice(0, 8)}...${pool_row.pool_address.slice(-4)}`,
        protocol: pool_row.primary_type ?? null,
        pair: pool_row.pool_address.slice(0, 8),
        action: toxicScore >= 80 ? "avoid" : toxicScore >= 55 ? "reroute" : toxicScore >= 30 ? "monitor" : "allow" as any,
        risk_score: toxicScore,
        execution_quality_score: Math.max(2, 100 - toxicScore),
        toxic_flow_score: toxicScore,
        price_change_pct: 0,
        markout_30s_bps: 0,
        volume_24h_usd: 0,
        loss_at_risk_24h_usd: lossAtRisk24h,
        prevented_loss_24h_usd: 0,
        liquidity_stress: Math.min(99, toxicScore * 0.8),
        quote_freshness_ms: 0,
        reason_codes: [pool_row.primary_type ?? "mev_detected"],
        candles,
        overlays,
      };
    }),
  );

  const totalLoss = surfaces.reduce((s, x) => s + x.loss_at_risk_24h_usd, 0);
  return {
    generated_at: new Date().toISOString(),
    source: "chain" as const,
    interval,
    summary: {
      surfaces_tracked: surfaces.length,
      routes_in_block: surfaces.filter((s) => s.action === "avoid" || s.action === "reroute").length,
      estimated_loss_at_risk_24h_usd: Math.round(totalLoss * 100) / 100,
      estimated_prevented_loss_24h_usd: 0,
      highest_toxicity_route: surfaces.sort((a, b) => b.toxic_flow_score - a.toxic_flow_score)[0]?.label ?? null,
      safest_route: surfaces.sort((a, b) => a.risk_score - b.risk_score)[0]?.label ?? null,
    },
    surfaces,
  };
}

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
  const result = liveChainService.hasLiveData()
    ? liveChainService.protectedSendPlan(body)
    : protectedSendPlan(body);

  res.json(result);
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
