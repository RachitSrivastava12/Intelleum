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
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
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
      ],
      integration_actions: [
        "score the route before order submission",
        "emit the decision into router logs and user-protection analytics",
        "keep the route under live alert monitoring",
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
      ranked_candidates: ranked,
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
    } as T;
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
}

export interface Attack {
  id: number;
  attack_type: "sandwich" | "arbitrage" | "jit" | "liquidation" | "backrun";
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
  validator_correlation: Array<{ validator: string; attacks: number }>;
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

  routeRecommendations: (limit?: number) =>
    get<RouteRecommendation[]>("/routes/recommendations", { limit: String(limit ?? 12) }),

  evaluateRoute: (payload: RouteEvaluationRequest) =>
    post<RouteEvaluation>("/routes/evaluate", payload),

  rankRoutes: (payload: RouteRankingRequest) =>
    post<RouteRanking>("/routes/rank", payload),

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

  wallet: (address: string) => get<any>(`/wallet/${address}`),

  systemStatus: () => get<SystemStatus>("/system/status"),

  systemHistory: () => get<EngineSnapshot[]>("/system/history"),

  submitAccess: (data: { name: string; email: string; organization: string; useCase: string; message?: string }) =>
    post<{ success: boolean }>("/access/request", data),
};
