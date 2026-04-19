import {
  demoStats,
  demoEngineHistory,
  demoSystemStatus,
  getDemoAttacks,
  getDemoEntities,
  getDemoEntity,
  getDemoLiveAlerts,
  getDemoPools,
  getDemoRouteRecommendations,
  getDemoRouteRisks,
} from "@/lib/demoData";

// ============================================================
// INTELLEUM API CLIENT
// All data fetching goes through here.
// Set VITE_API_URL in your .env
// ============================================================

const rawBase = import.meta.env.VITE_API_URL ?? "http://localhost:8081";
const BASE = rawBase.replace(/\/$/, "").replace(/\/api$/, "");
const API_KEY = import.meta.env.VITE_INTELLEUM_API_KEY;

function authHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
    ...(extra ?? {}),
  };
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/api${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "" || v === "undefined") return;
      url.searchParams.set(k, v);
    });
  }
  console.info("[api:get]", url.toString());
  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: authHeaders({
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status} for ${url.pathname}`);
    return res.json();
  } catch (error) {
    const fallback = getFallback<T>(path, params);
    if (fallback !== undefined) {
      console.warn("[api:fallback]", path, error);
      return fallback;
    }
    throw error;
  }
}

async function post<T>(path: string, body: any): Promise<T> {
  const url = `${BASE}/api${path}`;
  console.info("[api:post]", url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      const error = new Error(`API error: ${res.status}`) as Error & {
        status?: number;
        payload?: unknown;
      };
      error.status = res.status;
      error.payload = payload;
      throw error;
    }
    return res.json();
  } catch (error) {
    const fallback = getPostFallback<T>(path, body);
    if (fallback !== undefined) {
      console.warn("[api:post:fallback]", path, error);
      return fallback;
    }
    throw error;
  }
}

function getPostFallback<T>(path: string, body: any): T | undefined {
  if (path === "/routes/evaluate") {
    const route = getDemoRouteRisks(100).find((entry) => entry.route_key === body?.route_key)
      ?? getDemoRouteRisks(100).find((entry) => entry.protocol === body?.protocol)
      ?? getDemoRouteRisks(1)[0];
    if (!route) return undefined;
    const objective = body?.objective ?? "best_execution";
    const estimatedBpsAtRisk = Number(
      Math.max(
        1,
        Math.min(36, route.risk_score * 0.11 + route.bundle_share * 0.035 + route.avg_confidence * 0.018),
      ).toFixed(2),
    );
    const estimatedLossUsd = Number((((body?.notional_usd ?? 25_000) * estimatedBpsAtRisk) / 10_000).toFixed(2));
    return {
      route_key: route.route_key,
      label: route.label,
      protocol: route.protocol,
      matched_on: body?.route_key ? "route_key" : body?.protocol ? "protocol_pair" : "fallback",
      decision: route.risk_score >= 82 ? "avoid" : route.risk_score >= 72 ? "reroute" : route.risk_score >= 56 ? "penalize" : route.risk_score >= 28 ? "monitor" : "allow",
      risk_score: route.risk_score,
      estimated_bps_at_risk: estimatedBpsAtRisk,
      estimated_loss_usd: estimatedLossUsd,
      slippage_bps: body?.slippage_bps ?? null,
      objective,
      confidence_band: route.avg_confidence >= 78 ? "high" : route.avg_confidence >= 58 ? "medium" : "exploratory",
      execution_quality_score: route.execution_quality_score,
      toxic_flow_rate: route.toxic_flow_rate,
      realized_slippage_bps: route.realized_slippage_bps,
      markout_1s_bps: route.markout_1s_bps,
      markout_5s_bps: route.markout_5s_bps,
      markout_30s_bps: route.markout_30s_bps,
      stale_quote_pickup_rate: route.stale_quote_pickup_rate,
      quote_freshness_ms: route.quote_freshness_ms,
      flow_quality_score: route.flow_quality_score,
      toxicity_probability: route.toxicity_probability,
      retail_likelihood: route.retail_likelihood,
      lp_adverse_selection_probability: route.lp_adverse_selection_probability,
      lvr_proxy_score: route.lvr_proxy_score,
      recommended_max_notional_usd: route.recommended_max_notional_usd,
      estimated_savings_bps: route.estimated_savings_bps,
      estimated_savings_usd: Number((((body?.notional_usd ?? 25_000) * route.estimated_savings_bps) / 10_000).toFixed(2)),
      source_hint: route.source_hint,
      reason_codes: route.reason_codes,
      decomposition: route.decomposition,
      policy_action: route.policy_action,
      safer_alternatives: getDemoRouteRisks(100)
        .filter((entry) => entry.route_key !== route.route_key && entry.risk_score < route.risk_score)
        .slice(0, 2)
        .map((entry) => ({
          route_key: entry.route_key,
          label: entry.label,
          protocol: entry.protocol,
          risk_score: entry.risk_score,
          estimated_bps_saved: Number(Math.max(0, estimatedBpsAtRisk - entry.risk_score * 0.11).toFixed(2)),
        })),
      rationale: [
        `matched against ${body?.route_key ? "route key" : body?.protocol ? "protocol pair" : "fallback"} intel for ${route.label}`,
        `${route.total_attacks} detections and ${route.unique_attackers} unique operators are attached to this surface`,
        `bundle-heavy share is ${route.bundle_share.toFixed(0)}% and average detector confidence is ${route.avg_confidence.toFixed(0)}%`,
        `30s markout is ${route.markout_30s_bps.toFixed(1)} bps and stale quote pickup rate is ${route.stale_quote_pickup_rate.toFixed(0)}%`,
        `estimated LVR proxy score is ${route.lvr_proxy_score.toFixed(0)} with flow quality ${route.flow_quality_score.toFixed(0)}`,
      ],
      integration_actions: [
        "score the route before order submission",
        "emit the decision into router logs and user-protection analytics",
        "keep the route under live alert monitoring",
        `cap order size near $${route.recommended_max_notional_usd.toLocaleString()} unless the venue state improves`,
      ],
    } as T;
  }

  if (path === "/routes/rank") {
    const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
    const ranked = candidates
      .map((candidate: any) =>
        getPostFallback<any>("/routes/evaluate", {
          ...body,
          route_key: candidate.route_key,
          protocol: candidate.protocol,
          route_label: candidate.label,
        }),
      )
      .filter(Boolean)
      .sort((a: any, b: any) => a.estimated_bps_at_risk - b.estimated_bps_at_risk || a.risk_score - b.risk_score)
      .map((entry: any, index: number) => ({ ...entry, rank: index + 1 }));
    const chosen = ranked[0] ?? null;
    const worstLoss = ranked.reduce((max: number, entry: any) => Math.max(max, entry.estimated_loss_usd), 0);
    return {
      input_mint: body?.input_mint ?? null,
      output_mint: body?.output_mint ?? null,
      objective: body?.objective ?? "best_execution",
      selected_route_key: chosen?.route_key ?? null,
      selected_label: chosen?.label ?? null,
      primary_action: !chosen ? "block" : chosen.decision === "reroute" ? "reroute" : chosen.decision === "monitor" ? "monitor" : "route",
      estimated_loss_avoided_usd: Number(Math.max(0, worstLoss - (chosen?.estimated_loss_usd ?? 0)).toFixed(2)),
      estimated_bps_saved: Number(
        Math.max(
          0,
          (ranked[ranked.length - 1]?.estimated_bps_at_risk ?? chosen?.estimated_bps_at_risk ?? 0) -
            (chosen?.estimated_bps_at_risk ?? 0),
        ).toFixed(2),
      ),
      counterfactual_worst_route_key: ranked[ranked.length - 1]?.route_key ?? null,
      ranked_candidates: ranked,
    } as T;
  }

  if (path === "/prevention/guard") {
    const evaluation = getPostFallback<any>("/routes/evaluate", body);
    if (!evaluation) return undefined;
    const action =
      evaluation.decision === "avoid" ? "block" :
      evaluation.decision === "reroute" ? "reroute" :
      evaluation.decision;
    return {
      action,
      reason_codes: evaluation.reason_codes ?? [],
      expected_loss_at_risk_bps: evaluation.estimated_bps_at_risk,
      expected_loss_at_risk_usd: evaluation.estimated_loss_usd,
      recommended_max_notional_usd: evaluation.recommended_max_notional_usd ?? 25_000,
      selected_route_key: evaluation.route_key,
      selected_label: evaluation.label,
      safer_alternatives: evaluation.safer_alternatives,
      warning:
        action === "block"
          ? `block this route now: expected loss-at-risk is ${evaluation.estimated_bps_at_risk.toFixed(1)} bps`
          : action === "reroute"
            ? `reroute flow: ${evaluation.safer_alternatives[0]?.label ?? "safer alternative"} looks materially cleaner`
            : `monitor surface closely: toxicity probability is ${(evaluation.toxicity_probability ?? 0).toFixed(0)}%`,
    } as T;
  }

  return undefined;
}

function getFallback<T>(path: string, params?: Record<string, string>): T | undefined {
  if (path === "/stats") return demoStats as T;
  if (path === "/attacks") return getDemoAttacks(params) as T;
  if (path === "/attacks/history") {
    return getDemoAttacks({ limit: params?.limit }) as T;
  }
  if (path.startsWith("/attacks/")) {
    const id = Number.parseInt(path.replace("/attacks/", ""), 10);
    return getDemoAttacks({ limit: "100" }).find((attack) => attack.id === id) as T;
  }
  if (path === "/entities") return getDemoEntities(params) as T;
  if (path.startsWith("/entities/")) {
    return getDemoEntity(path.replace("/entities/", "")) as T;
  }
  if (path === "/pools") {
    return getDemoPools(Number.parseInt(params?.limit ?? "50", 10) || 50) as T;
  }
  if (path === "/routes/risk") {
    return getDemoRouteRisks(Number.parseInt(params?.limit ?? "25", 10) || 25) as T;
  }
  if (path === "/routes/recommendations") {
    return getDemoRouteRecommendations(Number.parseInt(params?.limit ?? "12", 10) || 12) as T;
  }
  if (path === "/analytics/execution-quality") {
    return getDemoRouteRisks(Number.parseInt(params?.limit ?? "20", 10) || 20).map((route) => ({
      route_key: route.route_key,
      label: route.label,
      protocol: route.protocol,
      execution_quality_score: route.execution_quality_score,
      realized_slippage_bps: route.realized_slippage_bps,
      quote_freshness_ms: route.quote_freshness_ms,
      markout_1s_bps: route.markout_1s_bps,
      markout_5s_bps: route.markout_5s_bps,
      markout_30s_bps: route.markout_30s_bps,
      stale_quote_pickup_rate: route.stale_quote_pickup_rate,
      toxic_flow_rate: route.toxic_flow_rate,
      estimated_savings_bps: route.estimated_savings_bps,
      estimated_savings_usd: route.estimated_savings_usd,
      reason_codes: route.reason_codes,
    })) as T;
  }
  if (path === "/pools/lp-protection") {
    return getDemoPools(Number.parseInt(params?.limit ?? "20", 10) || 20).map((pool) => ({
      pool_address: pool.pool_address,
      protocol: pool.protocol,
      toxicity_score: pool.toxicity_score,
      lvr_proxy_score: pool.lvr_proxy_score,
      adverse_selection_intensity: pool.adverse_selection_intensity,
      stale_quote_arb_frequency: pool.stale_quote_arb_frequency,
      lp_drag_estimate_usd: pool.lp_drag_estimate_usd,
      toxic_to_benign_volume_ratio: pool.toxic_to_benign_volume_ratio,
      quote_freshness_stress: pool.quote_freshness_stress,
      saved_fee_bps_if_segmented: pool.saved_fee_bps_if_segmented,
      primary_cause: pool.primary_cause,
      reason_codes: pool.reason_codes,
    })) as T;
  }
  if (path === "/flows/segments") {
    const routes = getDemoRouteRisks(12);
    return {
      segments: [
        { segment: "informed-toxic", description: "Flow repricing stale quotes before venues adapt.", attack_count: 2, flow_share: 40, avg_confidence: 91, avg_profit_usd: 993, toxicity_probability: 88 },
        { segment: "latency-arbitrage", description: "Latency-sensitive stale quote harvesting.", attack_count: 2, flow_share: 25, avg_confidence: 84, avg_profit_usd: 478, toxicity_probability: 63 },
        { segment: "liquidity-opportunistic", description: "JIT / liquidation style opportunistic liquidity behavior.", attack_count: 1, flow_share: 20, avg_confidence: 83, avg_profit_usd: 518, toxicity_probability: 57 },
        { segment: "benign-retail-like", description: "Residual lower-toxicity flow.", attack_count: 1, flow_share: 15, avg_confidence: 61, avg_profit_usd: 114, toxicity_probability: 24 },
      ],
      sources: routes.slice(0, 4).map((route, index) => ({
        source_key: `${route.source_hint}-${index}`,
        label: route.source_hint,
        category: route.source_hint.includes("aggregator") ? "aggregator" : route.source_hint.includes("bundle") ? "bundle-lane" : "searcher",
        flow_count: Math.max(1, route.total_attacks),
        flow_share: Number((22 - index * 3).toFixed(1)),
        flow_quality_score: route.flow_quality_score,
        toxicity_probability: route.toxicity_probability,
        retail_likelihood: route.retail_likelihood,
        bundle_likelihood: route.bundle_share,
        lp_adverse_selection_probability: route.lp_adverse_selection_probability,
        endorser_inference: route.source_hint.includes("aggregator") ? "endorsed-like" : "unendorsed",
      })),
    } as T;
  }
  if (path === "/attribution/sources") {
    const routes = getDemoRouteRisks(Number.parseInt(params?.limit ?? "8", 10) || 8);
    return routes.map((route, index) => ({
      source_key: `${route.source_hint}-${index}`,
      label: route.source_hint,
      category: route.source_hint.includes("aggregator") ? "aggregator" : route.source_hint.includes("bundle") ? "bundle-lane" : "searcher",
      flow_count: Math.max(1, route.total_attacks),
      flow_share: Number((18 - index * 1.4).toFixed(1)),
      flow_quality_score: route.flow_quality_score,
      toxicity_probability: route.toxicity_probability,
      retail_likelihood: route.retail_likelihood,
      bundle_likelihood: route.bundle_share,
      lp_adverse_selection_probability: route.lp_adverse_selection_probability,
      endorser_inference: route.source_hint.includes("aggregator") ? "endorsed-like" : route.source_hint.includes("searcher") ? "unendorsed" : "unknown",
    })) as T;
  }
  if (path === "/routes/policies") {
    return getDemoRouteRisks(Number.parseInt(params?.limit ?? "20", 10) || 20).map((route) => ({
      route_key: route.route_key,
      label: route.label,
      objective: params?.objective ?? "protect_users",
      policy_action: route.policy_action,
      recommended_max_notional_usd: route.recommended_max_notional_usd,
      estimated_savings_bps: route.estimated_savings_bps,
      estimated_savings_usd: route.estimated_savings_usd,
      reason_codes: route.reason_codes,
      decomposition: route.decomposition,
    })) as T;
  }
  if (path === "/integrations/live-alerts") {
    return getDemoLiveAlerts(Number.parseInt(params?.limit ?? "20", 10) || 20) as T;
  }
  if (path === "/integrations/feeds") {
    const limit = Number.parseInt(params?.limit ?? "20", 10) || 20;
    return {
      live_alerts: getDemoLiveAlerts(limit),
      route_risk: getDemoRouteRisks(limit),
      pool_toxicity: getDemoPools(limit),
      route_recommendations: getDemoRouteRecommendations(Math.min(limit, 12)),
      execution_quality: getFallback<any>("/analytics/execution-quality", { limit: String(limit) }),
      lp_protection: getFallback<any>("/pools/lp-protection", { limit: String(limit) }),
      flow_segments: getFallback<any>("/flows/segments"),
      source_attribution: getFallback<any>("/attribution/sources", { limit: String(limit) }),
      savings_summary: getFallback<any>("/savings/summary"),
    } as T;
  }
  if (path === "/validators/regimes") {
    return getFallback<T>("/validators");
  }
  if (path === "/savings/summary") {
    const routes = getDemoRouteRisks(25);
    const pools = getDemoPools(25);
    return {
      estimated_loss_avoided_usd_24h: Number(routes.reduce((sum, route) => sum + route.estimated_savings_usd, 0).toFixed(2)),
      estimated_bps_saved_avg: Number((routes.reduce((sum, route) => sum + route.estimated_savings_bps, 0) / Math.max(1, routes.length)).toFixed(2)),
      routes_flagged: routes.filter((route) => route.policy_action === "avoid" || route.policy_action === "reroute").length,
      pools_protected: pools.filter((pool) => (pool.lvr_proxy_score ?? 0) >= 45).length,
      users_protected_proxy: routes.reduce((sum, route) => sum + Math.max(1, route.total_attacks), 0),
    } as T;
  }
  if (path === "/prediction-markets/execution") {
    return getDemoRouteRisks(Number.parseInt(params?.limit ?? "6", 10) || 6).map((route) => ({
      market_type: "prediction",
      route_key: route.route_key,
      label: route.label,
      protocol: route.protocol,
      execution_quality_score: route.execution_quality_score,
      liquidity_stress_score: Number((route.toxic_flow_rate * 0.7 + route.bundle_share * 0.22).toFixed(1)),
      toxic_flow_flag: route.toxicity_probability >= 64 || route.policy_action === "avoid",
      recommended_action: route.policy_action === "avoid" ? "avoid" : route.execution_quality_score >= 60 ? "prefer" : "monitor",
      estimated_slippage_bps: route.realized_slippage_bps,
      rationale: [
        `${route.label} is scored for event-driven flow where short-lived repricing can dominate outcomes`,
        `execution quality is ${route.execution_quality_score.toFixed(0)} and markout 30s is ${route.markout_30s_bps.toFixed(1)} bps`,
      ],
    })) as T;
  }
  if (path === "/validators") {
    return [
      {
        validator: "Jito-Validator-Alpha",
        total_mev_attacks: 141,
        unique_entities: 2,
        unique_wallets: 6,
        total_extracted: 72910,
        sandwich_count: 83,
        arbitrage_count: 24,
        jit_count: 12,
        liquidation_count: 7,
        wide_sandwich_count: 21,
        wide_sandwich_share: 25.3,
        confirmed_share: 81.4,
        sandwich_share: 58.9,
        risk_score: 0.92,
        avg_tip_lamports: 148000,
        jito_bundle_share: 74,
        priority_fee_pressure: 59,
        markout_quality_score: 28,
        mev_share_of_flow: 41,
        observed_sandwich_rate: 58.9,
        entity_concentration_score: 83,
        stake_centralization_risk: 79,
        regime: "jito-dominant",
      },
      {
        validator: "Stakewiz-Pro-12",
        total_mev_attacks: 104,
        unique_entities: 2,
        unique_wallets: 5,
        total_extracted: 48110,
        sandwich_count: 18,
        arbitrage_count: 39,
        jit_count: 8,
        liquidation_count: 4,
        wide_sandwich_count: 4,
        wide_sandwich_share: 22.2,
        confirmed_share: 69.1,
        sandwich_share: 17.3,
        risk_score: 0.48,
        avg_tip_lamports: 102000,
        jito_bundle_share: 38,
        priority_fee_pressure: 41,
        markout_quality_score: 57,
        mev_share_of_flow: 28,
        observed_sandwich_rate: 17.3,
        entity_concentration_score: 58,
        stake_centralization_risk: 44,
        regime: "balanced",
      },
    ] as T;
  }
  if (path === "/system/status") return demoSystemStatus as T;
  if (path === "/system/history") return demoEngineHistory as T;

  return undefined;
}

// ---- Types ----

export interface GlobalStats {
  total_attacks: number;
  attacks_24h: number;
  attacks_1h: number;
  total_extracted_usd: number;
  extracted_24h: number;
  total_entities: number;
  total_wallets: number;
  total_victims: number;
  sandwich_count: number;
  arb_count: number;
  jit_count: number;
  liquidity_snipe_count?: number;
  liquidity_drain_count?: number;
}

export interface Attack {
  id: number;
  attack_type:
    | "sandwich"
    | "arbitrage"
    | "jit"
    | "liquidation"
    | "backrun"
    | "liquidity_snipe"
    | "liquidity_drain";
  slot: number;
  block_time: string;
  validator: string;
  attacker_wallet: string;
  entity_id: string | null;
  entity_label: string | null;
  entity_risk: number | null;
  victim_wallet: string | null;
  victim_loss_usd: number | null;
  pool_address: string;
  token_mint: string | null;
  profit_usd: number | null;
  tip_lamports: number | null;
  confidence: number;
  detector?: string;
  attack_quality?: "confirmed" | "likely";
  campaign_id?: string;
  protocol?: string | null;
  surface_kind?: "route" | "venue" | "pair" | "pool";
  surface_precision?: "exact-pool" | "venue-inferred" | "route-inferred" | "pair-inferred";
  surface_label?: string;
  surface_mints?: string[];
  detection_basis?: "parsed" | "flow" | "heuristic";
  bundle_likelihood?: number;
  execution_lane?: "jito-aligned" | "priority-fee" | "standard";
  evidence?: string[];
  frontrun_tx: string | null;
  victim_tx: string | null;
  backrun_tx: string | null;
}

export interface AttackDetail extends Attack {
  created_at?: string;
}

export interface SystemStatus {
  mode: "chain" | "fallback";
  heliusConfigured: boolean;
  started: boolean;
  syncing: boolean;
  lastProcessedSlot: number | null;
  latestChainSlot: number | null;
  blocksProcessed: number;
  attacksDetected: number;
  lastSyncAt: string | null;
  lastError: string | null;
  recentMetrics: {
    candidateRows: number;
    parsedTransactions: number;
    parsedSwaps: number;
    rawSlotTxs: number;
    detectedAttacks: number;
    sandwichCandidates: number;
    arbitrageCandidates: number;
    jitCandidates: number;
    liquidationCandidates: number;
    liquiditySnipeCandidates?: number;
    liquidityDrainCandidates?: number;
    suspiciousCandidates: number;
    backrunCandidates?: number;
  };
  recentAttackPreview: Array<{
    attack_type: string;
    detector: string;
    confidence: number;
    slot: number;
  }>;
  recentValidatorPreview?: Array<{
    validator: string;
    risk_score: number;
    sandwich_share: number;
    wide_sandwich_count: number;
    total_mev_attacks: number;
    unique_entities: number;
  }>;
  quicknode?: {
    enabled: boolean;
    requestsReceived: number;
    heartbeatCount: number;
    payloadCount: number;
    queuedPayloads?: number;
    lastRequestAt: string | null;
    lastPayloadAt: string | null;
    lastHeaders: Record<string, string | null>;
    lastBodyPreview: string | null;
    lastSummary: {
      blocks: number;
      transactions: number;
      firstBlock: number | null;
      keys: string[];
    } | null;
  };
}

export interface EngineSnapshot {
  id: number;
  mode: "chain" | "fallback";
  last_processed_slot: number | null;
  latest_chain_slot: number | null;
  blocks_processed: number;
  attacks_detected: number;
  parsed_transactions: number;
  parsed_swaps: number;
  raw_slot_txs: number;
  sandwich_candidates: number;
  arbitrage_candidates: number;
  jit_candidates: number;
  liquidation_candidates: number;
  liquidity_snipe_candidates?: number;
  liquidity_drain_candidates?: number;
  suspicious_candidates?: number;
  backrun_candidates?: number;
  last_error: string | null;
  created_at: string;
}

export interface Entity {
  id: string;
  label: string | null;
  operator_wallet: string | null;
  first_seen: string;
  last_seen: string;
  total_profit_usd: number;
  profit_24h_usd: number;
  profit_7d_usd: number;
  attack_count: number;
  victim_count: number;
  dominant_strategy: string | null;
  strategies_used: string[];
  risk_score: number;
  fee_aggression: number;
  position_dominance: number;
  pool_concentration: number;
  profit_consistency: number;
  wallet_count: number;
  sample_wallets: string[];
}

export interface EntityDetail extends Entity {
  wallets: Array<{ wallet: string; role: string; tx_count: number; operator_label: string | null }>;
  recent_attacks: Attack[];
  targeted_pools: Array<{ pool_address: string; attack_count: number; total_profit: number }>;
  validator_correlation: Array<{
    validator: string;
    attacks: number;
    exposure_share: number;
    validator_risk: number;
    observed_sandwich_rate: number;
    stake_centralization_risk: number;
    recommended_action: "reroute" | "monitor" | "observe";
  }>;
  cluster_evidence: {
    shared_surface_count: number;
    shared_validator_count: number;
    shared_strategy_count: number;
    coordinated_window_count: number;
  };
  related_surfaces: Array<{ surface: string; wallet_count: number; attacks: number; total_profit: number }>;
  profit_timeline: Array<{ day: string; profit: number; attacks: number }>;
}

export interface PoolToxicity {
  pool_address: string;
  epoch: number;
  protocol: string | null;
  sandwich_count: number;
  arbitrage_count: number;
  jit_count: number;
  total_attacks: number;
  total_extracted_usd: number;
  unique_attackers: number;
  toxicity_score: number;
  top_entity_id: string | null;
  top_entity_label: string | null;
  top_entity_risk: number | null;
  lvr_proxy_score?: number;
  adverse_selection_intensity?: number;
  stale_quote_arb_frequency?: number;
  lp_drag_estimate_usd?: number;
  toxic_to_benign_volume_ratio?: number;
  quote_freshness_stress?: number;
  saved_fee_bps_if_segmented?: number;
  primary_cause?: string;
  reason_codes?: string[];
}

export interface RouteRisk {
  route_key: string;
  route_kind: "route" | "venue" | "pair" | "pool";
  protocol: string | null;
  label: string;
  sandwich_count: number;
  arbitrage_count: number;
  jit_count: number;
  liquidation_count: number;
  backrun_count: number;
  total_attacks: number;
  total_extracted_usd: number;
  unique_attackers: number;
  avg_confidence: number;
  bundle_share: number;
  risk_score: number;
  recommendation: "avoid" | "penalize" | "monitor";
  execution_quality_score: number;
  toxic_flow_rate: number;
  realized_slippage_bps: number;
  stale_quote_pickup_rate: number;
  quote_freshness_ms: number;
  markout_1s_bps: number;
  markout_5s_bps: number;
  markout_30s_bps: number;
  flow_quality_score: number;
  toxicity_probability: number;
  retail_likelihood: number;
  lp_adverse_selection_probability: number;
  lvr_proxy_score: number;
  priority_fee_pressure: number;
  validator_markout_quality: number;
  source_hint: string;
  recommended_max_notional_usd: number;
  estimated_savings_bps: number;
  estimated_savings_usd: number;
  policy_action: "allow" | "monitor" | "penalize" | "avoid" | "reroute";
  reason_codes: string[];
  decomposition: Array<{ label: string; value: number }>;
}

export interface RouteRecommendation {
  input_mint: string | null;
  output_mint: string | null;
  recommended_routes: Array<{
    route_key: string;
    label: string;
    protocol: string | null;
    recommendation: "prefer" | "monitor";
    risk_score: number;
    rationale: string[];
  }>;
  avoid_routes: Array<{
    route_key: string;
    label: string;
    protocol: string | null;
    risk_score: number;
    rationale: string[];
  }>;
}

export interface LiveAlert {
  id: number;
  attack_type: Attack["attack_type"];
  severity: "critical" | "high" | "medium";
  summary: string;
  action: "block" | "penalize" | "monitor";
  route_key: string;
  route_label: string;
  protocol: string | null;
  validator: string;
  attacker_wallet: string;
  confidence: number;
  bundle_likelihood: number;
  block_time: string;
  rationale: string[];
}

export interface IssuedApiKeyResponse {
  success: boolean;
  wallet_address: string;
  api_key: string;
  api_key_prefix: string;
  request_limit: number;
  request_count: number;
  remaining_requests: number;
  required_header: string;
}

export interface IssuedApiKeyStatus {
  wallet_address: string;
  api_key_prefix: string;
  request_limit: number;
  request_count: number;
  remaining_requests: number;
  status: string;
  created_at: string;
  last_request_at: string | null;
  required_header: string;
}

export interface RouteEvaluationRequest {
  input_mint?: string | null;
  output_mint?: string | null;
  protocol?: string | null;
  route_key?: string | null;
  route_label?: string | null;
  notional_usd?: number | null;
  slippage_bps?: number | null;
  objective?: "best_execution" | "protect_users" | "protect_lp" | "monitor_only";
}

export interface RouteEvaluation {
  route_key: string | null;
  label: string;
  protocol: string | null;
  matched_on: "route_key" | "protocol_pair" | "pair" | "fallback";
  decision: "allow" | "monitor" | "penalize" | "avoid" | "reroute";
  risk_score: number;
  estimated_bps_at_risk: number;
  estimated_loss_usd: number;
  slippage_bps: number | null;
  objective: NonNullable<RouteEvaluationRequest["objective"]>;
  confidence_band: "high" | "medium" | "exploratory";
  execution_quality_score?: number;
  toxic_flow_rate?: number;
  realized_slippage_bps?: number;
  markout_1s_bps?: number;
  markout_5s_bps?: number;
  markout_30s_bps?: number;
  stale_quote_pickup_rate?: number;
  quote_freshness_ms?: number;
  flow_quality_score?: number;
  toxicity_probability?: number;
  retail_likelihood?: number;
  lp_adverse_selection_probability?: number;
  lvr_proxy_score?: number;
  recommended_max_notional_usd?: number;
  estimated_savings_bps?: number;
  estimated_savings_usd?: number;
  source_hint?: string;
  reason_codes?: string[];
  decomposition?: Array<{ label: string; value: number }>;
  policy_action?: "allow" | "monitor" | "penalize" | "avoid" | "reroute";
  safer_alternatives: Array<{
    route_key: string;
    label: string;
    protocol: string | null;
    risk_score: number;
    estimated_bps_saved: number;
  }>;
  rationale: string[];
  integration_actions: string[];
}

export interface RouteRankingRequest {
  input_mint?: string | null;
  output_mint?: string | null;
  notional_usd?: number | null;
  slippage_bps?: number | null;
  objective?: "best_execution" | "protect_users" | "protect_lp" | "monitor_only";
  candidates: Array<{
    route_key?: string | null;
    protocol?: string | null;
    label?: string | null;
    input_mint?: string | null;
    output_mint?: string | null;
  }>;
}

export interface RouteRanking {
  input_mint: string | null;
  output_mint: string | null;
  objective: NonNullable<RouteRankingRequest["objective"]>;
  selected_route_key: string | null;
  selected_label: string | null;
  primary_action: "route" | "monitor" | "reroute" | "block";
  estimated_loss_avoided_usd: number;
  estimated_bps_saved?: number;
  counterfactual_worst_route_key?: string | null;
  ranked_candidates: Array<RouteEvaluation & { rank: number }>;
}

export interface ValidatorIntel {
  validator: string;
  total_mev_attacks: number;
  unique_entities: number;
  unique_wallets: number;
  total_extracted: number;
  sandwich_count: number;
  arbitrage_count: number;
  jit_count: number;
  liquidation_count: number;
  wide_sandwich_count: number;
  wide_sandwich_share: number;
  confirmed_share: number;
  sandwich_share: number;
  risk_score: number;
  avg_tip_lamports: number;
  jito_bundle_share?: number;
  priority_fee_pressure?: number;
  markout_quality_score?: number;
  mev_share_of_flow?: number;
  observed_sandwich_rate?: number;
  entity_concentration_score?: number;
  stake_centralization_risk?: number;
  regime?: string;
}

export interface ExecutionQualitySnapshot {
  route_key: string;
  label: string;
  protocol: string | null;
  execution_quality_score: number;
  realized_slippage_bps: number;
  quote_freshness_ms: number;
  markout_1s_bps: number;
  markout_5s_bps: number;
  markout_30s_bps: number;
  stale_quote_pickup_rate: number;
  toxic_flow_rate: number;
  estimated_savings_bps: number;
  estimated_savings_usd: number;
  reason_codes: string[];
}

export interface LpProtectionSnapshot {
  pool_address: string;
  protocol: string | null;
  toxicity_score: number;
  lvr_proxy_score: number;
  adverse_selection_intensity: number;
  stale_quote_arb_frequency: number;
  lp_drag_estimate_usd: number;
  toxic_to_benign_volume_ratio: number;
  quote_freshness_stress: number;
  saved_fee_bps_if_segmented: number;
  primary_cause: string;
  reason_codes: string[];
}

export interface FlowSegment {
  segment: string;
  description: string;
  attack_count: number;
  flow_share: number;
  avg_confidence: number;
  avg_profit_usd: number;
  toxicity_probability: number;
}

export interface SourceAttribution {
  source_key: string;
  label: string;
  category: "aggregator" | "wallet" | "searcher" | "liquidation" | "bundle-lane";
  flow_count: number;
  flow_share: number;
  flow_quality_score: number;
  toxicity_probability: number;
  retail_likelihood: number;
  bundle_likelihood: number;
  lp_adverse_selection_probability: number;
  endorser_inference: "endorsed-like" | "unendorsed" | "unknown";
}

export interface PreventionGuard {
  action: "allow" | "monitor" | "penalize" | "reroute" | "block";
  reason_codes: string[];
  expected_loss_at_risk_bps: number;
  expected_loss_at_risk_usd: number;
  recommended_max_notional_usd: number;
  selected_route_key: string | null;
  selected_label: string | null;
  safer_alternatives: RouteEvaluation["safer_alternatives"];
  warning: string;
}

export interface RoutePolicy {
  route_key: string;
  label: string;
  objective: string;
  policy_action: "allow" | "monitor" | "penalize" | "avoid" | "reroute";
  recommended_max_notional_usd: number;
  estimated_savings_bps: number;
  estimated_savings_usd: number;
  reason_codes: string[];
  decomposition: Array<{ label: string; value: number }>;
}

export interface SavingsSummary {
  estimated_loss_avoided_usd_24h: number;
  estimated_bps_saved_avg: number;
  routes_flagged: number;
  pools_protected: number;
  users_protected_proxy: number;
}

export interface PredictionMarketExecution {
  market_type: "prediction";
  route_key: string;
  label: string;
  protocol: string | null;
  execution_quality_score: number;
  liquidity_stress_score: number;
  toxic_flow_flag: boolean;
  recommended_action: "prefer" | "monitor" | "avoid";
  estimated_slippage_bps: number;
  rationale: string[];
}

// ---- API Functions ----

export const api = {
  stats: () => get<GlobalStats>("/stats"),

  attacks: (params?: { type?: string; pool?: string; limit?: string; since?: string }) =>
    get<Attack[]>("/attacks", params as any),

  attackHistory: (limit?: number) => get<Attack[]>("/attacks/history", { limit: String(limit ?? 100) }),

  attackDetail: (id: number) => get<AttackDetail>(`/attacks/${id}`),

  entities: (params?: { strategy?: string; min_risk?: string; sort?: string; limit?: string }) =>
    get<Entity[]>("/entities", params as any),

  entity: (id: string) => get<EntityDetail>(`/entities/${id}`),

  pools: (limit?: number) => get<PoolToxicity[]>("/pools", { limit: String(limit ?? 50) }),

  routeRisks: (limit?: number) => get<RouteRisk[]>("/routes/risk", { limit: String(limit ?? 25) }),

  executionQuality: (limit?: number) =>
    get<ExecutionQualitySnapshot[]>("/analytics/execution-quality", { limit: String(limit ?? 20) }),

  routeRecommendations: (limit?: number) =>
    get<RouteRecommendation[]>("/routes/recommendations", { limit: String(limit ?? 12) }),

  routePolicies: (limit?: number, objective?: string) =>
    get<RoutePolicy[]>("/routes/policies", { limit: String(limit ?? 20), objective: objective ?? "protect_users" }),

  evaluateRoute: (payload: RouteEvaluationRequest) =>
    post<RouteEvaluation>("/routes/evaluate", payload),

  rankRoutes: (payload: RouteRankingRequest) =>
    post<RouteRanking>("/routes/rank", payload),

  preventionGuard: (payload: RouteEvaluationRequest & { candidates?: RouteRankingRequest["candidates"] }) =>
    post<PreventionGuard>("/prevention/guard", payload),

  lpProtection: (limit?: number) =>
    get<LpProtectionSnapshot[]>("/pools/lp-protection", { limit: String(limit ?? 20) }),

  flowSegments: () =>
    get<{ segments: FlowSegment[]; sources: SourceAttribution[] }>("/flows/segments"),

  sourceAttribution: (limit?: number) =>
    get<SourceAttribution[]>("/attribution/sources", { limit: String(limit ?? 8) }),

  liveAlerts: (limit?: number) =>
    get<LiveAlert[]>("/integrations/live-alerts", { limit: String(limit ?? 20) }),

  integrationFeeds: (limit?: number) =>
    get<{
      live_alerts: LiveAlert[];
      route_risk: RouteRisk[];
      pool_toxicity: PoolToxicity[];
      route_recommendations: RouteRecommendation[];
    }>("/integrations/feeds", { limit: String(limit ?? 20) }),

  pool: (address: string) => get<any>(`/pools/${address}`),

  validators: () => get<ValidatorIntel[]>("/validators"),

  validatorRegimes: (limit?: number) => get<ValidatorIntel[]>("/validators/regimes", { limit: String(limit ?? 10) }),

  savingsSummary: () => get<SavingsSummary>("/savings/summary"),

  predictionMarketExecution: (limit?: number) =>
    get<PredictionMarketExecution[]>("/prediction-markets/execution", { limit: String(limit ?? 6) }),

  wallet: (address: string) => get<any>(`/wallet/${address}`),

  systemStatus: () => get<SystemStatus>("/system/status"),

  systemHistory: () => get<EngineSnapshot[]>("/system/history"),

  submitAccess: (data: { name: string; email: string; organization: string; useCase: string; message?: string }) =>
    post<{ success: boolean }>("/access/request", data),

  issueApiKey: (data: {
    walletAddress: string;
    name?: string;
    email?: string;
    organization?: string;
    useCase?: string;
    message?: string;
  }) => post<IssuedApiKeyResponse>("/access/api-key", data),

  apiKeyStatus: (walletAddress: string) =>
    get<IssuedApiKeyStatus>(`/access/api-key/status/${walletAddress}`),
};
