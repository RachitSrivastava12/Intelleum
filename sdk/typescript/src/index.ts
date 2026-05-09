export type ProtectionObjective =
  | "best_execution"
  | "protect_users"
  | "protect_lp"
  | "monitor_only";

export type GuardAction =
  | "allow"
  | "monitor"
  | "penalize"
  | "avoid"
  | "reroute"
  | "block";

export type RouteDecision =
  | "allow"
  | "monitor"
  | "penalize"
  | "avoid"
  | "reroute";

export interface RouteCandidate {
  route_key?: string | null;
  label?: string | null;
  protocol?: string | null;
  input_mint?: string | null;
  output_mint?: string | null;
  notional_usd?: number | null;
  expected_out_amount?: string | number | null;
  price_impact_bps?: number | null;
  pool_address?: string | null;
  pool_addresses?: string[];
  venue_addresses?: string[];
}

export interface RouteEvaluationRequest {
  route_key?: string | null;
  route_label?: string | null;
  protocol?: string | null;
  input_mint?: string | null;
  output_mint?: string | null;
  notional_usd?: number | null;
  slippage_bps?: number | null;
  objective?: ProtectionObjective;
}

export interface RouteEvaluation extends Required<Pick<RouteEvaluationRequest, "objective">> {
  route_key: string | null;
  label: string;
  protocol: string | null;
  matched_on: "route_key" | "protocol_pair" | "pair" | "fallback";
  decision: RouteDecision;
  risk_score: number;
  estimated_bps_at_risk: number;
  estimated_loss_usd: number;
  slippage_bps: number | null;
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
  recommended_max_notional_usd?: number;
  estimated_savings_bps?: number;
  estimated_savings_usd?: number;
  reason_codes?: string[];
}

export interface RouteRankingRequest {
  input_mint?: string | null;
  output_mint?: string | null;
  notional_usd?: number | null;
  slippage_bps?: number | null;
  objective?: ProtectionObjective;
  candidates: RouteCandidate[];
}

export interface RouteRanking {
  input_mint: string | null;
  output_mint: string | null;
  objective: ProtectionObjective;
  selected_route_key: string | null;
  selected_label: string | null;
  primary_action: "route" | "monitor" | "reroute" | "block";
  estimated_loss_avoided_usd: number;
  estimated_bps_saved?: number;
  counterfactual_worst_route_key?: string | null;
  ranked_candidates: Array<RouteEvaluation & { rank: number }>;
}

export interface PreventionGuardRequest extends RouteEvaluationRequest {
  candidates?: RouteCandidate[];
}

export interface SavingsProof {
  route_key: string | null;
  selected_label: string | null;
  protected_notional_usd: number;
  estimated_loss_prevented_usd: number;
  monthly_savings_projection_usd: number;
  estimated_bps_saved: number;
  counterfactual_route_key: string | null;
  counterfactual_label: string | null;
  confidence: RouteEvaluation["confidence_band"];
  trades_per_day_assumption: number;
  proof_points: string[];
}

export interface ProtectedSendPolicy {
  mode: "standard_submit" | "private_submit" | "cap_and_monitor" | "reroute" | "block";
  submit_via: "public_rpc" | "private_rpc" | "jito_dontfront" | "do_not_submit";
  use_jito_dontfront: boolean;
  fail_closed: boolean;
  ttl_ms: number;
  max_slippage_bps: number | null;
  max_notional_usd: number;
  route_action: "allow" | "monitor" | "penalize" | "reroute" | "block";
  implementation_steps: string[];
  rationale: string[];
}

export interface CustomerImpact {
  buyer: "wallet" | "router" | "lp" | "lending" | "trading-desk";
  saves: string;
  primary_metric: string;
}

export interface PreventionGuard {
  action: GuardAction;
  reason_codes: string[];
  expected_loss_at_risk_bps: number;
  expected_loss_at_risk_usd: number;
  recommended_max_notional_usd: number;
  selected_route_key: string | null;
  selected_label: string | null;
  safer_alternatives: RouteEvaluation["safer_alternatives"];
  savings_proof: SavingsProof;
  protected_send_policy: ProtectedSendPolicy;
  customer_impact: CustomerImpact[];
  warning: string;
}

export interface RoutePolicy {
  route_key: string;
  label: string;
  objective: ProtectionObjective;
  policy_action: GuardAction;
  recommended_max_notional_usd: number;
  estimated_savings_bps: number;
  estimated_savings_usd: number;
  reason_codes: string[];
  decomposition: Array<{ label: string; value: number }>;
}

export interface LiveAlert {
  id: number;
  attack_type: string;
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

export interface SavingsSummary {
  estimated_loss_avoided_usd_24h: number;
  estimated_bps_saved_avg: number;
  routes_flagged: number;
  pools_protected: number;
  users_protected_proxy: number;
}

export interface LiquidationFirewallRecord {
  protocol: "drift" | "kamino" | "save" | "marginfi";
  market: string;
  regime: "normal" | "watch" | "toxic" | "stress";
  liquidation_pressure: number;
  toxic_liquidator_share: number;
  bad_debt_risk_bps: number;
  estimated_loss_preventable_usd_24h: number;
  recommended_action: "allow" | "monitor" | "route_private" | "throttle" | "pause";
  reason_codes: string[];
  playbook: string[];
}

export type ToxicFlowEventType =
  | "sandwich"
  | "arbitrage"
  | "jit"
  | "liquidation"
  | "backrun"
  | "liquidity_snipe"
  | "liquidity_drain";

export interface ToxicFlowCandle {
  timestamp: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_usd: number;
  toxic_flow_score: number;
  markout_bps: number;
  lvr_bps: number;
  loss_at_risk_usd: number;
  prevented_loss_usd: number;
  attack_count: number;
  event_type: ToxicFlowEventType | null;
}

export interface ToxicFlowOverlay {
  timestamp: string;
  event_type: ToxicFlowEventType;
  severity: "critical" | "high" | "medium";
  label: string;
  loss_usd: number;
  confidence: number;
}

export interface ToxicFlowSurface {
  route_key: string;
  label: string;
  protocol: string | null;
  pair: string;
  action: RouteDecision;
  risk_score: number;
  execution_quality_score: number;
  toxic_flow_score: number;
  price_change_pct: number;
  markout_30s_bps: number;
  volume_24h_usd: number;
  loss_at_risk_24h_usd: number;
  prevented_loss_24h_usd: number;
  liquidity_stress: number;
  quote_freshness_ms: number;
  reason_codes: string[];
  candles: ToxicFlowCandle[];
  overlays: ToxicFlowOverlay[];
}

export interface ToxicFlowTerminal {
  generated_at: string;
  source: "fallback" | "chain";
  interval: "5m" | "15m" | "1h";
  summary: {
    surfaces_tracked: number;
    routes_in_block: number;
    estimated_loss_at_risk_24h_usd: number;
    estimated_prevented_loss_24h_usd: number;
    highest_toxicity_route: string | null;
    safest_route: string | null;
  };
  surfaces: ToxicFlowSurface[];
}

export interface IntelleumClientConfig {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface ProtectionOptions {
  objective?: ProtectionObjective;
  failOpen?: boolean;
  blockOn?: GuardAction[];
}

export interface ProtectedSwap<TSwap> {
  swap: TSwap;
  guard: PreventionGuard;
  allowed: boolean;
  shouldReroute: boolean;
  shouldBlock: boolean;
  action: GuardAction;
  expectedLossAtRiskUsd: number;
  expectedLossAtRiskBps: number;
  recommendedMaxNotionalUsd: number;
  savingsProof: SavingsProof;
  protectedSendPolicy: ProtectedSendPolicy;
}

export interface JupiterSwapInfoLike {
  ammKey?: string;
  label?: string;
  inputMint?: string;
  outputMint?: string;
}

export interface JupiterRouteLegLike {
  swapInfo?: JupiterSwapInfoLike;
  percent?: number;
  bps?: number;
}

export interface JupiterQuoteLike {
  inputMint?: string;
  outputMint?: string;
  inAmount?: string | number;
  outAmount?: string | number;
  priceImpactPct?: string | number;
  routePlan?: JupiterRouteLegLike[];
}

export class IntelleumPolicyError extends Error {
  readonly guard: PreventionGuard;
  readonly action: GuardAction;

  constructor(message: string, guard: PreventionGuard) {
    super(message);
    this.name = "IntelleumPolicyError";
    this.guard = guard;
    this.action = guard.action;
  }
}

export class IntelleumApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Intelleum API request failed with status ${status}`);
    this.name = "IntelleumApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class IntelleumProtectClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(config: IntelleumClientConfig) {
    if (!config.baseUrl) {
      throw new Error("IntelleumProtectClient requires a baseUrl");
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, "").replace(/\/api$/, "");
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;

    if (!this.fetchImpl) {
      throw new Error("No fetch implementation is available. Pass fetchImpl in the client config.");
    }
  }

  evaluateRoute(request: RouteEvaluationRequest): Promise<RouteEvaluation> {
    return this.request("POST", "/routes/evaluate", request);
  }

  rankRoutes(request: RouteRankingRequest): Promise<RouteRanking> {
    return this.request("POST", "/routes/rank", request);
  }

  guard(request: PreventionGuardRequest): Promise<PreventionGuard> {
    return this.request("POST", "/prevention/guard", request);
  }

  planProtectedSend(request: PreventionGuardRequest): Promise<PreventionGuard> {
    return this.request("POST", "/prevention/protected-send", request);
  }

  getPolicies(params: { limit?: number; objective?: ProtectionObjective } = {}): Promise<RoutePolicy[]> {
    return this.request("GET", "/routes/policies", undefined, params);
  }

  getLiveAlerts(params: { limit?: number } = {}): Promise<LiveAlert[]> {
    return this.request("GET", "/integrations/live-alerts", undefined, params);
  }

  getSavingsSummary(): Promise<SavingsSummary> {
    return this.request("GET", "/savings/summary");
  }

  getLiquidationFirewall(params: { limit?: number } = {}): Promise<LiquidationFirewallRecord[]> {
    return this.request("GET", "/liquidations/firewall", undefined, params);
  }

  getToxicFlowTerminal(
    params: { limit?: number; interval?: ToxicFlowTerminal["interval"] } = {},
  ): Promise<ToxicFlowTerminal> {
    return this.request("GET", "/terminal/toxic-flow", undefined, params);
  }

  async protectSwap<TSwap extends PreventionGuardRequest>(
    swap: TSwap,
    options: ProtectionOptions = {},
  ): Promise<ProtectedSwap<TSwap>> {
    const guard = await this.planProtectedSend({
      ...swap,
      objective: options.objective ?? swap.objective ?? "protect_users",
    });
    return buildProtectedSwap(swap, guard, options);
  }

  async assertSafeToExecute<TSwap extends PreventionGuardRequest>(
    swap: TSwap,
    options: ProtectionOptions = {},
  ): Promise<ProtectedSwap<TSwap>> {
    const protectedSwap = await this.protectSwap(swap, options);
    if (!protectedSwap.allowed) {
      throw new IntelleumPolicyError(protectedSwap.guard.warning, protectedSwap.guard);
    }
    return protectedSwap;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/api${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }

    const init: RequestInit = {
      method,
      headers: {
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await this.fetchImpl(url.toString(), init);

    if (!response.ok) {
      const text = await response.text();
      let payload: unknown = text;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      throw new IntelleumApiError(response.status, payload);
    }

    return response.json() as Promise<T>;
  }
}

export function buildProtectedSwap<TSwap>(
  swap: TSwap,
  guard: PreventionGuard,
  options: ProtectionOptions = {},
): ProtectedSwap<TSwap> {
  const blockOn = options.blockOn ?? ["block", "avoid", "reroute"];
  const shouldBlock = blockOn.includes(guard.action);
  const shouldReroute = guard.action === "reroute" || guard.action === "avoid" || guard.action === "block";
  const allowed = options.failOpen ? true : !shouldBlock;

  return {
    swap,
    guard,
    allowed,
    shouldReroute,
    shouldBlock,
    action: guard.action,
    expectedLossAtRiskUsd: guard.expected_loss_at_risk_usd,
    expectedLossAtRiskBps: guard.expected_loss_at_risk_bps,
    recommendedMaxNotionalUsd: guard.recommended_max_notional_usd,
    savingsProof: guard.savings_proof,
    protectedSendPolicy: guard.protected_send_policy,
  };
}

export function shouldBlock(action: GuardAction): boolean {
  return action === "block" || action === "avoid";
}

export function shouldDownrank(action: GuardAction): boolean {
  return action === "penalize" || action === "reroute" || shouldBlock(action);
}

export function candidatesFromJupiterQuote(quote: JupiterQuoteLike): RouteCandidate[] {
  const inputMint = quote.inputMint ?? null;
  const outputMint = quote.outputMint ?? null;
  const seen = new Set<string>();

  return (quote.routePlan ?? [])
    .map((leg) => {
      const info = leg.swapInfo ?? {};
      const protocol = slugProtocol(info.label ?? "unknown");
      const poolAddress = info.ammKey ?? null;
      const legInput = info.inputMint ?? inputMint;
      const legOutput = info.outputMint ?? outputMint;
      const routeKey = poolAddress
        ? `pool:${poolAddress}`
        : legInput && legOutput
          ? `venue:${protocol}:${legInput}->${legOutput}`
          : `venue:${protocol}`;

      return {
        route_key: routeKey,
        label: info.label ?? protocol,
        protocol,
        input_mint: legInput,
        output_mint: legOutput,
        pool_address: poolAddress,
        pool_addresses: poolAddress ? [poolAddress] : [],
        price_impact_bps: priceImpactToBps(quote.priceImpactPct),
      } satisfies RouteCandidate;
    })
    .filter((candidate) => {
      const key = candidate.route_key ?? `${candidate.protocol}:${candidate.input_mint}:${candidate.output_mint}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function guardRequestFromJupiterQuote(
  quote: JupiterQuoteLike,
  options: {
    notionalUsd?: number;
    slippageBps?: number;
    objective?: ProtectionObjective;
  } = {},
): PreventionGuardRequest {
  const candidates = candidatesFromJupiterQuote(quote);
  const first = candidates[0];

  return {
    route_key: first?.route_key ?? null,
    route_label: first?.label ?? "Jupiter route",
    protocol: first?.protocol ?? null,
    input_mint: quote.inputMint ?? first?.input_mint ?? null,
    output_mint: quote.outputMint ?? first?.output_mint ?? null,
    notional_usd: options.notionalUsd ?? null,
    slippage_bps: options.slippageBps ?? null,
    objective: options.objective ?? "protect_users",
    candidates,
  };
}

function slugProtocol(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "unknown";
}

function priceImpactToBps(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed * 100 : parsed * 10_000;
}
