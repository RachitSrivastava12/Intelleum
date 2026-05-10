import { Connection } from "@solana/web3.js";
import {
  DetectedAttack,
  TxFlow,
  detectArbitrage,
  detectJIT,
  detectSandwiches,
  detectWideSandwiches,
} from "../detection/mevDetector";
import { getProgramLabel, isDex, isLending } from "../ingestion/programs";
import { extractTokenFlows } from "../ingestion/tokenFlows";

type AttackType = DetectedAttack["attack_type"];

interface ApiAttack {
  id: number;
  attack_type: AttackType;
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
  detector: string;
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
  evidence: string[];
  frontrun_tx: string | null;
  victim_tx: string | null;
  backrun_tx: string | null;
}

interface ApiEntity {
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

interface ApiPool {
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

interface ApiRouteRisk {
  route_key: string;
  route_kind: "route" | "venue" | "pair" | "pool";
  protocol: string | null;
  label: string;
  sandwich_count: number;
  arbitrage_count: number;
  jit_count: number;
  liquidation_count: number;
  backrun_count: number;
  liquidity_snipe_count: number;
  liquidity_drain_count: number;
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

type ApiRouteRiskAccumulator = Pick<
  ApiRouteRisk,
  | "route_key"
  | "route_kind"
  | "protocol"
  | "label"
  | "sandwich_count"
  | "arbitrage_count"
  | "jit_count"
  | "liquidation_count"
  | "backrun_count"
  | "liquidity_snipe_count"
  | "liquidity_drain_count"
  | "total_attacks"
  | "total_extracted_usd"
> & {
  confidence_sum: number;
  bundle_sum: number;
  attackers: Set<string>;
};

interface ApiRouteRecommendation {
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

interface ApiLiveAlert {
  id: number;
  attack_type: AttackType;
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

interface ApiRouteEvaluationRequest {
  input_mint?: string | null;
  output_mint?: string | null;
  protocol?: string | null;
  route_key?: string | null;
  route_label?: string | null;
  notional_usd?: number | null;
  slippage_bps?: number | null;
  objective?: "best_execution" | "protect_users" | "protect_lp" | "monitor_only";
}

interface ApiRouteEvaluation {
  route_key: string | null;
  label: string;
  protocol: string | null;
  matched_on: "route_key" | "protocol_pair" | "pair" | "fallback";
  decision: "allow" | "monitor" | "penalize" | "avoid" | "reroute";
  risk_score: number;
  estimated_bps_at_risk: number;
  estimated_loss_usd: number;
  slippage_bps: number | null;
  objective: NonNullable<ApiRouteEvaluationRequest["objective"]>;
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

interface ApiRouteRankingRequest {
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

interface ApiRouteRanking {
  input_mint: string | null;
  output_mint: string | null;
  objective: NonNullable<ApiRouteRankingRequest["objective"]>;
  selected_route_key: string | null;
  selected_label: string | null;
  primary_action: "route" | "monitor" | "reroute" | "block";
  estimated_loss_avoided_usd: number;
  estimated_bps_saved?: number;
  counterfactual_worst_route_key?: string | null;
  ranked_candidates: Array<
    ApiRouteEvaluation & {
      rank: number;
    }
  >;
}

interface HeliusSwapTokenAmount {
  mint?: string;
  tokenAddress?: string;
  rawTokenAmount?: {
    tokenAmount?: string;
    decimals?: number;
  };
}

interface HeliusEnhancedTx {
  signature?: string;
  feePayer?: string;
  type?: string;
  source?: string;
  description?: string;
  timestamp?: number;
  nativeTransfers?: Array<{
    fromUserAccount?: string | null;
    toUserAccount?: string | null;
    amount?: number | null;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount?: string | null;
    toUserAccount?: string | null;
    mint?: string | null;
    tokenAmount?: number | null;
  }>;
  accountData?: Array<{
    account?: string | null;
    nativeBalanceChange?: number | null;
    tokenBalanceChanges?: Array<{
      userAccount?: string | null;
      tokenAccount?: string | null;
      mint?: string | null;
      rawTokenAmount?: {
        tokenAmount?: string;
        decimals?: number;
      };
    }>;
  }>;
  events?: {
    swap?: {
      nativeInput?: { amount?: string | number };
      nativeOutput?: { amount?: string | number };
      tokenInputs?: HeliusSwapTokenAmount[];
      tokenOutputs?: HeliusSwapTokenAmount[];
      tokenFees?: HeliusSwapTokenAmount[];
      nativeFees?: Array<{ amount?: string | number }>;
      innerSwaps?: Array<{
        tokenInputs?: HeliusSwapTokenAmount[];
        tokenOutputs?: HeliusSwapTokenAmount[];
      }>;
    };
  };
}

interface ParsedSwapCandidate {
  signature: string;
  slot: number;
  tx_index: number;
  signer: string;
  validator: string;
  block_time: Date;
  pool_address: string | null;
  source: string | null;
  input_mint: string | null;
  output_mint: string | null;
  input_amount: number | null;
  output_amount: number | null;
  input_usd: number | null;
  output_usd: number | null;
  notional_usd: number | null;
  price_impact_hint: number | null;
  priority_fee: number | null;
  signer_stable_delta_usd: number;
}

interface CandidateRow {
  signature: string;
  tx_index: number;
  signer: string;
  priority_fee: number | null;
  hasDexProgram: boolean;
  hasLendingProgram: boolean;
  tokenBalanceChanges: number;
  isHighPriority: boolean;
  hasSwapLikeFlow: boolean;
  stableFlowCount: number;
  routedPoolCount: number;
  candidateScore: number;
  touchedPrograms: string[];
  programLabels: string[];
  logText: string;
  liquidationSignal: boolean;
  liquiditySignal: boolean;
}

interface LiquidityLegCandidate {
  signature: string;
  slot: number;
  tx_index: number;
  signer: string;
  validator: string;
  block_time: Date;
  pool_address: string;
  source: string | null;
  added: boolean;
  removed: boolean;
  token_mints: string[];
  stableValueDelta: number;
  priority_fee: number | null;
  parsedLiquiditySignal: "add" | "remove" | "unknown";
}

interface DetectionMetrics {
  candidateRows: number;
  parsedTransactions: number;
  parsedSwaps: number;
  rawSlotTxs: number;
  detectedAttacks: number;
  sandwichCandidates: number;
  arbitrageCandidates: number;
  jitCandidates: number;
  liquidationCandidates: number;
  liquiditySnipeCandidates: number;
  liquidityDrainCandidates: number;
  suspiciousCandidates: number;
  backrunCandidates: number;
}

interface LiveStatus {
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
  recentMetrics: DetectionMetrics;
  recentAttackPreview: Array<{
    attack_type: AttackType;
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
}

interface FlowSegmentRecord {
  segment: string;
  description: string;
  attack_count: number;
  flow_share: number;
  avg_confidence: number;
  avg_profit_usd: number;
  toxicity_probability: number;
}

interface SourceAttributionRecord {
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

interface SavingsProofRecord {
  route_key: string | null;
  selected_label: string | null;
  protected_notional_usd: number;
  estimated_loss_prevented_usd: number;
  monthly_savings_projection_usd: number;
  estimated_bps_saved: number;
  counterfactual_route_key: string | null;
  counterfactual_label: string | null;
  confidence: ApiRouteEvaluation["confidence_band"];
  trades_per_day_assumption: number;
  proof_points: string[];
}

interface ProtectedSendPolicyRecord {
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

interface CustomerImpactRecord {
  buyer: "wallet" | "router" | "lp" | "lending" | "trading-desk";
  saves: string;
  primary_metric: string;
}

interface PreventionGuardRecord {
  action: "allow" | "monitor" | "penalize" | "reroute" | "block";
  reason_codes: string[];
  expected_loss_at_risk_bps: number;
  expected_loss_at_risk_usd: number;
  recommended_max_notional_usd: number;
  selected_route_key: string | null;
  selected_label: string | null;
  safer_alternatives: ApiRouteEvaluation["safer_alternatives"];
  savings_proof: SavingsProofRecord;
  protected_send_policy: ProtectedSendPolicyRecord;
  customer_impact: CustomerImpactRecord[];
  warning: string;
}

interface SavingsSummaryRecord {
  estimated_loss_avoided_usd_24h: number;
  estimated_bps_saved_avg: number;
  routes_flagged: number;
  pools_protected: number;
  users_protected_proxy: number;
}

interface LiquidationFirewallRecord {
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

interface ToxicFlowCandleRecord {
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
  event_type: AttackType | null;
}

interface ToxicFlowOverlayRecord {
  timestamp: string;
  event_type: AttackType;
  severity: "critical" | "high" | "medium";
  label: string;
  loss_usd: number;
  confidence: number;
}

interface ToxicFlowSurfaceRecord {
  route_key: string;
  label: string;
  protocol: string | null;
  pair: string;
  action: ApiRouteRisk["policy_action"];
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
  candles: ToxicFlowCandleRecord[];
  overlays: ToxicFlowOverlayRecord[];
}

interface ToxicFlowTerminalRecord {
  generated_at: string;
  source: "fallback" | "chain";
  interval: "1m" | "5m" | "15m" | "1h";
  summary: {
    surfaces_tracked: number;
    routes_in_block: number;
    estimated_loss_at_risk_24h_usd: number;
    estimated_prevented_loss_24h_usd: number;
    highest_toxicity_route: string | null;
    safest_route: string | null;
  };
  surfaces: ToxicFlowSurfaceRecord[];
}

const MAX_ATTACKS = 500;
const MAX_SWAP_HISTORY = 2000;
const MAX_LIQUIDITY_HISTORY = 2000;
const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const PARSE_BATCH_SIZE = 100;
const MAX_PARSE_CANDIDATES_PER_SLOT = 240;
const STABLE_AND_MAJOR_MINTS = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);
const MATERIAL_THRESHOLDS: Record<
  AttackType,
  { minProfitUsd: number; minVictimLossUsd: number; requireKnownPool: boolean; minConfidence: number }
> = {
  sandwich: { minProfitUsd: 8, minVictimLossUsd: 15, requireKnownPool: true, minConfidence: 0.84 },
  arbitrage: { minProfitUsd: 25, minVictimLossUsd: 0, requireKnownPool: false, minConfidence: 0.82 },
  jit: { minProfitUsd: 4, minVictimLossUsd: 4, requireKnownPool: false, minConfidence: 0.76 },
  liquidation: { minProfitUsd: 10, minVictimLossUsd: 0, requireKnownPool: false, minConfidence: 0.74 },
  backrun: { minProfitUsd: 12, minVictimLossUsd: 25, requireKnownPool: false, minConfidence: 0.78 },
  liquidity_snipe: { minProfitUsd: 0, minVictimLossUsd: 0, requireKnownPool: false, minConfidence: 0.8 },
  liquidity_drain: { minProfitUsd: 0, minVictimLossUsd: 0, requireKnownPool: false, minConfidence: 0.8 },
};

function attackScore(attack: Pick<DetectedAttack, "confidence" | "victim_loss_usd" | "profit_usd">) {
  return (
    (attack.confidence ?? 0) * 1000 +
    (attack.victim_loss_usd ?? 0) * 2 +
    (attack.profit_usd ?? 0)
  );
}

const TOKEN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};
const TOKEN_MINTS_BY_SYMBOL = Object.fromEntries(
  Object.entries(TOKEN_SYMBOLS).map(([mint, symbol]) => [symbol, mint]),
) as Record<string, string>;

function tokenLabel(mint?: string | null) {
  if (!mint) return "UNKNOWN";
  return TOKEN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function parseSurface(poolAddress: string) {
  const parseMints = (pair?: string) => pair?.split("->").filter(Boolean) ?? [];
  if (poolAddress.startsWith("route:")) {
    const [, protocol, pair] = poolAddress.split(":");
    const prettyPair = pair?.split("->").map(tokenLabel).join(" / ") ?? "UNKNOWN";
    return {
      route_kind: "route" as const,
      protocol: protocol ?? null,
      label: `${protocol?.toUpperCase() ?? "UNKNOWN"} route • ${prettyPair}`,
      mints: parseMints(pair),
    };
  }

  if (poolAddress.startsWith("venue:")) {
    const [, protocol, pair] = poolAddress.split(":");
    const prettyPair = pair?.split("->").map(tokenLabel).join(" / ") ?? "UNKNOWN";
    return {
      route_kind: "venue" as const,
      protocol: protocol ?? null,
      label: `${protocol?.toUpperCase() ?? "UNKNOWN"} venue • ${prettyPair}`,
      mints: parseMints(pair),
    };
  }

  if (poolAddress.startsWith("pair:")) {
    const [, pair] = poolAddress.split(":");
    const prettyPair = pair?.split("->").map(tokenLabel).join(" / ") ?? "UNKNOWN";
    return {
      route_kind: "pair" as const,
      protocol: null,
      label: `Pair • ${prettyPair}`,
      mints: parseMints(pair),
    };
  }

  return {
    route_kind: "pool" as const,
    protocol: null,
    label: poolAddress,
    mints: [] as string[],
  };
}

function normalizeProtocol(value?: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || null;
}

function normalizeSurfaceLabel(value?: string | null) {
  return normalizeProtocol(value);
}

function normalizeMint(value?: string | null) {
  if (!value) return null;
  return TOKEN_MINTS_BY_SYMBOL[value.toUpperCase()] ?? value;
}

function normalizedMints(values?: Array<string | null | undefined> | null) {
  return (values ?? []).map(normalizeMint).filter((value): value is string => !!value);
}

function sameDirectedPair(left: string[], right: string[]) {
  return left.length >= 2 && right.length >= 2 && left[0] === right[0] && left[1] === right[1];
}

function sameTokenPair(left: string[], right: string[]) {
  return sameDirectedPair(left, right) || (left.length >= 2 && right.length >= 2 && left[0] === right[1] && left[1] === right[0]);
}

function routeProtocol(route: ApiRouteRisk, routeSurface: ReturnType<typeof parseSurface>) {
  return normalizeProtocol(route.protocol ?? routeSurface.protocol);
}

function attackMatchesTerminalRoute(
  route: ApiRouteRisk,
  routeSurface: ReturnType<typeof parseSurface>,
  attack: ApiAttack,
) {
  if (attack.pool_address === route.route_key) return true;
  if (attack.pool_address.toLowerCase() === route.route_key.toLowerCase()) return true;

  const attackSurface = parseSurface(attack.pool_address);
  const routeLabel = normalizeSurfaceLabel(route.label ?? routeSurface.label);
  const attackLabel = normalizeSurfaceLabel(attack.surface_label ?? attackSurface.label);
  if (routeLabel && attackLabel && routeLabel === attackLabel) return true;

  const routeMints = normalizedMints(routeSurface.mints);
  const attackMints = normalizedMints(attack.surface_mints?.length ? attack.surface_mints : attackSurface.mints);
  const matchingPair = sameTokenPair(routeMints, attackMints);
  const matchingDirectedPair = sameDirectedPair(routeMints, attackMints);
  const expectedProtocol = routeProtocol(route, routeSurface);
  const actualProtocol = normalizeProtocol(attack.protocol ?? attackSurface.protocol);
  const labelProtocol = normalizeProtocol(attack.surface_label);
  const matchingProtocol =
    !!expectedProtocol &&
    (!!actualProtocol
      ? expectedProtocol === actualProtocol
      : !!labelProtocol?.includes(expectedProtocol));

  if (matchingPair && (matchingProtocol || attack.surface_precision === "pair-inferred" || routeSurface.route_kind === "pair")) {
    return true;
  }

  return matchingDirectedPair && !expectedProtocol && !actualProtocol;
}

function swapMatchesTerminalRoute(
  route: ApiRouteRisk,
  routeSurface: ReturnType<typeof parseSurface>,
  swap: ParsedSwapCandidate,
) {
  if (swap.pool_address === route.route_key) return true;

  const swapSurface = parseSurface(swap.pool_address ?? "pool:unknown");
  const routeMints = normalizedMints(routeSurface.mints);
  const swapMints = normalizedMints(
    swapSurface.mints.length >= 2 ? swapSurface.mints : [swap.input_mint, swap.output_mint],
  );
  const matchingPair = sameTokenPair(routeMints, swapMints);
  const expectedProtocol = routeProtocol(route, routeSurface);
  const actualProtocol = normalizeProtocol(swap.source ?? swapSurface.protocol);

  return matchingPair && (!!expectedProtocol ? actualProtocol === expectedProtocol : true);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function seedFromString(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function terminalWindowConfig(interval: ToxicFlowTerminalRecord["interval"]) {
  if (interval === "1h") return { windowMs: 60 * 60 * 1000, bucketCount: 120 };
  if (interval === "15m") return { windowMs: 15 * 60 * 1000, bucketCount: 90 };
  if (interval === "5m") return { windowMs: 5 * 60 * 1000, bucketCount: 60 };
  return { windowMs: 60 * 1000, bucketCount: 60 };
}

function terminalBucketMs(interval: ToxicFlowTerminalRecord["interval"]) {
  const { windowMs, bucketCount } = terminalWindowConfig(interval);
  return windowMs / bucketCount;
}

function terminalBucketLabel(timestamp: string, interval: ToxicFlowTerminalRecord["interval"]) {
  const options: Intl.DateTimeFormatOptions =
    interval === "1m" || interval === "5m"
      ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
      : { hour: "2-digit", minute: "2-digit", hour12: false };

  return new Date(timestamp).toLocaleTimeString("en-US", options);
}

function pairLabelForRoute(route: ApiRouteRisk) {
  const surface = parseSurface(route.route_key);
  if (surface.mints.length >= 2) {
    return `${tokenLabel(surface.mints[0])}/${tokenLabel(surface.mints[1])}`;
  }
  return route.protocol?.toUpperCase() ?? "POOL";
}

function basePriceForRoute(route: ApiRouteRisk, index: number) {
  const pair = pairLabelForRoute(route);
  if (pair === "SOL/USDC" || pair === "SOL/USDT") return 142 + index * 1.7;
  if (pair === "USDC/SOL" || pair === "USDT/SOL") return 1 / 142;
  if (pair === "USDC/USDT" || pair === "USDT/USDC") return 1 + index * 0.004;
  return 0.82 + index * 0.19;
}

function terminalActionPreventRate(action: ApiRouteRisk["policy_action"]) {
  if (action === "avoid") return 0.82;
  if (action === "reroute") return 0.68;
  if (action === "penalize") return 0.45;
  if (action === "monitor") return 0.22;
  return 0.08;
}

function buildToxicFlowCandles(
  route: ApiRouteRisk,
  routeIndex: number,
  relatedAttacks: ApiAttack[],
  relatedSwaps: ParsedSwapCandidate[],
  interval: ToxicFlowTerminalRecord["interval"],
  anchorTimeMs = Date.now(),
): ToxicFlowCandleRecord[] {
  const { windowMs, bucketCount } = terminalWindowConfig(interval);
  const bucketMs = windowMs / bucketCount;
  let close = basePriceForRoute(route, routeIndex);
  const windowStart = anchorTimeMs - windowMs;

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = windowStart + index * bucketMs;
    const bucketEnd = bucketStart + bucketMs;
    const timestamp = new Date(bucketStart).toISOString();
    const bucketSwaps = relatedSwaps.filter((swap) => {
      const time = swap.block_time.getTime();
      return time >= bucketStart && time < bucketEnd;
    });
    const bucketAttacks = relatedAttacks.filter((attack) => {
      const time = new Date(attack.block_time).getTime();
      return time >= bucketStart && time < bucketEnd;
    });
    const rawDetectedValueUsd = bucketAttacks.reduce(
      (sum, attack) => sum + (attack.victim_loss_usd ?? attack.profit_usd ?? 0),
      0,
    );
    const liveVolumeUsd = bucketSwaps.reduce(
      (sum, swap) => sum + (swap.notional_usd ?? swap.input_usd ?? swap.output_usd ?? 0),
      0,
    );
    const routeMarkoutBps = clamp(
      Math.max(route.markout_30s_bps, route.estimated_savings_bps, route.lvr_proxy_score * 0.04, 0),
      0.25,
      250,
    );
    const valueBasisUsd = liveVolumeUsd > 0
      ? liveVolumeUsd
      : rawDetectedValueUsd > 0
        ? Math.min(rawDetectedValueUsd, route.recommended_max_notional_usd)
        : 0;
    const cappedValueAtRiskUsd = valueBasisUsd > 0 ? (valueBasisUsd * routeMarkoutBps) / 10_000 : 0;
    const lossAtRiskUsd = bucketAttacks.length > 0
      ? round(Math.min(rawDetectedValueUsd || cappedValueAtRiskUsd, cappedValueAtRiskUsd || rawDetectedValueUsd), 2)
      : 0;
    const observedLossBps = liveVolumeUsd > 0 && lossAtRiskUsd > 0
      ? (lossAtRiskUsd / liveVolumeUsd) * 10_000
      : 0;
    const avgConfidence = bucketAttacks.length > 0
      ? bucketAttacks.reduce((sum, attack) => sum + attack.confidence, 0) / bucketAttacks.length
      : 0;
    const countPressure = clamp(bucketAttacks.length * 6, 0, 30);
    const valuePressure = valueBasisUsd > 0 ? clamp((lossAtRiskUsd / valueBasisUsd) * 1_000, 0, 25) : 0;
    const toxicScore = bucketAttacks.length > 0
      ? round(clamp(avgConfidence * 65 + countPressure + valuePressure, 0, 100), 2)
      : 0;
    const markoutBps = round(clamp(observedLossBps, 0, 250), 2);
    const lvrBps = bucketAttacks.length > 0
      ? round(clamp(route.lvr_proxy_score * 0.05 + markoutBps * 0.42, 0, 36), 2)
      : 0;
    const volumeUsd = liveVolumeUsd > 0 ? round(liveVolumeUsd, 0) : 0;
    const preventedLossUsd = round(lossAtRiskUsd * terminalActionPreventRate(route.policy_action), 2);
    const open = close;
    close = open;
    const spread = Math.max(open * 0.000001, Math.abs(open) * clamp((toxicScore + markoutBps) / 1_000_000, 0, 0.002));
    const eventAttack = bucketAttacks[0] ?? null;

    return {
      timestamp,
      label: terminalBucketLabel(timestamp, interval),
      open: round(open, 6),
      high: round(Math.max(open, close) + spread * 0.58, 6),
      low: round(Math.max(0.000001, Math.min(open, close) - spread * 0.42), 6),
      close,
      volume_usd: volumeUsd,
      toxic_flow_score: toxicScore,
      markout_bps: markoutBps,
      lvr_bps: lvrBps,
      loss_at_risk_usd: lossAtRiskUsd,
      prevented_loss_usd: preventedLossUsd,
      attack_count: bucketAttacks.length,
      event_type: eventAttack?.attack_type ?? null,
    };
  });
}

function buildToxicFlowOverlays(
  route: ApiRouteRisk,
  candles: ToxicFlowCandleRecord[],
  relatedAttacks: ApiAttack[],
): ToxicFlowOverlayRecord[] {
  if (candles.length === 0) return [];
  const firstTime = new Date(candles[0].timestamp).getTime();
  const secondTime = candles[1] ? new Date(candles[1].timestamp).getTime() : firstTime + 1;
  const bucketMs = Math.max(1, secondTime - firstTime);
  const lastTime = new Date(candles[candles.length - 1].timestamp).getTime() + bucketMs;
  const visibleAttacks = relatedAttacks.filter((attack) => {
    const attackTime = new Date(attack.block_time).getTime();
    return Number.isFinite(attackTime) && attackTime >= firstTime && attackTime < lastTime;
  });

  return visibleAttacks.slice(0, 5).map((attack) => {
    const attackTime = new Date(attack.block_time).getTime();
    const candle = candles.reduce((nearest, candidate) => {
      const nearestDistance = Math.abs(new Date(nearest.timestamp).getTime() - attackTime);
      const candidateDistance = Math.abs(new Date(candidate.timestamp).getTime() - attackTime);
      return candidateDistance < nearestDistance ? candidate : nearest;
    }, candles[0]);
    const lossUsd = round(attack.victim_loss_usd ?? attack.profit_usd ?? route.estimated_savings_usd, 2);
    const severity =
      attack.attack_type === "sandwich" && lossUsd >= 100
        ? "critical"
        : attack.confidence >= 0.86 || lossUsd >= 400
          ? "high"
          : "medium";

    return {
      timestamp: candle.timestamp,
      event_type: attack.attack_type,
      severity,
      label: `${attack.attack_type.replace(/_/g, " ")} on ${pairLabelForRoute(route)}`,
      loss_usd: lossUsd,
      confidence: round(attack.confidence * 100),
    };
  });
}

function buildToxicFlowSurface(
  route: ApiRouteRisk,
  routeIndex: number,
  sourceAttacks: ApiAttack[],
  sourceSwaps: ParsedSwapCandidate[],
  interval: ToxicFlowTerminalRecord["interval"],
): ToxicFlowSurfaceRecord {
  const routeSurface = parseSurface(route.route_key);
  const relatedAttacks = sourceAttacks
    .filter((attack) => attackMatchesTerminalRoute(route, routeSurface, attack))
    .sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime());
  const relatedSwaps = sourceSwaps.filter((swap) => swapMatchesTerminalRoute(route, routeSurface, swap));
  const { windowMs } = terminalWindowConfig(interval);
  const bucketMs = terminalBucketMs(interval);
  const now = Date.now();
  const latestAttackTime = relatedAttacks.reduce((latest, attack) => {
    const time = new Date(attack.block_time).getTime();
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
  const latestSwapTime = relatedSwaps.reduce((latest, swap) => {
    const time = swap.block_time.getTime();
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
  const latestRouteActivity = Math.max(latestAttackTime, latestSwapTime);
  const anchorTimeMs =
    latestRouteActivity > 0 && latestRouteActivity < now - windowMs
      ? latestRouteActivity + bucketMs
      : now;
  const windowStart = anchorTimeMs - windowMs;
  const windowEnd = anchorTimeMs;
  const windowAttacks = relatedAttacks.filter((attack) => {
    const time = new Date(attack.block_time).getTime();
    return Number.isFinite(time) && time >= windowStart && time <= windowEnd;
  });
  const windowSwaps = relatedSwaps.filter((swap) => {
    const time = swap.block_time.getTime();
    return Number.isFinite(time) && time >= windowStart && time <= windowEnd;
  });
  const candles = buildToxicFlowCandles(route, routeIndex, windowAttacks, windowSwaps, interval, anchorTimeMs);
  const firstClose = candles[0]?.close ?? 0;
  const lastClose = candles[candles.length - 1]?.close ?? firstClose;
  const volume24h = candles.reduce((sum, candle) => sum + candle.volume_usd, 0);
  const lossAtRisk24h = candles.reduce((sum, candle) => sum + candle.loss_at_risk_usd, 0);
  const preventedLoss24h = candles.reduce((sum, candle) => sum + candle.prevented_loss_usd, 0);

  return {
    route_key: route.route_key,
    label: route.label,
    protocol: route.protocol,
    pair: pairLabelForRoute(route),
    action: route.policy_action,
    risk_score: route.risk_score,
    execution_quality_score: route.execution_quality_score,
    toxic_flow_score: route.toxicity_probability,
    price_change_pct: firstClose > 0 ? round(((lastClose - firstClose) / firstClose) * 100, 2) : 0,
    markout_30s_bps: route.markout_30s_bps,
    volume_24h_usd: round(volume24h, 0),
    loss_at_risk_24h_usd: round(lossAtRisk24h, 2),
    prevented_loss_24h_usd: round(preventedLoss24h, 2),
    liquidity_stress: round(clamp(route.lvr_proxy_score * 0.62 + route.stale_quote_pickup_rate * 0.24 + route.bundle_share * 0.18, 3, 99)),
    quote_freshness_ms: route.quote_freshness_ms,
    reason_codes: route.reason_codes,
    candles,
    overlays: buildToxicFlowOverlays(route, candles, windowAttacks),
  };
}

function terminalSurfaceEventCount(surface: ToxicFlowSurfaceRecord) {
  return surface.candles.reduce((sum, candle) => sum + candle.attack_count, 0);
}

function terminalSurfaceObservedValue(surface: ToxicFlowSurfaceRecord) {
  return surface.candles.reduce((sum, candle) => sum + candle.loss_at_risk_usd, 0);
}

function inferSourceLabel(attack: ApiAttack) {
  const surface = parseSurface(attack.pool_address);
  const validator = attack.validator.toLowerCase();

  if (attack.attack_type === "liquidation") {
    return { key: "protocol-liquidation", label: "protocol liquidation flow", category: "liquidation" as const };
  }
  if (attack.attack_type === "liquidity_snipe") {
    return { key: "launch-sniper", label: "launch sniper flow", category: "searcher" as const };
  }
  if (attack.attack_type === "liquidity_drain") {
    return { key: "liquidity-drain", label: "liquidity drain flow", category: "searcher" as const };
  }
  if (validator.includes("jito") || (attack.tip_lamports ?? 0) >= 120_000) {
    return { key: "bundle-lane", label: "bundle lane flow", category: "bundle-lane" as const };
  }
  if (surface.route_kind === "route") {
    return { key: "aggregator-routed", label: "aggregator routed flow", category: "aggregator" as const };
  }
  if ((attack.entity_risk ?? 0) >= 0.72 || attack.attack_type === "arbitrage" || attack.attack_type === "backrun") {
    return { key: "searcher-bot", label: "searcher / bot flow", category: "searcher" as const };
  }
  return { key: "wallet-originated", label: "wallet-originated flow", category: "wallet" as const };
}

function classifyFlowSegment(attack: ApiAttack) {
  if (attack.attack_type === "sandwich") {
    return {
      segment: "informed-toxic",
      description: "Flow likely to reprice a stale quote before the venue adapts.",
    };
  }
  if (attack.attack_type === "arbitrage" || attack.attack_type === "backrun") {
    return {
      segment: "latency-arbitrage",
      description: "Latency-sensitive flow harvesting stale quotes and short-lived spreads.",
    };
  }
  if (attack.attack_type === "jit") {
    return {
      segment: "liquidity-opportunistic",
      description: "Opportunistic liquidity insertion or removal around expected toxic flow.",
    };
  }
  if (attack.attack_type === "liquidity_snipe") {
    return {
      segment: "launch-opportunistic",
      description: "Pool-launch timing capture intended to win the first fill window.",
    };
  }
  if (attack.attack_type === "liquidity_drain") {
    return {
      segment: "liquidity-drain",
      description: "Aggressive liquidity withdrawal that can destabilize price and trap holders.",
    };
  }
  if (attack.attack_type === "liquidation") {
    return {
      segment: "liquidation-opportunistic",
      description: "Liquidation-driven flow that can still carry adverse selection pressure.",
    };
  }
  return {
    segment: "benign-retail-like",
    description: "Flow with lower signs of informed toxicity and bundle pressure.",
  };
}

function buildReasonCodes(metrics: {
  sandwichRate?: number;
  bundleShare?: number;
  staleQuotePickupRate?: number;
  markout30?: number;
  lvrProxyScore?: number;
  toxicFlowRate?: number;
}) {
  const reasons: string[] = [];
  if ((metrics.sandwichRate ?? 0) >= 0.28) reasons.push("high_sandwich_concentration");
  if ((metrics.bundleShare ?? 0) >= 58) reasons.push("bundle_lane_pressure");
  if ((metrics.staleQuotePickupRate ?? 0) >= 42) reasons.push("stale_quote_pickups");
  if ((metrics.markout30 ?? 0) >= 8) reasons.push("markout_deterioration");
  if ((metrics.lvrProxyScore ?? 0) >= 56) reasons.push("lp_adverse_selection");
  if ((metrics.toxicFlowRate ?? 0) >= 62) reasons.push("toxic_flow_dominance");
  return reasons.length > 0 ? reasons : ["monitor_surface"];
}

function buildDecomposition(parts: Array<{ label: string; value: number }>) {
  return parts.map((entry) => ({ ...entry, value: round(entry.value, 1) }));
}

function surfacePrecision(poolAddress: string): ApiAttack["surface_precision"] {
  if (poolAddress.startsWith("route:")) return "route-inferred";
  if (poolAddress.startsWith("venue:")) return "venue-inferred";
  if (poolAddress.startsWith("pair:")) return "pair-inferred";
  return "exact-pool";
}

interface EntityGroupContext {
  entityByWallet: Map<string, { id: string; label: string; wallets: string[] }>;
  groups: Array<{ id: string; label: string; wallets: string[] }>;
}

type AttackQuality = NonNullable<ApiAttack["attack_quality"]>;

class LiveChainService {
  private connection: Connection | null = null;
  private heliusKey: string | null = null;
  private heliusRpcUrl: string | null = null;
  private started = false;
  private syncing = false;
  private latestChainSlot: number | null = null;
  private lastProcessedSlot: number | null = null;
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private attacksDetected = 0;
  private blocksProcessed = 0;
  private nextId = 1;
  private attacks: ApiAttack[] = [];
  private attackKeys = new Set<string>();
  private attackIndexByKey = new Map<string, number>();
  private pollTimer: NodeJS.Timeout | null = null;
  private externalStreamActive = false;
  private recentSwaps: ParsedSwapCandidate[] = [];
  private recentLiquidityLegs: LiquidityLegCandidate[] = [];
  private recentSlotTxs: TxFlow[] = [];
  private lastSnapshotPersistAt = 0;
  private recentMetrics: DetectionMetrics = {
    candidateRows: 0,
    parsedTransactions: 0,
    parsedSwaps: 0,
    rawSlotTxs: 0,
    detectedAttacks: 0,
    sandwichCandidates: 0,
    arbitrageCandidates: 0,
    jitCandidates: 0,
    liquidationCandidates: 0,
    liquiditySnipeCandidates: 0,
    liquidityDrainCandidates: 0,
    suspiciousCandidates: 0,
    backrunCandidates: 0,
  };

  private ensureHeliusConfig() {
    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (!rpcUrl) {
      if (!this.lastError) {
        this.lastError = "HELIUS_RPC_URL is not configured";
      }
      return false;
    }

    this.heliusRpcUrl = rpcUrl;
    this.heliusKey = this.extractApiKey(rpcUrl);
    return true;
  }

  start() {
    if (this.started) return;
    this.started = true;

    const hasHeliusConfig = this.ensureHeliusConfig();
    if (!hasHeliusConfig || !this.heliusRpcUrl) {
      console.warn("[chain] Helius disabled: HELIUS_RPC_URL missing");
      return;
    }

    this.connection = new Connection(this.heliusRpcUrl, {
      commitment: "confirmed",
      wsEndpoint: this.heliusRpcUrl.replace("https", "wss"),
    });

    console.log("[chain] live ingestion started");
    this.scheduleNextSync(0);
  }

  private extractApiKey(rpcUrl: string): string | null {
    try {
      const url = new URL(rpcUrl);
      return url.searchParams.get("api-key");
    } catch {
      return null;
    }
  }

  private scheduleNextSync(delayMs: number) {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.sync().catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        console.error("[chain] sync failed", error);
        this.scheduleNextSync(4000);
      });
    }, delayMs);
  }

  private async sync() {
    if (!this.connection || this.syncing) return;
    this.syncing = true;

    try {
      this.latestChainSlot = await this.connection.getSlot("confirmed");
      if (this.lastProcessedSlot === null) {
        this.lastProcessedSlot = Math.max(0, this.latestChainSlot - 20);
      }

      const maxCatchup = this.latestChainSlot - this.lastProcessedSlot > 800 ? 16 : 8;
      const targetSlot = Math.min(this.latestChainSlot, this.lastProcessedSlot + maxCatchup);

      for (let slot = this.lastProcessedSlot + 1; slot <= targetSlot; slot++) {
        await this.processSlot(slot);
        this.lastProcessedSlot = slot;
      }

      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
      void this.persistSnapshot();
      this.scheduleNextSync(900);
    } finally {
      this.syncing = false;
    }
  }

  private async processSlot(slot: number) {
    if (!this.connection) return;

    let block: any;
    try {
      block = await this.connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        rewards: true,
        transactionDetails: "full",
      });
    } catch (error) {
      console.warn(`[chain] skipped slot ${slot}`, error instanceof Error ? error.message : error);
      return;
    }

    await this.processBlock(slot, block);
  }

  async ingestExternalBlocks(blocks: any[]) {
    if (!Array.isArray(blocks) || blocks.length === 0) return;

    this.ensureHeliusConfig();
    this.started = true;
    this.externalStreamActive = true;
    this.syncing = false;

    for (const block of blocks) {
      const slot =
        block?.slot ??
        block?.blockNumber ??
        block?.block_number ??
        block?.parentSlot + 1;

      if (typeof slot !== "number" || Number.isNaN(slot)) continue;

      this.latestChainSlot = Math.max(this.latestChainSlot ?? 0, slot);
      await this.processBlock(slot, block);
      this.lastProcessedSlot = slot;
    }

    this.lastSyncAt = new Date().toISOString();
    this.lastError = null;
  }

  private keyToAddress(value: any): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value.pubkey === "string") return value.pubkey;
    return value.toBase58?.() ?? null;
  }

  private transactionAccountKeys(tx: any): any[] {
    const message: any = tx.transaction.message;
    if (!("compiledInstructions" in message)) return message.accountKeys ?? [];

    return [
      ...(message.staticAccountKeys ?? []),
      ...(tx.meta?.loadedAddresses?.writable ?? []),
      ...(tx.meta?.loadedAddresses?.readonly ?? []),
    ];
  }

  private transactionInstructions(tx: any): any[] {
    const message: any = tx.transaction.message;
    const topLevel = "compiledInstructions" in message
      ? message.compiledInstructions ?? []
      : message.instructions ?? [];
    const inner = (tx.meta?.innerInstructions ?? []).flatMap((entry: any) => entry.instructions ?? []);
    return [...topLevel, ...inner];
  }

  private transactionTopLevelInstructions(tx: any): any[] {
    const message: any = tx.transaction.message;
    return "compiledInstructions" in message
      ? message.compiledInstructions ?? []
      : message.instructions ?? [];
  }

  private textHasLiquidationSignal(text: string) {
    return (
      text.includes("liquidat") ||
      text.includes("lendingaccountliquidate") ||
      text.includes("liquidateobligation") ||
      text.includes("repay_obligation_liquidity") ||
      text.includes("liquidate_perp") ||
      text.includes("liquidate_borrow") ||
      text.includes("liquidateperp") ||
      text.includes("liquidateborrow") ||
      text.includes("bankruptcy") ||
      text.includes("bankrupt") ||
      text.includes("deleverage") ||
      text.includes("margin_call") ||
      text.includes("margin call")
    );
  }

  private textHasLiquiditySignal(text: string) {
    return (
      text.includes("add_liquidity") ||
      text.includes("add liquidity") ||
      text.includes("increase_liquidity") ||
      text.includes("increase liquidity") ||
      text.includes("deposit liquidity") ||
      text.includes("remove_liquidity") ||
      text.includes("remove liquidity") ||
      text.includes("decrease_liquidity") ||
      text.includes("decrease liquidity") ||
      text.includes("withdraw_liquidity") ||
      text.includes("withdraw liquidity") ||
      text.includes("close_position") ||
      text.includes("close position") ||
      text.includes("collect_fees") ||
      text.includes("collect fees")
    );
  }

  private instructionProgramId(ix: any, accountKeys: any[]): string | null {
    if (typeof ix?.programId === "string") return ix.programId;
    if (typeof ix?.programIdIndex === "number") {
      return this.keyToAddress(accountKeys[ix.programIdIndex]);
    }
    return null;
  }

  private async processBlock(slot: number, block: any) {
    if (!block?.transactions?.length) return;

    const leaderIdentity =
      block.rewards?.find((reward: any) => reward.rewardType === "Fee")?.pubkey ?? "unknown";
    const blockTime = new Date((block.blockTime ?? Math.floor(Date.now() / 1000)) * 1000);
    const priceMap = await this.fetchPrices([
      "So11111111111111111111111111111111111111112",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    ]);
    const flows = await extractTokenFlows(block, slot, priceMap);
    const flowsByTx = new Map<string, TxFlow["flows"]>();
    for (const flow of flows) {
      if (!flowsByTx.has(flow.tx_sig)) flowsByTx.set(flow.tx_sig, []);
      flowsByTx.get(flow.tx_sig)!.push(flow);
    }

    const txRows = block.transactions
      .map((tx: any, index: number) => {
        if (!tx.meta || tx.meta.err !== null) return null;
        const signature = tx.transaction.signatures[0];
        const accountKeys = this.transactionAccountKeys(tx);
        const signer = this.keyToAddress(accountKeys?.[0]);
        if (!signature || !signer) return null;

        const instructions = this.transactionInstructions(tx);
        const touchedPrograms = new Set<string>();
        for (const ix of instructions ?? []) {
          const programId = this.instructionProgramId(ix, accountKeys);
          if (programId) touchedPrograms.add(programId);
        }

        const hasDexProgram = [...touchedPrograms].some((programId) => isDex(programId));
        const hasLendingProgram = [...touchedPrograms].some((programId) => isLending(programId));
        const programLabels = [...touchedPrograms]
          .map((programId) => getProgramLabel(programId))
          .filter((value): value is string => Boolean(value));
        const logText = (tx.meta?.logMessages ?? []).join("\n").toLowerCase();
        const searchText = `${programLabels.join(" ")} ${logText}`.toLowerCase();
        const liquidationSignal = this.textHasLiquidationSignal(searchText);
        const liquiditySignal = this.textHasLiquiditySignal(searchText);
        const tokenBalanceChanges =
          (tx.meta.preTokenBalances?.length ?? 0) + (tx.meta.postTokenBalances?.length ?? 0);
        const priorityFee = this.extractPriorityFee(tx);
        const flowSummary = flowsByTx.get(signature) ?? [];
        const hasDexFlow = flowSummary.some((flow) => flow.program_id && isDex(flow.program_id));
        const hasLendingFlow = flowSummary.some((flow) => flow.program_id && isLending(flow.program_id));
        const stableFlowCount = flowSummary.filter(
          (flow) => flow.wallet === signer && flow.delta_usd !== null && STABLE_AND_MAJOR_MINTS.has(flow.mint),
        ).length;
        const routedPoolCount = new Set(flowSummary.map((flow) => flow.pool_address).filter(Boolean)).size;
        const hasSwapLikeFlow =
          flowSummary.some((flow) => flow.wallet === signer && flow.delta_raw < 0n) &&
          flowSummary.some((flow) => flow.wallet === signer && flow.delta_raw > 0n) &&
          stableFlowCount >= 1;

        return {
          signature,
          tx_index: index,
          signer,
          priority_fee: priorityFee,
          hasDexProgram: hasDexProgram || hasDexFlow,
          hasLendingProgram: hasLendingProgram || hasLendingFlow,
          tokenBalanceChanges,
          isHighPriority: (priorityFee ?? 0) >= 8_000,
          hasSwapLikeFlow,
          stableFlowCount,
          routedPoolCount,
          candidateScore:
            ((hasDexProgram || hasDexFlow) ? 5 : 0) +
            ((hasLendingProgram || hasLendingFlow) ? 8 : 0) +
            (liquidationSignal ? 12 : 0) +
            (liquiditySignal ? 6 : 0) +
            (hasSwapLikeFlow ? 4 : 0) +
            Math.min(2, routedPoolCount) +
            Math.min(2, stableFlowCount) +
            (priorityFee && priorityFee > 20_000 ? 2 : priorityFee && priorityFee > 8_000 ? 1 : 0) +
            Math.min(3, Math.floor(tokenBalanceChanges / 2)),
          touchedPrograms: [...touchedPrograms],
          programLabels,
          logText,
          liquidationSignal,
          liquiditySignal,
        };
      })
      .filter(Boolean) as CandidateRow[];

    const parseBudget =
      txRows.length > 1400 ? 160 :
      txRows.length > 1100 ? 192 :
      MAX_PARSE_CANDIDATES_PER_SLOT;

    const candidateRows = txRows
      .filter(
        (row) =>
          row.hasDexProgram ||
          row.hasLendingProgram ||
          row.hasSwapLikeFlow ||
          row.liquidationSignal ||
          row.liquiditySignal ||
          row.stableFlowCount >= 2 ||
          row.routedPoolCount >= 2 ||
          (row.isHighPriority && row.tokenBalanceChanges >= 2) ||
          row.tokenBalanceChanges >= 5,
      )
      .sort(
        (a, b) =>
          b.candidateScore - a.candidateScore ||
          (b.priority_fee ?? 0) - (a.priority_fee ?? 0) ||
          b.tokenBalanceChanges - a.tokenBalanceChanges,
      )
      .slice(0, parseBudget);

    const slotTxs: TxFlow[] = candidateRows.map((row) => ({
      tx_sig: row.signature,
      tx_index: row.tx_index,
      signer: row.signer,
      slot,
      block_time: blockTime,
      validator: leaderIdentity,
      priority_fee: row.priority_fee,
      program_labels: row.programLabels,
      log_text: row.logText,
      flows: flowsByTx.get(row.signature) ?? [],
    }));
    this.recentSlotTxs.unshift(...slotTxs);
    if (this.recentSlotTxs.length > 5000) {
      this.recentSlotTxs.length = 5000;
    }

    const parsedBySig = await this.fetchParsedTransactions(candidateRows.map((row) => row.signature));
    const parsedSwaps = this.extractParsedSwaps(
      candidateRows,
      parsedBySig,
      slot,
      blockTime,
      leaderIdentity,
      flowsByTx,
      priceMap,
    );
    const liquidityLegs = this.extractLiquidityLegs(slotTxs, parsedBySig);

    const rawSandwiches = await detectSandwiches(slotTxs, slot);
    const wideRawSandwiches = await detectWideSandwiches(this.recentSlotTxs, slot);
    const rawArbs = await detectArbitrage(slotTxs, slot);
    const rawJits = await detectJIT(slotTxs, slot);
    const parsedSandwiches = this.detectParsedSandwiches(parsedSwaps);
    const parsedArbs = this.detectParsedArbitrage(parsedSwaps, flowsByTx, blockTime, leaderIdentity, slot);
    const parsedJits = this.detectLiquidityJIT(liquidityLegs);
    const parsedLiquidations = this.detectParsedLiquidations(
      candidateRows,
      parsedBySig,
      flowsByTx,
      blockTime,
      leaderIdentity,
      slot,
    );
    const launchSnipes = this.detectLaunchSnipes(
      candidateRows,
      parsedBySig,
      parsedSwaps,
      blockTime,
      leaderIdentity,
      slot,
    );
    const liquidityDrains = this.detectLiquidityDrains(
      liquidityLegs,
      parsedBySig,
      parsedSwaps,
      blockTime,
      leaderIdentity,
      slot,
    );
    const parsedBackruns = this.detectParsedBackruns(
      parsedSwaps,
      flowsByTx,
      blockTime,
      leaderIdentity,
      slot,
    );
    const suspiciousOrderflow = this.detectSuspiciousOrderflow(parsedSwaps, slot, blockTime, leaderIdentity);

    this.recentMetrics = {
      candidateRows: candidateRows.length,
      parsedTransactions: parsedBySig.size,
      parsedSwaps: parsedSwaps.length,
      rawSlotTxs: txRows.length,
      detectedAttacks: 0,
      sandwichCandidates: parsedSandwiches.length,
      arbitrageCandidates: parsedArbs.length,
      jitCandidates: rawJits.length + parsedJits.length,
      liquidationCandidates: parsedLiquidations.length,
      liquiditySnipeCandidates: launchSnipes.length,
      liquidityDrainCandidates: liquidityDrains.length,
      suspiciousCandidates: suspiciousOrderflow.length,
      backrunCandidates: parsedBackruns.length,
    };

    const detected = this.filterDetectedAttacks([
      ...rawSandwiches,
      ...wideRawSandwiches,
      ...rawArbs,
      ...rawJits,
      ...parsedSandwiches,
      ...parsedArbs,
      ...parsedJits,
      ...parsedLiquidations,
      ...launchSnipes,
      ...liquidityDrains,
      ...parsedBackruns,
    ]);
    this.recentMetrics.detectedAttacks = detected.length;

    this.blocksProcessed += 1;

    if (detected.length === 0) {
      console.log(
        `[chain] slot ${slot}: totalTx=${txRows.length} candidates=${slotTxs.length} parsedSwaps=${parsedSwaps.length} attacks=0`,
      );
      return;
    }

    for (const attack of detected) {
      this.insertAttack(attack);
    }

    this.attacksDetected += detected.length;
    console.log(
      `[chain] slot ${slot}: totalTx=${txRows.length} candidates=${slotTxs.length} parsedSwaps=${parsedSwaps.length} detected=${detected.length}`,
    );
  }

  private extractPriorityFee(tx: any): number | null {
    const accountKeys = this.transactionAccountKeys(tx);
    const instructions = this.transactionTopLevelInstructions(tx);

    let cuLimit: number | null = null;
    let cuPriceMicroLamports: number | null = null;

    for (const ix of instructions ?? []) {
      const programId = this.instructionProgramId(ix, accountKeys);
      if (programId !== COMPUTE_BUDGET_PROGRAM) continue;

      const rawData = ix.data;
      const data = Buffer.from(rawData, "base64");
      const tag = data[0];
      if (tag === 2 && data.length >= 5) {
        cuLimit = data.readUInt32LE(1);
      }
      if (tag === 3 && data.length >= 9) {
        cuPriceMicroLamports = Number(data.readBigUInt64LE(1));
      }
    }

    if (!cuLimit || !cuPriceMicroLamports) return null;
    return Math.floor((cuLimit * cuPriceMicroLamports) / 1_000_000);
  }

  private async fetchParsedTransactions(signatures: string[]): Promise<Map<string, HeliusEnhancedTx>> {
    const parsed = new Map<string, HeliusEnhancedTx>();
    if (!this.heliusKey || signatures.length === 0) return parsed;

    for (let i = 0; i < signatures.length; i += PARSE_BATCH_SIZE) {
      const batch = signatures.slice(i, i + PARSE_BATCH_SIZE);

      try {
        const response = await fetch(
          `https://api-mainnet.helius-rpc.com/v0/transactions?api-key=${this.heliusKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: batch }),
          },
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Helius parse failed with ${response.status}: ${body.slice(0, 200)}`);
        }

        const payload = (await response.json()) as HeliusEnhancedTx[];
        for (const item of payload) {
          if (item.signature) parsed.set(item.signature, item);
        }
      } catch (error) {
        console.warn(
          `[chain] parsed tx fetch failed for batch ${i / PARSE_BATCH_SIZE + 1}`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return parsed;
  }

  private extractParsedSwaps(
    txRows: CandidateRow[],
    parsedBySig: Map<string, HeliusEnhancedTx>,
    slot: number,
    blockTime: Date,
    validator: string,
    flowsByTx: Map<string, TxFlow["flows"]>,
    priceMap: Map<string, number>,
  ): ParsedSwapCandidate[] {
    const swaps: ParsedSwapCandidate[] = [];

    for (const row of txRows) {
      const parsed = parsedBySig.get(row.signature);
      const swap = parsed?.events?.swap;
      const tokenInputs =
        swap?.tokenInputs ?? swap?.innerSwaps?.flatMap((inner) => inner.tokenInputs ?? []) ?? [];
      const tokenOutputs =
        swap?.tokenOutputs ?? swap?.innerSwaps?.flatMap((inner) => inner.tokenOutputs ?? []) ?? [];

      const flows = flowsByTx.get(row.signature) ?? [];
      const flowPoolAddress = flows.find((flow) => flow.pool_address)?.pool_address ?? null;
      const programId = flows.find((flow) => flow.program_id)?.program_id ?? null;

      const swapFromFlows = !swap ? this.inferSwapFromFlows(flows, row.signer, priceMap, parsed) : null;
      const input = tokenInputs[0];
      const output = tokenOutputs[0];
      const inputAmount = this.readTokenAmount(input) ?? swapFromFlows?.input_amount ?? null;
      const outputAmount = this.readTokenAmount(output) ?? swapFromFlows?.output_amount ?? null;
      const inputMint = input?.mint ?? input?.tokenAddress ?? swapFromFlows?.input_mint ?? null;
      const outputMint = output?.mint ?? output?.tokenAddress ?? swapFromFlows?.output_mint ?? null;
      if (!inputMint || !outputMint || inputMint === outputMint) continue;
      const inputUsd =
        inputAmount && inputMint && priceMap.has(inputMint)
          ? Number((inputAmount * (priceMap.get(inputMint) ?? 0)).toFixed(2))
          : swapFromFlows?.input_usd ?? null;
      const outputUsd =
        outputAmount && outputMint && priceMap.has(outputMint)
          ? Number((outputAmount * (priceMap.get(outputMint) ?? 0)).toFixed(2))
          : swapFromFlows?.output_usd ?? null;
      const notionalUsd = Math.max(inputUsd ?? 0, outputUsd ?? 0) || null;
      const signerStableDeltaUsd = this.computeSignerStableDelta(flows, row.signer);
      const source = this.inferSourceFromFlows(flows, parsed);
      const poolAddress = this.normalizePoolAddress(flowPoolAddress, source, inputMint, outputMint, programId);
      const parsedType = (parsed?.type ?? "").toUpperCase();
      const parsedDescription = (parsed?.description ?? "").toLowerCase();
      const swapLikeMetadata =
        !!swap ||
        parsedType.includes("SWAP") ||
        parsedDescription.includes(" swap") ||
        parsedDescription.startsWith("swap") ||
        !!swapFromFlows;
      if (!swapLikeMetadata) continue;

      swaps.push({
        signature: row.signature,
        slot,
        tx_index: row.tx_index,
        signer: row.signer,
        validator,
        block_time: new Date((parsed?.timestamp ?? Math.floor(blockTime.getTime() / 1000)) * 1000),
        pool_address: poolAddress,
        source,
        input_mint: inputMint,
        output_mint: outputMint,
        input_amount: inputAmount,
        output_amount: outputAmount,
        input_usd: inputUsd,
        output_usd: outputUsd,
        notional_usd: notionalUsd,
        price_impact_hint: this.computePriceImpactHint(inputUsd, outputUsd),
        priority_fee: row.priority_fee,
        signer_stable_delta_usd: signerStableDeltaUsd,
      });
    }

    this.recentSwaps.unshift(...swaps);
    if (this.recentSwaps.length > MAX_SWAP_HISTORY) {
      this.recentSwaps.length = MAX_SWAP_HISTORY;
    }

    return swaps;
  }

  private inferSwapFromFlows(
    flows: TxFlow["flows"],
    signer: string,
    priceMap: Map<string, number>,
    parsed?: HeliusEnhancedTx,
  ) {
    const signerFlows = flows.filter((flow) => flow.wallet === signer);
    const negative = signerFlows
      .filter((flow) => flow.delta_raw < 0n)
      .sort((a, b) => Math.abs(b.delta_usd ?? 0) - Math.abs(a.delta_usd ?? 0));
    const positive = signerFlows
      .filter((flow) => flow.delta_raw > 0n)
      .sort((a, b) => Math.abs(b.delta_usd ?? 0) - Math.abs(a.delta_usd ?? 0));

    const input = negative.find((flow) => flow.mint && (flow.delta_usd !== null || priceMap.has(flow.mint)));
    const output = positive.find((flow) => flow.mint && (flow.delta_usd !== null || priceMap.has(flow.mint)));
    if (!input || !output) return null;
    if (input.mint === output.mint) return null;

    const inputUsd = input.delta_usd !== null ? Math.abs(Number(input.delta_usd.toFixed(2))) : null;
    const outputUsd = output.delta_usd !== null ? Number(output.delta_usd.toFixed(2)) : null;
    const isSwapLikeDescription = (parsed?.description ?? "").toLowerCase();
    const isDexLikeSource = parsed?.source && ["JUPITER", "RAYDIUM", "ORCA", "METEORA", "PHOENIX"].includes(parsed.source.toUpperCase());
    const touchesDexFlow = flows.some((flow) => flow.program_id && isDex(flow.program_id));
    if (!touchesDexFlow && !isDexLikeSource && !isSwapLikeDescription.includes("swap")) return null;

    const inputPrice = priceMap.get(input.mint) ?? null;
    const outputPrice = priceMap.get(output.mint) ?? null;
    const inputAmount =
      inputUsd !== null && inputPrice && inputPrice > 0 ? Number((inputUsd / inputPrice).toFixed(6)) : null;
    const outputAmount =
      outputUsd !== null && outputPrice && outputPrice > 0 ? Number((outputUsd / outputPrice).toFixed(6)) : null;

    return {
      input_mint: input.mint,
      output_mint: output.mint,
      input_amount: inputAmount,
      output_amount: outputAmount,
      input_usd: inputUsd,
      output_usd: outputUsd,
    };
  }

  private inferSourceFromFlows(
    flows: TxFlow["flows"],
    parsed?: HeliusEnhancedTx,
  ) {
    if (parsed?.source) return parsed.source;

    const programLabels = flows
      .map((flow) => getProgramLabel(flow.program_id))
      .filter((value): value is string => Boolean(value));

    return programLabels[0] ?? null;
  }

  private extractLiquidityLegs(
    slotTxs: TxFlow[],
    parsedBySig: Map<string, HeliusEnhancedTx>,
  ): LiquidityLegCandidate[] {
    const legs: LiquidityLegCandidate[] = [];

    for (const tx of slotTxs) {
      const parsed = parsedBySig.get(tx.tx_sig);
      const parsedType = (parsed?.type ?? "").toUpperCase();
      const parsedDescription = `${parsed?.description ?? ""}\n${tx.log_text ?? ""}`.toLowerCase();
      const inferredSource = this.inferSourceFromFlows(tx.flows, parsed);
      const parsedAddLiquidity =
        (parsedType.includes("ADD") && parsedType.includes("LIQUID")) ||
        parsedType.includes("ADD_LIQUIDITY") ||
        parsedType.includes("INCREASE_LIQUIDITY") ||
        parsedType.includes("ADD_TO_POOL") ||
        parsedType.includes("BOOTSTRAP_LIQUIDITY") ||
        parsedType.includes("ADD_IMBALANCE_LIQUIDITY") ||
        parsedType.includes("OPEN_POSITION_WITH_METADATA") ||
        parsedDescription.includes("add liquidity") ||
        parsedDescription.includes("increase liquidity") ||
        parsedDescription.includes("instruction: increaseliquidity") ||
        parsedDescription.includes("instruction: increase liquidity") ||
        parsedDescription.includes("deposit liquidity");
      const parsedRemoveLiquidity =
        (parsedType.includes("REMOVE") && parsedType.includes("LIQUID")) ||
        parsedType.includes("REMOVE_FROM_POOL") ||
        parsedType.includes("DECREASE_LIQUIDITY") ||
        parsedType.includes("CLOSE_POSITION") ||
        (parsedType.includes("WITHDRAW") && parsedType.includes("LIQUID")) ||
        parsedType.includes("WITHDRAW_LIQUIDITY") ||
        parsedDescription.includes("remove liquidity") ||
        parsedDescription.includes("decrease liquidity") ||
        parsedDescription.includes("instruction: decreaseliquidity") ||
        parsedDescription.includes("instruction: decrease liquidity") ||
        parsedDescription.includes("withdraw liquidity") ||
        parsedDescription.includes("close position");
      const signerFlows = tx.flows.filter((flow) => flow.wallet === tx.signer);
      const fallbackInputMint = signerFlows.find((flow) => flow.delta_raw < 0n)?.mint ?? null;
      const fallbackOutputMint = signerFlows.find((flow) => flow.delta_raw > 0n)?.mint ?? null;
      const fallbackProgram = tx.flows.find((flow) => flow.program_id)?.program_id ?? null;
      const fallbackPoolAddress = this.normalizePoolAddress(
        null,
        inferredSource,
        fallbackInputMint,
        fallbackOutputMint,
        fallbackProgram,
      );
      const byPool = new Map<
        string,
        {
          negativeMints: Set<string>;
          positiveMints: Set<string>;
          stableValueDelta: number;
        }
      >();

      for (const flow of signerFlows) {
        const poolAddress =
          flow.pool_address ||
          (parsedAddLiquidity || parsedRemoveLiquidity || tx.program_labels?.some((label) => label.includes("whirlpool") || label.includes("meteora") || label.includes("raydium"))
            ? fallbackPoolAddress
            : null);
        if (!poolAddress || poolAddress === "unknown") continue;

        if (!byPool.has(poolAddress)) {
          byPool.set(poolAddress, {
            negativeMints: new Set<string>(),
            positiveMints: new Set<string>(),
            stableValueDelta: 0,
          });
        }

        const summary = byPool.get(poolAddress)!;
        if (flow.delta_raw < 0n) summary.negativeMints.add(flow.mint);
        if (flow.delta_raw > 0n) summary.positiveMints.add(flow.mint);
        if (
          flow.delta_usd !== null &&
          [
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
          ].includes(flow.mint)
        ) {
          summary.stableValueDelta += flow.delta_usd ?? 0;
        }
      }

      for (const [poolAddress, summary] of byPool) {
        const added =
          summary.negativeMints.size >= 2 ||
          (parsedAddLiquidity && summary.negativeMints.size >= 1);
        const removed =
          summary.positiveMints.size >= 2 ||
          (parsedRemoveLiquidity && summary.positiveMints.size >= 1);
        if (!added && !removed) continue;

        legs.push({
          signature: tx.tx_sig,
          slot: tx.slot,
          tx_index: tx.tx_index,
          signer: tx.signer,
          validator: tx.validator,
          block_time: tx.block_time,
          pool_address: poolAddress,
          source: inferredSource,
          added,
          removed,
          token_mints: [...new Set([...summary.negativeMints, ...summary.positiveMints])],
          stableValueDelta: Number(summary.stableValueDelta.toFixed(2)),
          priority_fee: tx.priority_fee,
          parsedLiquiditySignal: parsedAddLiquidity ? "add" : parsedRemoveLiquidity ? "remove" : "unknown",
        });
      }
    }

    this.recentLiquidityLegs.unshift(...legs);
    if (this.recentLiquidityLegs.length > MAX_LIQUIDITY_HISTORY) {
      this.recentLiquidityLegs.length = MAX_LIQUIDITY_HISTORY;
    }

    return legs;
  }

  private readTokenAmount(token?: HeliusSwapTokenAmount): number | null {
    if (!token) return null;
    const rawAmount = token.rawTokenAmount?.tokenAmount;
    const decimals = token.rawTokenAmount?.decimals ?? 0;
    if (!rawAmount) return null;
    return Number(rawAmount) / Math.pow(10, decimals);
  }

  private computePriceImpactHint(inputUsd: number | null, outputUsd: number | null): number | null {
    if (!inputUsd || !outputUsd || inputUsd <= 0 || outputUsd <= 0) return null;
    const ratio = outputUsd / inputUsd;
    return Number(Math.abs(1 - ratio).toFixed(4));
  }

  private normalizePoolAddress(
    poolAddress: string | null | undefined,
    source?: string | null,
    inputMint?: string | null,
    outputMint?: string | null,
    programId?: string | null,
  ) {
    const programLabel = getProgramLabel(programId);
    const normalizedSource = source?.toLowerCase() ?? null;
    const exactPoolAvailable = !!poolAddress && poolAddress !== "unknown";
    const sourceIsAggregator =
      normalizedSource?.includes("jupiter") || normalizedSource?.includes("router") || false;
    const programIsAggregator =
      programLabel === "jupiter_v4" || programLabel === "jupiter_v6" || programLabel === "raydium_router";

    if (exactPoolAvailable && programLabel && !programIsAggregator && !sourceIsAggregator) {
      return poolAddress!;
    }

    if (source) {
      const routeMints = [inputMint, outputMint].filter(Boolean).join("->") || "unknown-route";
      return `route:${source.toLowerCase()}:${routeMints}`;
    }
    if (programLabel) {
      if (exactPoolAvailable && !programIsAggregator) return poolAddress!;
      const routeMints = [inputMint, outputMint].filter(Boolean).join("->");
      return routeMints ? `venue:${programLabel}:${routeMints}` : `venue:${programLabel}`;
    }
    if (poolAddress && poolAddress !== "unknown") return poolAddress;
    if (inputMint || outputMint) {
      const pair = [inputMint, outputMint].filter(Boolean).join("->");
      if (pair) return `pair:${pair}`;
    }
    return "unknown";
  }

  private computeSignerStableDelta(flows: TxFlow["flows"], signer: string) {
    return Number(
      flows
        .filter(
          (flow) =>
            flow.wallet === signer &&
            flow.delta_usd !== null &&
            STABLE_AND_MAJOR_MINTS.has(flow.mint),
        )
        .reduce((sum, flow) => sum + (flow.delta_usd ?? 0), 0)
        .toFixed(2),
    );
  }

  private passesMaterialThreshold(attack: DetectedAttack) {
    const thresholds = MATERIAL_THRESHOLDS[attack.attack_type];
    if (!thresholds) return false;
    if (attack.confidence < thresholds.minConfidence) return false;
    if (
      thresholds.requireKnownPool &&
      (!attack.pool_address || attack.pool_address === "unknown")
    ) {
      return false;
    }

    const profit = attack.profit_usd ?? 0;
    const victimLoss = attack.victim_loss_usd ?? 0;
    if (attack.attack_type === "jit") {
      const hasFullBracket = !!attack.frontrun_tx && !!attack.backrun_tx;
      const hasVictim = !!attack.victim_wallet;
      const parsedEvidence = attack.detector.includes("jit") || attack.detector.includes("liquidity");
      if (hasFullBracket && hasVictim && attack.confidence >= 0.8) {
        return true;
      }
      if (parsedEvidence && hasFullBracket && attack.confidence >= 0.82 && (profit >= 4 || victimLoss >= 4)) {
        return true;
      }
    }
    if (attack.attack_type === "liquidation") {
      const parsedEvidence = attack.detector.includes("parsed_liquidation");
      const hasVictim = !!attack.victim_wallet;
      if (parsedEvidence && hasVictim && attack.confidence >= 0.78) {
        return true;
      }
      const poolKey = attack.pool_address.toLowerCase();
      const knownLendingSurface =
        poolKey.includes("kamino") ||
        poolKey.includes("marginfi") ||
        poolKey.includes("solend") ||
        poolKey.includes("drift") ||
        poolKey.includes("save");
      if (parsedEvidence && knownLendingSurface && attack.confidence >= 0.8 && profit >= 5) {
        return true;
      }
      if (parsedEvidence && attack.confidence >= 0.84 && profit >= 12) {
        return true;
      }
    }
    if (attack.attack_type === "liquidity_snipe") {
      const sameSlotLike = !!attack.frontrun_tx && !!attack.victim_tx;
      if (sameSlotLike && attack.confidence >= 0.82) return true;
    }
    if (attack.attack_type === "liquidity_drain") {
      const parsedEvidence = attack.detector.includes("liquidity_drain");
      if (parsedEvidence && attack.confidence >= 0.82) return true;
    }
    return profit >= thresholds.minProfitUsd || victimLoss >= thresholds.minVictimLossUsd;
  }

  private filterDetectedAttacks(attacks: DetectedAttack[]) {
    const filtered = attacks.filter((attack) => this.passesMaterialThreshold(attack));
    const bestByFamily = new Map<string, DetectedAttack>();

    for (const attack of filtered) {
      const familyKey = this.attackFamilyKey(attack);
      const existing = bestByFamily.get(familyKey);
      if (!existing || attackScore(attack) > attackScore(existing)) {
        bestByFamily.set(familyKey, attack);
      }
    }

    return [...bestByFamily.values()];
  }

  private attackFamilyKey(attack: Pick<
    DetectedAttack,
    "attack_type" | "slot" | "attacker_wallet" | "pool_address" | "frontrun_tx" | "victim_tx" | "backrun_tx" | "detector"
  >) {
    if (attack.attack_type === "sandwich" || attack.attack_type === "jit") {
      return [
        attack.attack_type,
        attack.attacker_wallet,
        attack.pool_address,
        attack.frontrun_tx ?? "no-front",
        attack.backrun_tx ?? "no-back",
      ].join(":");
    }

    if (attack.attack_type === "liquidity_snipe") {
      return [
        attack.attack_type,
        attack.attacker_wallet,
        attack.pool_address,
        attack.frontrun_tx ?? "no-create",
        attack.victim_tx ?? "no-buy",
      ].join(":");
    }

    if (attack.attack_type === "arbitrage") {
      return [
        attack.attack_type,
        attack.attacker_wallet,
        attack.pool_address,
        attack.backrun_tx ?? attack.victim_tx ?? `slot-${attack.slot}`,
      ].join(":");
    }

    return [
      attack.attack_type,
      attack.attacker_wallet,
      attack.pool_address,
      attack.victim_tx ?? attack.backrun_tx ?? `slot-${attack.slot}`,
      attack.detector ?? "unknown-detector",
    ].join(":");
  }

  private entityIdFromWallets(wallets: string[]) {
    const seed = wallets.slice().sort().join("|");
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return `entity_${hash.toString(16).padStart(8, "0")}`;
  }

  private canonicalEntitySurface(poolAddress: string | null | undefined) {
    if (!poolAddress || poolAddress === "unknown") return "unknown";

    if (poolAddress.startsWith("route:") || poolAddress.startsWith("venue:")) {
      const [, protocol, pair] = poolAddress.split(":");
      return [protocol, pair].filter(Boolean).join(":") || poolAddress;
    }

    return poolAddress;
  }

  private sanitizeMoney(value: number | null | undefined, minimum = 1) {
    if (value == null || !Number.isFinite(value)) return null;
    const rounded = Number(value.toFixed(2));
    return Math.abs(rounded) >= minimum ? rounded : null;
  }

  private inferAttackQuality(attack: DetectedAttack): AttackQuality {
    const profit = attack.profit_usd ?? 0;
    const victimLoss = attack.victim_loss_usd ?? 0;
    const strongDetector =
      attack.detector.includes("parsed") ||
      attack.detector.includes("liquidation") ||
      attack.detector.includes("wide");
    const hasFullBracket =
      !!attack.frontrun_tx &&
      !!attack.backrun_tx &&
      (attack.attack_type === "sandwich" || attack.attack_type === "jit");
    const hasKnownVenue = !!attack.pool_address && attack.pool_address !== "unknown";
    const hasVictim = !!attack.victim_wallet;

    if (attack.attack_type === "sandwich") {
      if (
        attack.confidence >= 0.9 &&
        hasKnownVenue &&
        hasFullBracket &&
        (strongDetector || victimLoss >= 50) &&
        (profit >= 25 || victimLoss >= 75)
      ) {
        return "confirmed";
      }
      return "likely";
    }

    if (attack.attack_type === "jit") {
      if (
        attack.confidence >= 0.88 &&
        hasKnownVenue &&
        hasFullBracket &&
        hasVictim &&
        (profit >= 25 || victimLoss >= 50)
      ) {
        return "confirmed";
      }
      return "likely";
    }

    if (attack.attack_type === "liquidity_snipe") {
      if (attack.confidence >= 0.88 && !!attack.frontrun_tx && !!attack.victim_tx) {
        return "confirmed";
      }
      return "likely";
    }

    if (attack.attack_type === "liquidity_drain") {
      if (attack.confidence >= 0.88 && !!attack.frontrun_tx && ((attack.profit_usd ?? 0) >= 25 || !!attack.backrun_tx)) {
        return "confirmed";
      }
      return "likely";
    }

    if (attack.attack_type === "arbitrage") {
      if (attack.confidence >= 0.9 && hasKnownVenue && profit >= 50) {
        return "confirmed";
      }
      return "likely";
    }

    if (attack.attack_type === "liquidation") {
      if (attack.confidence >= 0.86 && hasKnownVenue && hasVictim && profit >= 25) {
        return "confirmed";
      }
      return "likely";
    }

    return "likely";
  }

  private buildEntityContext(attacks = this.attacks): EntityGroupContext {
    const wallets = [...new Set(attacks.map((attack) => attack.attacker_wallet))];
    const parent = new Map<string, string>();

    const find = (wallet: string): string => {
      const current = parent.get(wallet) ?? wallet;
      if (current === wallet) {
        parent.set(wallet, wallet);
        return wallet;
      }
      const root = find(current);
      parent.set(wallet, root);
      return root;
    };

    const union = (a: string, b: string) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootB, rootA);
    };

    for (const wallet of wallets) parent.set(wallet, wallet);

    const profileByWallet = new Map<
      string,
      { pools: Set<string>; validators: Set<string>; strategies: Set<string>; tokens: Set<string>; attacks: ApiAttack[] }
    >();

    for (const attack of attacks) {
      if (!profileByWallet.has(attack.attacker_wallet)) {
        profileByWallet.set(attack.attacker_wallet, {
          pools: new Set(),
          validators: new Set(),
          strategies: new Set(),
          tokens: new Set(),
          attacks: [],
        });
      }
      const profile = profileByWallet.get(attack.attacker_wallet)!;
      if (attack.pool_address && attack.pool_address !== "unknown") {
        profile.pools.add(this.canonicalEntitySurface(attack.pool_address));
      }
      if (attack.validator) profile.validators.add(attack.validator);
      if (attack.attack_type) profile.strategies.add(attack.attack_type);
      if (attack.token_mint) profile.tokens.add(attack.token_mint);
      profile.attacks.push(attack);
    }

    for (let i = 0; i < wallets.length; i++) {
      for (let j = i + 1; j < wallets.length; j++) {
        const a = wallets[i];
        const b = wallets[j];
        const profileA = profileByWallet.get(a);
        const profileB = profileByWallet.get(b);
        if (!profileA || !profileB) continue;

        const sharedPools = [...profileA.pools].filter((pool) => profileB.pools.has(pool)).length;
        const sharedValidators = [...profileA.validators].filter((validator) => profileB.validators.has(validator)).length;
        const sharedStrategies = [...profileA.strategies].filter((strategy) => profileB.strategies.has(strategy)).length;
        const sharedTokens = [...profileA.tokens].filter((token) => profileB.tokens.has(token)).length;
        const coordinatedWindows = profileA.attacks.filter((attackA) =>
          profileB.attacks.some(
            (attackB) =>
              attackA.attack_type === attackB.attack_type &&
              this.canonicalEntitySurface(attackA.pool_address) === this.canonicalEntitySurface(attackB.pool_address) &&
              Math.abs(attackA.slot - attackB.slot) <= 8,
          ),
        ).length;

        const score =
          sharedPools * 2 +
          sharedValidators * 1.5 +
          sharedStrategies * 1.5 +
          sharedTokens +
          coordinatedWindows * 2;

        const strongCoordination =
          (sharedPools >= 1 && coordinatedWindows >= 2) ||
          (sharedValidators >= 2 && sharedStrategies >= 2 && sharedTokens >= 1 && coordinatedWindows >= 1);

        if (score >= 5 || strongCoordination) union(a, b);
      }
    }

    const grouped = new Map<string, string[]>();
    for (const wallet of wallets) {
      const root = find(wallet);
      if (!grouped.has(root)) grouped.set(root, []);
      grouped.get(root)!.push(wallet);
    }

    const groups = [...grouped.values()]
      .map((memberWallets) => {
        const sortedWallets = memberWallets.slice().sort();
        const labelSeed = sortedWallets[0]?.slice(0, 6).toUpperCase() ?? "MEV";
        return {
          id: this.entityIdFromWallets(sortedWallets),
          label: `ENT-${labelSeed}`,
          wallets: sortedWallets,
        };
      })
      .sort((a, b) => b.wallets.length - a.wallets.length || a.id.localeCompare(b.id));

    const entityByWallet = new Map<string, { id: string; label: string; wallets: string[] }>();
    for (const group of groups) {
      for (const wallet of group.wallets) {
        entityByWallet.set(wallet, group);
      }
    }

    return { entityByWallet, groups };
  }

  private detectParsedSandwiches(swaps: ParsedSwapCandidate[]): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    for (const victim of swaps) {
      if (!victim.input_mint || !victim.output_mint) continue;

      const sharesVenue = (candidate: ParsedSwapCandidate) =>
        (victim.pool_address &&
          candidate.pool_address &&
          candidate.pool_address === victim.pool_address) ||
        (!!victim.source && !!candidate.source && candidate.source === victim.source);

      const beforeCandidates = this.recentSwaps
        .filter(
          (candidate) =>
            candidate.signature !== victim.signature &&
            sharesVenue(candidate) &&
            candidate.signer !== victim.signer &&
            candidate.slot >= victim.slot - 8 &&
            (candidate.slot < victim.slot ||
              (candidate.slot === victim.slot && candidate.tx_index < victim.tx_index)),
        )
        .sort((a, b) =>
          (b.priority_fee ?? 0) - (a.priority_fee ?? 0) ||
          new Date(b.block_time).getTime() - new Date(a.block_time).getTime(),
        );

      const before = beforeCandidates.find(
        (candidate) =>
          (candidate.input_mint === victim.input_mint &&
            candidate.output_mint === victim.output_mint) ||
          candidate.output_mint === victim.input_mint ||
          candidate.input_mint === victim.output_mint,
      );

      if (!before) continue;

      const afterCandidates = this.recentSwaps
        .filter(
          (candidate) =>
            candidate.signature !== victim.signature &&
            candidate.signer === before.signer &&
            sharesVenue(candidate) &&
            candidate.slot <= victim.slot + 8 &&
            (candidate.slot > victim.slot ||
              (candidate.slot === victim.slot && candidate.tx_index > victim.tx_index)),
        )
        .sort((a, b) =>
          new Date(a.block_time).getTime() - new Date(b.block_time).getTime(),
        );

      const after = afterCandidates.find(
        (candidate) =>
          candidate.input_mint === before.output_mint ||
          candidate.output_mint === before.input_mint ||
          (candidate.input_mint === victim.output_mint &&
            candidate.output_mint === victim.input_mint),
      );

      if (!after) continue;

      const priorityFee = Math.max(before.priority_fee ?? 0, after.priority_fee ?? 0);
      const priceImpact = victim.price_impact_hint ?? 0;
      const slotSpan = Math.max(victim.slot - before.slot, after.slot - victim.slot);
      const validatorAligned =
        before.validator === victim.validator && victim.validator === after.validator;
      let confidence =
        priceImpact >= 0.02
          ? 0.92
          : priceImpact >= 0.0075 || priorityFee >= 20_000
            ? 0.86
            : 0;

      if (slotSpan >= 2) confidence += 0.02;
      if (slotSpan >= 4) confidence += 0.01;
      if (validatorAligned) confidence += 0.01;
      confidence = Math.min(0.96, Number(confidence.toFixed(2)));

      if (confidence === 0) continue;
      const detector = slotSpan >= 2 ? "wide_parsed_sandwich" : "parsed_swap_sandwich";

      attacks.push({
        attack_type: "sandwich",
        slot: victim.slot,
        block_time: victim.block_time,
        validator: victim.validator,
        attacker_wallet: before.signer,
        victim_wallet: victim.signer,
        pool_address: this.normalizePoolAddress(
          victim.pool_address ?? before.pool_address ?? after.pool_address,
          victim.source ?? before.source ?? after.source,
          victim.input_mint,
          victim.output_mint,
        ),
        token_mint: victim.output_mint,
        profit_usd: this.estimateParsedProfit(before, after),
        victim_loss_usd: priceImpact > 0 && victim.notional_usd ? Number((priceImpact * victim.notional_usd).toFixed(2)) : null,
        frontrun_tx: before.signature,
        victim_tx: victim.signature,
        backrun_tx: after.signature,
        tip_lamports: priorityFee,
        confidence,
        detector,
        evidence: [
          victim.pool_address
            ? "parsed swap route bracketed victim in same pool"
            : "parsed swap route bracketed victim in same venue window",
          "same attacker wallet reappeared after victim in a narrow slot window",
          slotSpan >= 2
            ? `wide bracket spanned ${slotSpan + 1} slot(s)`
            : "tight bracket occurred inside one slot window",
          validatorAligned
            ? "all attack legs shared the same leader context"
            : "legs remained venue-consistent across the bracket window",
          priceImpact >= 0.02
            ? "victim price-impact hint exceeded 2%"
            : priorityFee >= 20_000
              ? "attacker legs carried elevated priority fees"
              : "victim swap showed measurable adverse execution",
        ],
      });
    }

    return attacks;
  }

  private estimateParsedProfit(front: ParsedSwapCandidate, back: ParsedSwapCandidate): number | null {
    const gross = front.signer_stable_delta_usd + back.signer_stable_delta_usd;
    if (gross <= 0) return null;
    return Number(gross.toFixed(2));
  }

  private detectParsedArbitrage(
    swaps: ParsedSwapCandidate[],
    flowsByTx: Map<string, TxFlow["flows"]>,
    blockTime: Date,
    validator: string,
    slot: number,
  ): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];
    const grouped = new Map<string, ParsedSwapCandidate[]>();

    for (const swap of swaps) {
      if (!grouped.has(swap.signer)) grouped.set(swap.signer, []);
      grouped.get(swap.signer)!.push(swap);
    }

    for (const [signer, signerSwaps] of grouped) {
      const candidateWindow = this.recentSwaps.filter(
        (swap) =>
          swap.signer === signer &&
          swap.slot >= slot - 2 &&
          swap.slot <= slot,
      );
      const candidatePools = new Set(candidateWindow.map((swap) => swap.pool_address).filter(Boolean));
      const candidateSources = new Set(candidateWindow.map((swap) => swap.source).filter(Boolean));
      if (candidateWindow.length < 2 || candidatePools.size < 2) continue;

      const stableNetGain = candidateWindow.reduce((sum, swap) => {
        const flows = flowsByTx.get(swap.signature) ?? [];
        return sum + this.computeSignerStableDelta(flows, signer);
      }, 0);

      const feeAggression = Math.max(...candidateWindow.map((swap) => swap.priority_fee ?? 0));
      const inventoryBalanced = candidateWindow.every((swap) => {
        const flows = flowsByTx.get(swap.signature) ?? [];
        const residualByMint = new Map<string, number>();

        for (const flow of flows) {
          if (flow.wallet !== signer || flow.delta_usd === null) continue;
          if (STABLE_AND_MAJOR_MINTS.has(flow.mint)) continue;
          residualByMint.set(flow.mint, (residualByMint.get(flow.mint) ?? 0) + flow.delta_usd);
        }

        const significantResiduals = [...residualByMint.values()].filter((value) => Math.abs(value) >= 15);
        return significantResiduals.length <= 1;
      });

      const confidence =
        stableNetGain >= 75
          ? 0.92
          : stableNetGain >= 30 && inventoryBalanced && candidateSources.size >= 2
            ? 0.88
            : 0;
      if (confidence === 0) continue;

      attacks.push({
        attack_type: "arbitrage",
        slot,
        block_time: blockTime,
        validator,
        attacker_wallet: signer,
        victim_wallet: null,
        pool_address: this.normalizePoolAddress(
          candidateWindow[0].pool_address,
          candidateWindow[0].source,
          candidateWindow[0].input_mint,
          candidateWindow[0].output_mint,
        ),
        token_mint: candidateWindow[0].output_mint,
        profit_usd: stableNetGain > 0 ? Number(stableNetGain.toFixed(2)) : null,
        victim_loss_usd: null,
        frontrun_tx: null,
        victim_tx: null,
        backrun_tx: candidateWindow[candidateWindow.length - 1]?.signature ?? candidateWindow[0].signature,
        tip_lamports: feeAggression > 0 ? feeAggression : null,
        confidence,
        detector: "parsed_swap_arbitrage",
        evidence: [
          "same signer touched multiple pools in a narrow slot window",
          "realized stable or major-token gain remained after the route closed",
          inventoryBalanced
            ? "non-stable inventory ended approximately flat across the route window"
            : "inventory shape remained bounded despite multi-pool route activity",
          candidateSources.size >= 2
            ? "multiple venues were involved in the route cycle"
            : "multiple pools were traversed inside one venue family",
          `multi-pool window size ${candidateWindow.length} tx`,
        ],
      });
    }

    return attacks;
  }

  private detectParsedLiquidations(
    txRows: CandidateRow[],
    parsedBySig: Map<string, HeliusEnhancedTx>,
    flowsByTx: Map<string, TxFlow["flows"]>,
    blockTime: Date,
    validator: string,
    slot: number,
  ): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    for (const row of txRows) {
      const parsed = parsedBySig.get(row.signature);
      const type = (parsed?.type ?? "").toUpperCase();
      const source = (parsed?.source ?? "").toUpperCase();
      const sourceOrProgram = source || row.programLabels[0]?.toUpperCase() || "";
      const searchText = [
        type,
        source,
        parsed?.description ?? "",
        row.programLabels.join(" "),
        row.logText,
      ].join("\n").toLowerCase();
      const lendingLabel = row.programLabels.find((label) =>
        ["kamino", "marginfi", "solend", "solend_v2", "drift"].includes(label),
      );
      const looksLikeLiquidation =
        type.includes("LIQUID") ||
        type.includes("LIQUIDATE") ||
        type.includes("LIQUIDATED") ||
        type.includes("FORECLOSE") ||
        type.includes("MARGIN_CALL") ||
        type.includes("REPAY_OBLIGATION_LIQUIDITY") ||
        type.includes("BOT_LIQUIDATE") ||
        this.textHasLiquidationSignal(searchText) ||
        (row.hasLendingProgram && row.liquidationSignal);

      if (!looksLikeLiquidation) continue;

      const flows = flowsByTx.get(row.signature) ?? [];
      const signerFlows = flows.filter((flow) => flow.wallet === row.signer);
      const positiveUsd = signerFlows
        .filter((flow) => flow.delta_raw > 0n && flow.delta_usd !== null)
        .reduce((sum, flow) => sum + (flow.delta_usd ?? 0), 0);
      const negativeUsd = Math.abs(
        signerFlows
          .filter((flow) => flow.delta_raw < 0n && flow.delta_usd !== null)
          .reduce((sum, flow) => sum + (flow.delta_usd ?? 0), 0),
      );
      const netUsd = positiveUsd - negativeUsd;
      const estimatedProfit =
        netUsd >= 1
          ? Number(netUsd.toFixed(2))
          : positiveUsd >= 10
            ? Number((positiveUsd * 0.025).toFixed(2))
            : null;

      const poolAddress = this.normalizePoolAddress(
        flows.find((flow) => flow.pool_address)?.pool_address,
        parsed?.source ?? lendingLabel ?? null,
        flows.find((flow) => flow.wallet === row.signer && flow.delta_raw < 0n)?.mint ?? null,
        flows.find((flow) => flow.wallet === row.signer && flow.delta_raw > 0n)?.mint ?? null,
        flows.find((flow) => flow.program_id)?.program_id ?? null,
      );
      const victimWallet =
        parsed?.tokenTransfers?.find((transfer) => transfer.fromUserAccount && transfer.fromUserAccount !== row.signer)?.fromUserAccount ??
        parsed?.tokenTransfers?.find((transfer) => transfer.toUserAccount && transfer.toUserAccount !== row.signer)?.toUserAccount ??
        parsed?.accountData
          ?.flatMap((account) => account.tokenBalanceChanges ?? [])
          ?.find((change) => change.userAccount && change.userAccount !== row.signer)?.userAccount ??
        flows
          .filter((flow) => flow.wallet !== row.signer && flow.delta_usd !== null && flow.delta_usd < 0)
          .sort((a, b) => Math.abs(b.delta_usd ?? 0) - Math.abs(a.delta_usd ?? 0))[0]?.wallet ??
        null;

      const hasKnownVenue = poolAddress !== "unknown";
      const hasObservedGain = (estimatedProfit ?? 0) >= 1 || positiveUsd >= 10;
      const knownLendingSource =
        ["KAMINO", "MARGINFI", "SOLEND", "SOLEND_V2", "DRIFT", "SAVE"].includes(sourceOrProgram) ||
        Boolean(lendingLabel);
      const hasEconomicMotion = positiveUsd >= 1 || negativeUsd >= 1 || flows.length >= 2;
      if (!hasObservedGain && !victimWallet && !knownLendingSource) continue;
      if (!hasEconomicMotion && !victimWallet && !row.liquidationSignal) continue;

      let confidence = 0.74;
      if (knownLendingSource) confidence += 0.05;
      if (this.textHasLiquidationSignal(searchText)) confidence += 0.06;
      if (victimWallet) confidence += 0.04;
      if (hasObservedGain) confidence += 0.04;
      if (hasKnownVenue) confidence += 0.02;
      if ((row.priority_fee ?? 0) >= 10_000) confidence += 0.02;
      confidence = Number(Math.min(0.93, confidence).toFixed(2));

      attacks.push({
        attack_type: "liquidation",
        slot,
        block_time: new Date((parsed?.timestamp ?? Math.floor(blockTime.getTime() / 1000)) * 1000),
        validator,
        attacker_wallet: row.signer,
        victim_wallet: victimWallet,
        pool_address: poolAddress,
        token_mint: flows.find((flow) => flow.wallet === row.signer && flow.delta_raw > 0n)?.mint ?? null,
        profit_usd: estimatedProfit,
        victim_loss_usd: null,
        frontrun_tx: null,
        victim_tx: row.signature,
        backrun_tx: null,
        tip_lamports: row.priority_fee && row.priority_fee > 0 ? row.priority_fee : null,
        confidence,
        detector: lendingLabel ? `parsed_liquidation_${lendingLabel}` : "parsed_liquidation",
        evidence: [
          knownLendingSource
            ? `known lending / perps program observed: ${(lendingLabel ?? sourceOrProgram).toLowerCase()}`
            : "parsed transaction labeled liquidation-like activity",
          this.textHasLiquidationSignal(searchText)
            ? "instruction logs or parser text contained liquidation / deleverage / bankruptcy signal"
            : "liquidation inferred from lending-program transfer graph",
          hasObservedGain
            ? "positive wallet delta observed on liquidator wallet"
            : "liquidation label observed even though realized gain was not fully measurable",
          victimWallet
            ? "token transfer graph indicates third-party loss flow"
            : "counterparty account was not fully attributable from parsed transfers",
        ],
      });
    }

    return attacks;
  }

  private detectLaunchSnipes(
    txRows: CandidateRow[],
    parsedBySig: Map<string, HeliusEnhancedTx>,
    swaps: ParsedSwapCandidate[],
    blockTime: Date,
    validator: string,
    slot: number,
  ): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    for (const row of txRows) {
      const parsed = parsedBySig.get(row.signature);
      const type = (parsed?.type ?? "").toUpperCase();
      const source = (parsed?.source ?? "").toUpperCase();
      const description = (parsed?.description ?? "").toLowerCase();
      const looksLikePoolCreate =
        type.includes("CREATE_POOL") ||
        type.includes("INITIALIZE_POOL") ||
        type.includes("CREATE_MARKET") ||
        type.includes("INITIALIZE") && description.includes("pool") ||
        type.includes("ADD_LIQUIDITY") ||
        type.includes("BOOTSTRAP_LIQUIDITY") ||
        description.includes("create pool") ||
        description.includes("initialize pool") ||
        description.includes("initial liquidity");
      const onSupportedLaunchSurface =
        ["RAYDIUM", "PUMPFUN", "METEORA", "ORCA"].some((label) => source.includes(label));

      if (!looksLikePoolCreate || !onSupportedLaunchSurface) continue;

      const poolAddress = this.normalizePoolAddress(
        null,
        parsed?.source ?? null,
        null,
        null,
        null,
      );

      const followUpSwaps = swaps
        .filter(
          (swap) =>
            swap.signer &&
            swap.slot >= slot &&
            swap.slot <= slot + 1 &&
            (swap.slot > slot || swap.tx_index > row.tx_index) &&
            (
              (!!swap.source && !!parsed?.source && swap.source === parsed.source) ||
              (!!swap.pool_address && swap.pool_address === poolAddress)
            ),
        )
        .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index);

      const firstSwap = followUpSwaps[0];
      if (!firstSwap) continue;

      const selfSnipe = firstSwap.signer === row.signer;
      let confidence = firstSwap.slot === slot ? 0.86 : 0.82;
      if ((firstSwap.priority_fee ?? 0) >= 10_000) confidence += 0.02;
      if (selfSnipe) confidence += 0.01;
      confidence = Math.min(0.92, Number(confidence.toFixed(2)));

      attacks.push({
        attack_type: "liquidity_snipe",
        slot: firstSwap.slot,
        block_time: new Date((parsed?.timestamp ?? Math.floor(blockTime.getTime() / 1000)) * 1000),
        validator: firstSwap.validator ?? validator,
        attacker_wallet: firstSwap.signer,
        victim_wallet: selfSnipe ? null : row.signer,
        pool_address: firstSwap.pool_address ?? poolAddress,
        token_mint: firstSwap.output_mint ?? firstSwap.input_mint,
        profit_usd: null,
        victim_loss_usd: null,
        frontrun_tx: row.signature,
        victim_tx: firstSwap.signature,
        backrun_tx: null,
        tip_lamports: firstSwap.priority_fee ?? row.priority_fee,
        confidence,
        detector: selfSnipe ? "launch_liquidity_self_snipe" : "launch_liquidity_snipe",
        evidence: [
          "new pool / initial liquidity surface was created on a launch-sensitive venue",
          firstSwap.slot === slot
            ? "first buy landed in the same slot as pool initialization"
            : "first buy landed one slot after pool initialization",
          selfSnipe
            ? "deployer and first buyer were the same wallet"
            : "distinct wallet captured the first post-launch swap",
        ],
      });
    }

    return attacks;
  }

  private detectLiquidityDrains(
    liquidityLegs: LiquidityLegCandidate[],
    parsedBySig: Map<string, HeliusEnhancedTx>,
    swaps: ParsedSwapCandidate[],
    blockTime: Date,
    validator: string,
    slot: number,
  ): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    for (const leg of liquidityLegs.filter((item) => item.removed)) {
      const parsed = parsedBySig.get(leg.signature);
      const type = (parsed?.type ?? "").toUpperCase();
      const description = (parsed?.description ?? "").toLowerCase();
      const isDrainLike =
        leg.parsedLiquiditySignal === "remove" ||
        type.includes("REMOVE_LIQUIDITY") ||
        type.includes("WITHDRAW_LIQUIDITY") ||
        type.includes("CLOSE_POSITION") ||
        description.includes("remove liquidity") ||
        description.includes("withdraw liquidity");
      if (!isDrainLike) continue;

      const dumpSwap = swaps
        .filter(
          (swap) =>
            swap.signer === leg.signer &&
            (
              swap.pool_address === leg.pool_address ||
              (!!swap.source && !!leg.source && swap.source === leg.source)
            ) &&
            swap.slot >= leg.slot &&
            swap.slot <= leg.slot + 5 &&
            (swap.slot > leg.slot || swap.tx_index > leg.tx_index),
        )
        .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index)[0];

      const meaningfulWithdrawal =
        Math.abs(leg.stableValueDelta) >= 25 ||
        leg.token_mints.length >= 2 ||
        !!dumpSwap;
      if (!meaningfulWithdrawal) continue;

      let confidence = dumpSwap ? 0.9 : 0.83;
      if (Math.abs(leg.stableValueDelta) >= 250) confidence += 0.02;
      if (leg.parsedLiquiditySignal === "remove") confidence += 0.02;
      confidence = Math.min(0.94, Number(confidence.toFixed(2)));

      attacks.push({
        attack_type: "liquidity_drain",
        slot: leg.slot,
        block_time: parsed?.timestamp
          ? new Date(parsed.timestamp * 1000)
          : leg.block_time ?? blockTime,
        validator: leg.validator ?? validator,
        attacker_wallet: leg.signer,
        victim_wallet: null,
        pool_address: leg.pool_address,
        token_mint: leg.token_mints[0] ?? null,
        profit_usd: Math.abs(leg.stableValueDelta) > 0 ? Number(Math.abs(leg.stableValueDelta).toFixed(2)) : null,
        victim_loss_usd: null,
        frontrun_tx: leg.signature,
        victim_tx: null,
        backrun_tx: dumpSwap?.signature ?? null,
        tip_lamports: leg.priority_fee,
        confidence,
        detector: dumpSwap ? "liquidity_drain_with_dump" : "liquidity_drain_remove",
        evidence: [
          "large liquidity-removal leg was parsed on a live pool surface",
          dumpSwap
            ? "same signer followed the liquidity removal with a dump-style swap"
            : "liquidity was removed without a passive LP-style dwell window",
          leg.parsedLiquiditySignal === "remove"
            ? "parsed transaction labeling confirmed explicit liquidity removal"
            : "liquidity removal inferred from token-balance deltas",
        ],
      });
    }

    return attacks;
  }

  private detectParsedBackruns(
    swaps: ParsedSwapCandidate[],
    flowsByTx: Map<string, TxFlow["flows"]>,
    blockTime: Date,
    validator: string,
    slot: number,
  ): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    for (const victim of swaps) {
      const victimImpact = victim.price_impact_hint ?? 0;
      const victimNotional = victim.notional_usd ?? Math.max(victim.input_usd ?? 0, victim.output_usd ?? 0, 0);
      const victimIsMaterial = victimImpact >= 0.004 || victimNotional >= 750;
      if (!victimIsMaterial) continue;

      const sharesVenue = (candidate: ParsedSwapCandidate) =>
        (victim.pool_address &&
          candidate.pool_address &&
          candidate.pool_address === victim.pool_address) ||
        (!!victim.source && !!candidate.source && candidate.source === victim.source);

      const afterWindow = this.recentSwaps
        .filter(
          (candidate) =>
            candidate.signature !== victim.signature &&
            candidate.signer !== victim.signer &&
            sharesVenue(candidate) &&
            candidate.slot >= victim.slot &&
            candidate.slot <= victim.slot + 2 &&
            (candidate.slot > victim.slot ||
              (candidate.slot === victim.slot && candidate.tx_index > victim.tx_index)),
        )
        .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index);

      let best: {
        swap: ParsedSwapCandidate;
        profit: number;
        routeCount: number;
        feeSignal: number;
      } | null = null;

      for (const candidate of afterWindow) {
        const sameSignerWindow = this.recentSwaps.filter(
          (item) =>
            item.signer === candidate.signer &&
            item.slot >= victim.slot &&
            item.slot <= candidate.slot + 1,
        );
        const routeCount = new Set(
          sameSignerWindow
            .map((item) => item.pool_address ?? item.source)
            .filter(Boolean),
        ).size;
        const stableGain = sameSignerWindow.reduce((sum, item) => {
          const flows = flowsByTx.get(item.signature) ?? [];
          return sum + this.computeSignerStableDelta(flows, candidate.signer);
        }, 0);
        const feeSignal = Math.max(...sameSignerWindow.map((item) => item.priority_fee ?? 0), 0);
        const candidateProfit = Number(stableGain.toFixed(2));

        if (candidateProfit < 12) continue;
        if (routeCount < 1) continue;

        if (
          !best ||
          candidateProfit > best.profit ||
          (candidateProfit === best.profit && routeCount > best.routeCount)
        ) {
          best = {
            swap: candidate,
            profit: candidateProfit,
            routeCount,
            feeSignal,
          };
        }
      }

      if (!best) continue;

      let confidence = 0.78;
      if (best.profit >= 40) confidence += 0.04;
      if (best.routeCount >= 2) confidence += 0.03;
      if (victimImpact >= 0.01) confidence += 0.03;
      if (best.feeSignal >= 15_000) confidence += 0.02;
      if (best.swap.validator === victim.validator) confidence += 0.02;
      confidence = Math.min(0.92, Number(confidence.toFixed(2)));

      attacks.push({
        attack_type: "backrun",
        slot: victim.slot,
        block_time: victim.block_time ?? blockTime,
        validator: victim.validator ?? validator,
        attacker_wallet: best.swap.signer,
        victim_wallet: victim.signer,
        pool_address: this.normalizePoolAddress(
          victim.pool_address ?? best.swap.pool_address,
          victim.source ?? best.swap.source,
          victim.input_mint,
          victim.output_mint,
        ),
        token_mint: best.swap.output_mint ?? victim.output_mint,
        profit_usd: best.profit,
        victim_loss_usd:
          victimImpact > 0 && victimNotional > 0
            ? Number((victimImpact * victimNotional).toFixed(2))
            : null,
        frontrun_tx: null,
        victim_tx: victim.signature,
        backrun_tx: best.swap.signature,
        tip_lamports: best.feeSignal > 0 ? best.feeSignal : null,
        confidence,
        detector: "parsed_post_swap_backrun",
        evidence: [
          "distinct searcher swapped after a material victim swap in the same venue window",
          best.routeCount >= 2
            ? "searcher route expanded across multiple pools immediately after victim"
            : "searcher captured post-swap opportunity in the same venue window",
          `realized stable or major-token gain ${best.profit.toFixed(2)} USD after victim`,
          best.swap.validator === victim.validator
            ? "victim and backrun aligned under the same validator context"
            : "backrun occurred within a tight post-victim slot window",
        ],
      });
    }

    return attacks;
  }

  private detectLiquidityJIT(currentLegs: LiquidityLegCandidate[]): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    for (const addLeg of currentLegs.filter((leg) => leg.added)) {
      const overlappingTokens = (candidate: LiquidityLegCandidate) =>
        candidate.token_mints.some((mint) => addLeg.token_mints.includes(mint));
      const sharesVenue = (candidate: LiquidityLegCandidate) =>
        candidate.pool_address === addLeg.pool_address ||
        (!!candidate.source && !!addLeg.source && candidate.source === addLeg.source) ||
        overlappingTokens(candidate);

      const removalCandidates = this.recentLiquidityLegs
        .filter(
          (candidate) =>
            candidate.removed &&
            candidate.signature !== addLeg.signature &&
            candidate.signer === addLeg.signer &&
            sharesVenue(candidate) &&
            candidate.slot >= addLeg.slot &&
            candidate.slot <= addLeg.slot + 12 &&
            (candidate.slot > addLeg.slot ||
              (candidate.slot === addLeg.slot && candidate.tx_index > addLeg.tx_index)),
        )
        .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index);

      const removeLeg = removalCandidates.find((candidate) => overlappingTokens(candidate)) ?? removalCandidates[0];
      if (!removeLeg) continue;

      const victimCandidates = this.recentSwaps
        .filter(
          (swap) =>
            (
              swap.pool_address === addLeg.pool_address ||
              (!!swap.source && !!addLeg.source && swap.source === addLeg.source) ||
              swap.input_mint === addLeg.token_mints[0] ||
              swap.output_mint === addLeg.token_mints[0]
            ) &&
            swap.signer !== addLeg.signer &&
            swap.slot >= addLeg.slot &&
            swap.slot <= removeLeg.slot &&
            (swap.slot > addLeg.slot ||
              (swap.slot === addLeg.slot && swap.tx_index > addLeg.tx_index)) &&
            (swap.slot < removeLeg.slot ||
              (swap.slot === removeLeg.slot && swap.tx_index < removeLeg.tx_index)),
        )
        .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index);
      const victim = victimCandidates.find(
        (candidate) =>
          (candidate.price_impact_hint ?? 0) >= 0.003 ||
          (candidate.input_amount ?? 0) >= 25 ||
          (candidate.output_amount ?? 0) >= 25 ||
          (candidate.notional_usd ?? 0) >= 50,
      );
      if (!victim) continue;

      const mintOverlap = addLeg.token_mints.filter((mint) => removeLeg.token_mints.includes(mint)).length;
      if (mintOverlap < 1) continue;

      const priorityFee = Math.max(addLeg.priority_fee ?? 0, removeLeg.priority_fee ?? 0);
      let confidence = 0.76;
      if (addLeg.parsedLiquiditySignal === "add") confidence += 0.03;
      if (removeLeg.parsedLiquiditySignal === "remove") confidence += 0.03;
      if (addLeg.slot === removeLeg.slot) confidence += 0.04;
      if (priorityFee >= 10_000) confidence += 0.03;
      if (victim.price_impact_hint && victim.price_impact_hint >= 0.003) confidence += 0.03;
      if (addLeg.validator === removeLeg.validator) confidence += 0.02;
      if (removeLeg.slot - addLeg.slot <= 3) confidence += 0.03;
      if (addLeg.source && removeLeg.source && addLeg.source === removeLeg.source) confidence += 0.02;
      if ((removeLeg.stableValueDelta > 0) || (addLeg.stableValueDelta + removeLeg.stableValueDelta > 0)) confidence += 0.03;

      if (confidence < 0.76) continue;

      attacks.push({
        attack_type: "jit",
        slot: victim.slot,
        block_time: addLeg.block_time,
        validator: addLeg.validator,
        attacker_wallet: addLeg.signer,
        victim_wallet: victim.signer,
        pool_address: this.normalizePoolAddress(
          addLeg.pool_address,
          addLeg.source ?? removeLeg.source ?? victim.source ?? null,
          victim.input_mint,
          victim.output_mint,
        ),
        token_mint: victim.output_mint ?? victim.input_mint,
        profit_usd:
          removeLeg.stableValueDelta > 0
            ? removeLeg.stableValueDelta
            : addLeg.stableValueDelta + removeLeg.stableValueDelta > 0
              ? Number((addLeg.stableValueDelta + removeLeg.stableValueDelta).toFixed(2))
              : null,
        victim_loss_usd:
          victim.price_impact_hint && victim.notional_usd
            ? Number((victim.price_impact_hint * victim.notional_usd).toFixed(2))
            : null,
        frontrun_tx: addLeg.signature,
        victim_tx: victim.signature,
        backrun_tx: removeLeg.signature,
        tip_lamports: priorityFee > 0 ? priorityFee : null,
        confidence: Number(Math.min(0.93, confidence).toFixed(2)),
        detector: "liquidity_window_jit",
        evidence: [
          "same signer added and removed multi-asset liquidity around a victim swap",
          `liquidity window spanned ${removeLeg.slot - addLeg.slot + 1} slot(s) in same pool`,
          addLeg.parsedLiquiditySignal === "add" || removeLeg.parsedLiquiditySignal === "remove"
            ? "parsed transaction labeling confirmed explicit liquidity entry/exit activity"
            : "liquidity entry and exit inferred from token-balance changes",
          victim.price_impact_hint && victim.price_impact_hint >= 0.003
            ? `victim swap price-impact hint ${(victim.price_impact_hint * 100).toFixed(2)}%`
            : "sized victim swap observed between LP entry and exit legs",
        ],
      });
    }

    return attacks;
  }

  private detectSuspiciousOrderflow(
    swaps: ParsedSwapCandidate[],
    slot: number,
    blockTime: Date,
    validator: string,
  ): DetectedAttack[] {
    const attacks: DetectedAttack[] = [];

    const scored = swaps
      .map((swap) => {
        let score = 0;
        const evidence: string[] = [];
        const signerWindow = this.recentSwaps.filter(
          (candidate) =>
            candidate.signer === swap.signer &&
            candidate.signature !== swap.signature &&
            candidate.slot >= swap.slot - 2 &&
            candidate.slot <= swap.slot &&
            candidate.pool_address !== swap.pool_address,
        );

        if (!swap.pool_address || swap.pool_address === "unknown") {
          return { swap, score: -1, evidence };
        }

        if (swap.priority_fee && swap.priority_fee >= 25_000) {
          score += 2;
          evidence.push("priority fee elevated above typical retail flow");
        }

        if (swap.source && ["JUPITER", "RAYDIUM", "ORCA", "METEORA"].includes(swap.source.toUpperCase())) {
          score += 1;
          evidence.push(`parsed dex source ${swap.source.toLowerCase()}`);
        }

        if (swap.price_impact_hint && swap.price_impact_hint >= 0.015) {
          score += 2;
          evidence.push(`price impact hint ${(swap.price_impact_hint * 100).toFixed(2)}%`);
        }

        if ((swap.input_amount ?? 0) >= 250 || (swap.output_amount ?? 0) >= 250) {
          score += 1;
          evidence.push("notional swap size above heuristic threshold");
        }

        if (signerWindow.length > 0) {
          score += 2;
          evidence.push("same signer routed across multiple pools in a narrow window");
        }

        const routeCount = new Set(
          signerWindow.map((candidate) => candidate.pool_address).filter(Boolean),
        ).size;
        if (routeCount >= 2) {
          score += 1;
          evidence.push("multi-pool routing path observed");
        }

        const majorSwap =
          (swap.input_amount ?? 0) >= 1000 ||
          (swap.output_amount ?? 0) >= 1000;
        const strongPriceImpact = (swap.price_impact_hint ?? 0) >= 0.03;
        const strongFee = (swap.priority_fee ?? 0) >= 25_000;
        const qualifiesCandidate =
          routeCount >= 1 && (strongPriceImpact || strongFee || majorSwap);

        if (!qualifiesCandidate) {
          return { swap, score: -1, evidence };
        }

        return { swap, score, evidence };
      })
      .filter((item) => item.score >= 6)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.swap.priority_fee ?? 0) - (a.swap.priority_fee ?? 0) ||
          (b.swap.price_impact_hint ?? 0) - (a.swap.price_impact_hint ?? 0),
      )
      .slice(0, 2);

    for (const item of scored) {
      const confidence = Math.min(0.76, 0.56 + item.score * 0.03);
      attacks.push({
        attack_type: "backrun",
        slot,
        block_time: item.swap.block_time ?? blockTime,
        validator: item.swap.validator ?? validator,
        attacker_wallet: item.swap.signer,
        victim_wallet: null,
        pool_address: item.swap.pool_address ?? "unknown",
        token_mint: item.swap.output_mint,
        profit_usd: null,
        victim_loss_usd: null,
        frontrun_tx: null,
        victim_tx: item.swap.signature,
        backrun_tx: item.swap.signature,
        tip_lamports: item.swap.priority_fee,
        confidence,
        detector: "suspicious_orderflow_candidate",
        evidence: [...item.evidence, "heuristic candidate only; realized extraction not yet confirmed"],
      });
    }

    return attacks;
  }

  private async fetchPrices(mints: string[]): Promise<Map<string, number>> {
    const fallbackPrices = new Map<string, number>([
      ["So11111111111111111111111111111111111111112", 150],
      ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 1],
      ["Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 1],
    ]);
    if (mints.length === 0) return fallbackPrices;

    try {
      const ids = mints.slice(0, 100).join(",");
      const response = await fetch(`https://api.jup.ag/price/v3?ids=${ids}`);
      const payload: any = await response.json();
      const priceMap = new Map(fallbackPrices);

      for (const [mint, info] of Object.entries(payload ?? {})) {
        const price =
          typeof info === "object" && info !== null
            ? Number((info as any).usdPrice ?? (info as any).price ?? 0)
            : 0;
        if (price > 0) priceMap.set(mint, price);
      }

      return priceMap;
    } catch (error) {
      console.warn("[chain] price fetch failed, using fallback majors", error instanceof Error ? error.message : error);
      return fallbackPrices;
    }
  }

  private insertAttack(attack: DetectedAttack) {
    const key = this.attackFamilyKey(attack);
    const attackQuality = this.inferAttackQuality(attack);
    const campaignId = `camp:${attack.attack_type}:${attack.attacker_wallet}:${attack.pool_address}`;
    const sanitizedProfit = this.sanitizeMoney(attack.profit_usd, 1);
    const sanitizedVictimLoss = this.sanitizeMoney(attack.victim_loss_usd, 1);
    const sanitizedPriorityFee =
      attack.tip_lamports && attack.tip_lamports > 0 ? attack.tip_lamports : null;
    const surface = parseSurface(attack.pool_address);
    const executionLane = this.inferExecutionLane(attack);
    const precision = surfacePrecision(attack.pool_address);
    const detectionBasis = this.inferDetectionBasis(attack);

    const persistedAttack = {
      id: this.nextId++,
      attack_type: attack.attack_type,
      slot: attack.slot,
      block_time: attack.block_time.toISOString(),
      validator: attack.validator,
      attacker_wallet: attack.attacker_wallet,
      entity_id: attack.attacker_wallet,
      entity_label: `ENT-${attack.attacker_wallet.slice(0, 6).toUpperCase()}`,
      entity_risk: this.estimateRisk(attack),
      victim_wallet: attack.victim_wallet,
      victim_loss_usd: sanitizedVictimLoss,
      pool_address: attack.pool_address,
      token_mint: attack.token_mint,
      profit_usd: sanitizedProfit,
      tip_lamports: sanitizedPriorityFee,
      confidence: attack.confidence,
      detector: attack.detector,
      attack_quality: attackQuality,
      campaign_id: campaignId,
      protocol: surface.protocol,
      surface_kind: surface.route_kind,
      surface_precision: precision,
      surface_label: surface.label,
      surface_mints: surface.mints,
      detection_basis: detectionBasis,
      bundle_likelihood: this.estimateBundleLikelihood(attack),
      execution_lane: executionLane,
      evidence: attack.evidence,
      frontrun_tx: attack.frontrun_tx,
      victim_tx: attack.victim_tx,
      backrun_tx: attack.backrun_tx,
    };

    const existingIndex = this.attackIndexByKey.get(key);
    if (existingIndex !== undefined) {
      const existing = this.attacks[existingIndex];
      if (!existing) return;

      const existingScore = attackScore(existing);
      const nextScore = attackScore(persistedAttack);

      if (nextScore > existingScore) {
        this.attacks[existingIndex] = {
          ...persistedAttack,
          id: existing.id,
        };
      }
      return;
    }

    this.attackKeys.add(key);

    this.attacks.unshift(persistedAttack);
    this.attackIndexByKey = new Map(this.attacks.map((item, index) => [this.attackFamilyKey(item), index] as const));
    void this.persistAttack(
      key,
      persistedAttack,
    );

    if (this.attacks.length > MAX_ATTACKS) {
      const removed = this.attacks.splice(MAX_ATTACKS);
      for (const item of removed) {
        const itemKey = this.attackFamilyKey(item);
        this.attackKeys.delete(itemKey);
        this.attackIndexByKey.delete(itemKey);
      }
      this.attackIndexByKey = new Map(this.attacks.map((item, index) => {
        const itemKey = this.attackFamilyKey(item);
        return [itemKey, index] as const;
      }));
    }
  }

  private async persistAttack(attackKey: string, attack: ApiAttack) {
    void attackKey;
    void attack;
  }

  private async persistSnapshot() {
    if (Date.now() - this.lastSnapshotPersistAt < 15_000) return;
    this.lastSnapshotPersistAt = Date.now();
  }

  private estimateRisk(attack: DetectedAttack) {
    const base =
      attack.attack_type === "sandwich"
        ? 0.72
        : attack.attack_type === "jit"
          ? 0.6
          : attack.attack_type === "liquidity_snipe"
            ? 0.64
            : attack.attack_type === "liquidity_drain"
              ? 0.67
          : attack.attack_type === "liquidation"
            ? 0.55
            : 0.48;
    const profitBoost = Math.min(0.08, Math.max(0, (attack.profit_usd ?? 0) / 10000));
    const confidenceBoost = Math.min(0.12, Math.max(0, attack.confidence - 0.75));
    const evidenceBoost =
      attack.detector.includes("wide") || attack.detector.includes("parsed") ? 0.04 : 0;
    return Math.min(0.96, Number((base + profitBoost + confidenceBoost + evidenceBoost).toFixed(2)));
  }

  private inferExecutionLane(attack: DetectedAttack): ApiAttack["execution_lane"] {
    const validator = attack.validator.toLowerCase();
    if (validator.includes("jito")) return "jito-aligned";
    if ((attack.tip_lamports ?? 0) >= 20_000) return "priority-fee";
    return "standard";
  }

  private inferDetectionBasis(attack: DetectedAttack): ApiAttack["detection_basis"] {
    if (attack.detector.includes("parsed") || attack.detector.includes("liquidation")) {
      return "parsed";
    }
    if (attack.detector.includes("flow") || attack.detector.includes("raw")) {
      return "flow";
    }
    return "heuristic";
  }

  private estimateBundleLikelihood(attack: DetectedAttack) {
    let score = 0.18;
    const validator = attack.validator.toLowerCase();
    if (validator.includes("jito")) score += 0.32;
    if ((attack.tip_lamports ?? 0) >= 25_000) score += 0.16;
    if (attack.frontrun_tx && attack.backrun_tx) score += 0.14;
    if (attack.detector.includes("parsed")) score += 0.08;
    if (attack.detector.includes("wide")) score -= 0.08;
    return Number(Math.max(0.05, Math.min(0.92, score)).toFixed(2));
  }

  hasLiveData() {
    return this.started && (Boolean(this.connection) || this.externalStreamActive);
  }

  getStatus(): LiveStatus {
    return {
      mode: this.hasLiveData() ? "chain" : "fallback",
      heliusConfigured: Boolean(this.heliusRpcUrl),
      started: this.started,
      syncing: this.syncing,
      lastProcessedSlot: this.lastProcessedSlot,
      latestChainSlot: this.latestChainSlot,
      blocksProcessed: this.blocksProcessed,
      attacksDetected: this.attacksDetected,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      recentMetrics: this.recentMetrics,
      recentAttackPreview: this.attacks.slice(0, 5).map((attack) => ({
        attack_type: attack.attack_type,
        detector: attack.detector,
        confidence: attack.confidence,
        slot: attack.slot,
      })),
      recentValidatorPreview: this.getValidators().slice(0, 3).map((item) => ({
        validator: item.validator,
        risk_score: item.risk_score,
        sandwich_share: item.sandwich_share,
        wide_sandwich_count: item.wide_sandwich_count,
        total_mev_attacks: item.total_mev_attacks,
        unique_entities: item.unique_entities,
      })),
    };
  }

  getStats() {
    const entityContext = this.buildEntityContext();
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const last1h = Date.now() - 60 * 60 * 1000;
    const attacks24h = this.attacks.filter(
      (attack) => new Date(attack.block_time).getTime() >= last24h,
    );
    const attacks1h = this.attacks.filter(
      (attack) => new Date(attack.block_time).getTime() >= last1h,
    );

    return {
      total_attacks: this.attacks.length,
      attacks_24h: attacks24h.length,
      attacks_1h: attacks1h.length,
      total_extracted_usd: this.sumProfit(this.attacks),
      extracted_24h: this.sumProfit(attacks24h),
      total_entities: entityContext.groups.length,
      total_wallets: new Set(this.attacks.map((attack) => attack.attacker_wallet)).size,
      total_victims: new Set(this.attacks.map((attack) => attack.victim_wallet).filter(Boolean)).size,
      sandwich_count: this.attacks.filter((attack) => attack.attack_type === "sandwich").length,
      arb_count: this.attacks.filter((attack) => attack.attack_type === "arbitrage").length,
      jit_count: this.attacks.filter((attack) => attack.attack_type === "jit").length,
      liquidity_snipe_count: this.attacks.filter((attack) => attack.attack_type === "liquidity_snipe").length,
      liquidity_drain_count: this.attacks.filter((attack) => attack.attack_type === "liquidity_drain").length,
    };
  }

  getAttacks(params: {
    type?: string;
    pool?: string;
    limit?: string;
    offset?: string;
    since?: string;
  }) {
    const entityContext = this.buildEntityContext();
    let results = [...this.attacks];

    if (params.type) results = results.filter((attack) => attack.attack_type === params.type);
    if (params.pool) results = results.filter((attack) => attack.pool_address === params.pool);
    if (params.since) {
      const sinceTs = new Date(params.since).getTime();
      if (!Number.isNaN(sinceTs)) {
        results = results.filter((attack) => new Date(attack.block_time).getTime() > sinceTs);
      }
    }

    const offset = Number.parseInt(params.offset ?? "0", 10) || 0;
    const limit = Number.parseInt(params.limit ?? "50", 10) || 50;
    return results.slice(offset, offset + limit).map((attack) => {
      const group = entityContext.entityByWallet.get(attack.attacker_wallet);
      return {
        ...attack,
        entity_id: group?.id ?? attack.entity_id,
        entity_label: group?.label ?? attack.entity_label,
      };
    });
  }

  getEntities(params: {
    strategy?: string;
    min_risk?: string;
    sort?: string;
    limit?: string;
    offset?: string;
  }): ApiEntity[] {
    const entityContext = this.buildEntityContext();
    const results = entityContext.groups.map((group) => {
      const groupAttacks = this.attacks.filter((attack) => group.wallets.includes(attack.attacker_wallet));
      const profit = this.sumProfit(groupAttacks);
      const attacks24h = groupAttacks.filter(
        (attack) => new Date(attack.block_time).getTime() >= Date.now() - 24 * 60 * 60 * 1000,
      );
      const attacks7d = groupAttacks.filter(
        (attack) => new Date(attack.block_time).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000,
      );
      const strategies = [...new Set(groupAttacks.map((attack) => attack.attack_type))];
      const uniquePools = new Set(groupAttacks.map((attack) => attack.pool_address).filter((pool) => pool && pool !== "unknown"));
      const uniqueValidators = new Set(groupAttacks.map((attack) => attack.validator).filter(Boolean));
      const topWallet =
        [...group.wallets]
          .sort(
            (a, b) =>
              this.sumProfit(groupAttacks.filter((attack) => attack.attacker_wallet === b)) -
              this.sumProfit(groupAttacks.filter((attack) => attack.attacker_wallet === a)),
          )[0] ?? group.wallets[0];

      return {
        id: group.id,
        label: group.label,
        operator_wallet: topWallet,
        first_seen: groupAttacks.reduce((earliest, attack) => (new Date(attack.block_time) < new Date(earliest) ? attack.block_time : earliest), groupAttacks[0]?.block_time ?? new Date().toISOString()),
        last_seen: groupAttacks.reduce((latest, attack) => (new Date(attack.block_time) > new Date(latest) ? attack.block_time : latest), groupAttacks[0]?.block_time ?? new Date().toISOString()),
        total_profit_usd: profit,
        profit_24h_usd: this.sumProfit(attacks24h),
        profit_7d_usd: this.sumProfit(attacks7d),
        attack_count: groupAttacks.length,
        victim_count: new Set(groupAttacks.map((attack) => attack.victim_wallet).filter(Boolean)).size,
        dominant_strategy:
          [...strategies].sort(
            (a, b) =>
              groupAttacks.filter((attack) => attack.attack_type === b).length -
              groupAttacks.filter((attack) => attack.attack_type === a).length,
          )[0] ?? null,
        strategies_used: strategies,
        risk_score: Math.min(
          0.99,
          Number(
            (
              Math.max(...groupAttacks.map((attack) => attack.entity_risk ?? 0.5), 0.45) +
              Math.min(0.18, group.wallets.length * 0.04)
            ).toFixed(2),
          ),
        ),
        fee_aggression:
          groupAttacks.length > 0
            ? Math.min(
                1,
                groupAttacks.reduce((sum, attack) => sum + (attack.tip_lamports ?? 0), 0) /
                  groupAttacks.length /
                  300000,
              )
            : 0,
        position_dominance:
          groupAttacks.filter((attack) => attack.attack_type === "sandwich").length >= Math.max(2, Math.ceil(groupAttacks.length / 2))
            ? 0.88
            : 0.58,
        pool_concentration:
          groupAttacks.length > 0 ? Number((Math.min(0.98, 0.35 + uniquePools.size / Math.max(1, groupAttacks.length))).toFixed(2)) : 0.35,
        profit_consistency:
          groupAttacks.length > 0 ? Number((Math.min(0.98, 0.4 + attacks24h.length / Math.max(1, groupAttacks.length) * 0.4)).toFixed(2)) : 0.4,
        wallet_count: group.wallets.length,
        sample_wallets: group.wallets.slice(0, 6),
      } satisfies ApiEntity;
    });

    let filtered = [...results];
    if (params.strategy) {
      const strategy = params.strategy as AttackType;
      filtered = filtered.filter((entity) => entity.strategies_used.includes(strategy));
    }
    if (params.min_risk) {
      const minRisk = Number.parseFloat(params.min_risk);
      if (!Number.isNaN(minRisk)) {
        filtered = filtered.filter((entity) => entity.risk_score >= minRisk);
      }
    }

    const sort = params.sort ?? "profit";
    if (sort === "attacks") filtered.sort((a, b) => b.attack_count - a.attack_count);
    else if (sort === "risk") filtered.sort((a, b) => b.risk_score - a.risk_score);
    else filtered.sort((a, b) => b.total_profit_usd - a.total_profit_usd);

    const offset = Number.parseInt(params.offset ?? "0", 10) || 0;
    const limit = Number.parseInt(params.limit ?? "50", 10) || 50;
    return filtered.slice(offset, offset + limit);
  }

  getEntity(id: string) {
    const entity = this.getEntities({ limit: String(MAX_ATTACKS) }).find((item) => item.id === id);
    if (!entity) return null;

    const entityContext = this.buildEntityContext();
    const entityGroup = entityContext.groups.find((group) => group.id === id);
    const memberWallets = entityGroup?.wallets ?? entity.sample_wallets;
    const targetWallets = new Set(memberWallets);
    const recent_attacks = this.attacks.filter((attack) => targetWallets.has(attack.attacker_wallet));
    const validatorIntel = new Map(this.getValidators().map((validator) => [validator.validator, validator]));
    const poolMap = new Map<string, { attack_count: number; total_profit: number }>();
    const validatorMap = new Map<string, number>();
    const sharedSurfaceMap = new Map<string, { wallets: Set<string>; attacks: number; profit: number }>();
    const sharedValidatorMap = new Map<string, Set<string>>();
    const sharedStrategyMap = new Map<string, Set<string>>();

    for (const attack of recent_attacks) {
      poolMap.set(attack.pool_address, {
        attack_count: (poolMap.get(attack.pool_address)?.attack_count ?? 0) + 1,
        total_profit: (poolMap.get(attack.pool_address)?.total_profit ?? 0) + (attack.profit_usd ?? 0),
      });
      validatorMap.set(attack.validator, (validatorMap.get(attack.validator) ?? 0) + 1);

      const canonicalSurface = this.canonicalEntitySurface(attack.pool_address);
      if (!sharedSurfaceMap.has(canonicalSurface)) {
        sharedSurfaceMap.set(canonicalSurface, {
          wallets: new Set<string>(),
          attacks: 0,
          profit: 0,
        });
      }
      const surfaceEntry = sharedSurfaceMap.get(canonicalSurface)!;
      surfaceEntry.wallets.add(attack.attacker_wallet);
      surfaceEntry.attacks += 1;
      surfaceEntry.profit += attack.profit_usd ?? 0;

      if (!sharedValidatorMap.has(attack.validator)) {
        sharedValidatorMap.set(attack.validator, new Set<string>());
      }
      sharedValidatorMap.get(attack.validator)!.add(attack.attacker_wallet);

      if (!sharedStrategyMap.has(attack.attack_type)) {
        sharedStrategyMap.set(attack.attack_type, new Set<string>());
      }
      sharedStrategyMap.get(attack.attack_type)!.add(attack.attacker_wallet);
    }

    let coordinatedWindowCount = 0;
    for (let i = 0; i < recent_attacks.length; i++) {
      for (let j = i + 1; j < recent_attacks.length; j++) {
        const a = recent_attacks[i];
        const b = recent_attacks[j];
        if (a.attacker_wallet === b.attacker_wallet) continue;
        if (a.attack_type !== b.attack_type) continue;
        if (this.canonicalEntitySurface(a.pool_address) !== this.canonicalEntitySurface(b.pool_address)) continue;
        if (Math.abs(a.slot - b.slot) <= 8) coordinatedWindowCount += 1;
      }
    }

    return {
      entity,
      wallets: memberWallets.map((wallet) => ({
        wallet,
        role: wallet === entity.operator_wallet ? "operator" : "clustered",
        tx_count: recent_attacks.filter((attack) => attack.attacker_wallet === wallet).length,
        operator_label: wallet === entity.operator_wallet ? entity.label : null,
      })),
      recent_attacks,
      targeted_pools: [...poolMap.entries()]
        .map(([pool_address, values]) => ({
          pool_address,
          attack_count: values.attack_count,
          total_profit: values.total_profit,
        }))
        .sort((a, b) => b.attack_count - a.attack_count || b.total_profit - a.total_profit),
      validator_correlation: [...validatorMap.entries()]
        .map(([validator, attacks]) => {
          const intel = validatorIntel.get(validator);
          const exposureShare = recent_attacks.length > 0 ? (attacks / recent_attacks.length) * 100 : 0;
          const recommendedAction =
            (intel?.stake_centralization_risk ?? 0) >= 70 || (intel?.observed_sandwich_rate ?? 0) >= 45
              ? "reroute"
              : (intel?.risk_score ?? 0) >= 0.6
                ? "monitor"
                : "observe";
          return {
            validator,
            attacks,
            exposure_share: Number(exposureShare.toFixed(1)),
            validator_risk: intel?.risk_score ?? 0,
            observed_sandwich_rate: intel?.observed_sandwich_rate ?? intel?.sandwich_share ?? 0,
            stake_centralization_risk: intel?.stake_centralization_risk ?? 0,
            recommended_action: recommendedAction,
          };
        })
        .sort((a, b) => b.attacks - a.attacks || b.validator_risk - a.validator_risk),
      cluster_evidence: {
        shared_surface_count: [...sharedSurfaceMap.values()].filter((entry) => entry.wallets.size >= 2).length,
        shared_validator_count: [...sharedValidatorMap.values()].filter((wallets) => wallets.size >= 2).length,
        shared_strategy_count: [...sharedStrategyMap.values()].filter((wallets) => wallets.size >= 2).length,
        coordinated_window_count: coordinatedWindowCount,
      },
      related_surfaces: [...sharedSurfaceMap.entries()]
        .filter(([, entry]) => entry.wallets.size >= 2)
        .map(([surface, entry]) => ({
          surface,
          wallet_count: entry.wallets.size,
          attacks: entry.attacks,
          total_profit: entry.profit,
        }))
        .sort((a, b) => b.wallet_count - a.wallet_count || b.attacks - a.attacks || b.total_profit - a.total_profit)
        .slice(0, 8),
      profit_timeline: Array.from({ length: 7 }, (_, idx) => {
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - (6 - idx));
        const dayStart = start.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        const dayAttacks = recent_attacks.filter((attack) => {
          const timestamp = new Date(attack.block_time).getTime();
          return timestamp >= dayStart && timestamp < dayEnd;
        });
        return {
          day: new Date(dayStart).toISOString(),
          profit: dayAttacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0),
          attacks: dayAttacks.length,
        };
      }),
    };
  }

  getPools(limit = 50): ApiPool[] {
    const routeRiskBySurface = new Map(this.getRouteRisks(MAX_ATTACKS).map((route) => [route.route_key, route]));
    const entityContext = this.buildEntityContext();
    const map = new Map<string, ApiPool>();

    for (const attack of this.attacks) {
      const existing = map.get(attack.pool_address);
      if (!existing) {
        map.set(attack.pool_address, {
          pool_address: attack.pool_address,
          epoch: Math.floor(attack.slot / 432000),
          protocol: parseSurface(attack.pool_address).protocol,
          sandwich_count: attack.attack_type === "sandwich" ? 1 : 0,
          arbitrage_count: attack.attack_type === "arbitrage" ? 1 : 0,
          jit_count: attack.attack_type === "jit" ? 1 : 0,
          total_attacks: 1,
          total_extracted_usd: attack.profit_usd ?? 0,
          unique_attackers: 1,
          toxicity_score: 0,
          top_entity_id: entityContext.entityByWallet.get(attack.attacker_wallet)?.id ?? attack.attacker_wallet,
          top_entity_label: entityContext.entityByWallet.get(attack.attacker_wallet)?.label ?? attack.entity_label,
          top_entity_risk: attack.entity_risk,
        });
        continue;
      }

      existing.total_attacks += 1;
      existing.total_extracted_usd += attack.profit_usd ?? 0;
      existing.sandwich_count += attack.attack_type === "sandwich" ? 1 : 0;
      existing.arbitrage_count += attack.attack_type === "arbitrage" ? 1 : 0;
      existing.jit_count += attack.attack_type === "jit" ? 1 : 0;
    }

    return [...map.values()]
      .map((pool) => ({
        ...(routeRiskBySurface.get(pool.pool_address)
          ? {
              lvr_proxy_score: routeRiskBySurface.get(pool.pool_address)!.lvr_proxy_score,
              adverse_selection_intensity: round(
                clamp(
                  routeRiskBySurface.get(pool.pool_address)!.lp_adverse_selection_probability * 0.92,
                  4,
                  99,
                ),
              ),
              stale_quote_arb_frequency: routeRiskBySurface.get(pool.pool_address)!.stale_quote_pickup_rate,
              lp_drag_estimate_usd: round(routeRiskBySurface.get(pool.pool_address)!.estimated_savings_usd * Math.max(1.2, pool.total_attacks / 6), 2),
              toxic_to_benign_volume_ratio: round(
                clamp(
                  routeRiskBySurface.get(pool.pool_address)!.toxic_flow_rate / Math.max(12, 100 - routeRiskBySurface.get(pool.pool_address)!.toxic_flow_rate),
                  0.1,
                  9.9,
                ),
                2,
              ),
              quote_freshness_stress: round(clamp(100 - routeRiskBySurface.get(pool.pool_address)!.quote_freshness_ms / 10, 4, 99)),
              saved_fee_bps_if_segmented: round(routeRiskBySurface.get(pool.pool_address)!.estimated_savings_bps, 2),
              primary_cause:
                routeRiskBySurface.get(pool.pool_address)!.sandwich_count >= routeRiskBySurface.get(pool.pool_address)!.arbitrage_count
                  ? "sandwich pressure"
                  : "stale quote arbitrage",
              reason_codes: routeRiskBySurface.get(pool.pool_address)!.reason_codes,
            }
          : {}),
        ...pool,
        unique_attackers: new Set(
          this.attacks
            .filter((attack) => attack.pool_address === pool.pool_address)
            .map((attack) => attack.attacker_wallet),
        ).size,
        toxicity_score: Math.min(
          100,
          Number(
            (
              pool.sandwich_count * 14 +
              pool.arbitrage_count * 6 +
              pool.jit_count * 8 +
              pool.total_extracted_usd / 75
            ).toFixed(1),
          ),
        ),
        lvr_proxy_score: round(clamp(pool.toxicity_score * 0.72 + pool.arbitrage_count * 0.5 + pool.sandwich_count * 0.3, 8, 99)),
        adverse_selection_intensity: round(clamp(pool.sandwich_count * 0.7 + pool.arbitrage_count * 0.48 + pool.jit_count * 0.42, 4, 99)),
        stale_quote_arb_frequency: round(clamp((pool.arbitrage_count / Math.max(1, pool.total_attacks)) * 100, 1, 95)),
        lp_drag_estimate_usd: round(pool.total_extracted_usd * 0.74, 2),
        toxic_to_benign_volume_ratio: round(clamp(pool.toxicity_score / Math.max(12, 100 - pool.toxicity_score), 0.1, 9.9), 2),
        quote_freshness_stress: round(clamp(pool.toxicity_score * 0.82 + pool.arbitrage_count * 0.35, 5, 99)),
        saved_fee_bps_if_segmented: round(clamp(pool.toxicity_score * 0.11, 0.4, 12), 2),
        primary_cause:
          pool.sandwich_count >= pool.arbitrage_count && pool.sandwich_count >= pool.jit_count
            ? "sandwich pressure"
            : pool.arbitrage_count >= pool.jit_count
              ? "stale quote arbitrage"
              : "jit liquidity pressure",
        reason_codes: buildReasonCodes({
          sandwichRate: pool.sandwich_count / Math.max(1, pool.total_attacks),
          staleQuotePickupRate: (pool.arbitrage_count / Math.max(1, pool.total_attacks)) * 100,
          lvrProxyScore: pool.toxicity_score * 0.72,
          toxicFlowRate: pool.toxicity_score,
        }),
      }))
      .sort((a, b) => b.toxicity_score - a.toxicity_score)
      .slice(0, limit);
  }

  private normalizedPairKey(inputMint: string | null, outputMint: string | null) {
    return [inputMint ?? "unknown", outputMint ?? "unknown"].join("->");
  }

  private swapPrice(swap: ParsedSwapCandidate) {
    if (!swap.input_amount || !swap.output_amount || swap.input_amount <= 0 || swap.output_amount <= 0) return null;
    return swap.output_amount / swap.input_amount;
  }

  private median(values: number[]) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private computeSwapQuoteAnalytics(target: ParsedSwapCandidate) {
    const price = this.swapPrice(target);
    if (!price) {
      return {
        expectedQuotePrice: null,
        quoteFreshnessMs: null,
        slippageBps: null,
        markout1s: null,
        markout5s: null,
        markout30s: null,
        staleQuotePickup: false,
      };
    }

    const pairKey = this.normalizedPairKey(target.input_mint, target.output_mint);
    const samePair = this.recentSwaps.filter(
      (swap) =>
        this.normalizedPairKey(swap.input_mint, swap.output_mint) === pairKey &&
        swap.signature !== target.signature &&
        swap.input_amount &&
        swap.output_amount,
    );
    const targetTs = target.block_time.getTime();
    const prior = samePair
      .filter((swap) => swap.block_time.getTime() < targetTs)
      .sort((a, b) => targetTs - b.block_time.getTime() - (targetTs - a.block_time.getTime()));
    const recentPrior = prior.slice(0, 8);
    const expectedQuotePrice = this.median(recentPrior.map((swap) => this.swapPrice(swap)).filter((v): v is number => v != null));
    const latestPrior = recentPrior[0];
    const quoteFreshnessMs = latestPrior ? targetTs - latestPrior.block_time.getTime() : null;
    const slippageBps =
      expectedQuotePrice && expectedQuotePrice > 0
        ? Math.max(0, ((expectedQuotePrice - price) / expectedQuotePrice) * 10_000)
        : null;

    const futureWindow = (ms: number) =>
      this.median(
        samePair
          .filter((swap) => {
            const dt = swap.block_time.getTime() - targetTs;
            return dt >= 0 && dt <= ms;
          })
          .map((swap) => this.swapPrice(swap))
          .filter((v): v is number => v != null),
      );
    const markoutFromFuture = (futurePrice: number | null) =>
      futurePrice && price > 0 ? Math.max(0, ((futurePrice - price) / price) * 10_000) : null;

    const markout1s = markoutFromFuture(futureWindow(1_000));
    const markout5s = markoutFromFuture(futureWindow(5_000));
    const markout30s = markoutFromFuture(futureWindow(30_000));

    const staleQuotePickup =
      (quoteFreshnessMs ?? 0) >= 1_000 &&
      (markout5s ?? 0) >= 3 &&
      (slippageBps ?? 0) >= 2;

    return {
      expectedQuotePrice,
      quoteFreshnessMs,
      slippageBps,
      markout1s,
      markout5s,
      markout30s,
      staleQuotePickup,
    };
  }

  private buildSwapAnalyticsBySurface() {
    const grouped = new Map<
      string,
      {
        slippageBps: number[];
        markout1s: number[];
        markout5s: number[];
        markout30s: number[];
        quoteFreshnessMs: number[];
        staleQuotePickups: number;
        swaps: number;
        pairKeys: Set<string>;
        sourceCounts: Map<string, number>;
        validatorMarkouts: Map<string, number[]>;
      }
    >();

    for (const swap of this.recentSwaps) {
      const surfaceKey = swap.pool_address ?? (swap.input_mint || swap.output_mint ? `pair:${this.normalizedPairKey(swap.input_mint, swap.output_mint)}` : "unknown");
      const analytics = this.computeSwapQuoteAnalytics(swap);
      if (!grouped.has(surfaceKey)) {
        grouped.set(surfaceKey, {
          slippageBps: [],
          markout1s: [],
          markout5s: [],
          markout30s: [],
          quoteFreshnessMs: [],
          staleQuotePickups: 0,
          swaps: 0,
          pairKeys: new Set(),
          sourceCounts: new Map(),
          validatorMarkouts: new Map(),
        });
      }

      const entry = grouped.get(surfaceKey)!;
      entry.swaps += 1;
      entry.pairKeys.add(this.normalizedPairKey(swap.input_mint, swap.output_mint));
      if (swap.source) {
        entry.sourceCounts.set(swap.source.toLowerCase(), (entry.sourceCounts.get(swap.source.toLowerCase()) ?? 0) + 1);
      }
      if (analytics.slippageBps != null) entry.slippageBps.push(analytics.slippageBps);
      if (analytics.markout1s != null) entry.markout1s.push(analytics.markout1s);
      if (analytics.markout5s != null) entry.markout5s.push(analytics.markout5s);
      if (analytics.markout30s != null) entry.markout30s.push(analytics.markout30s);
      if (analytics.quoteFreshnessMs != null) entry.quoteFreshnessMs.push(analytics.quoteFreshnessMs);
      if (analytics.staleQuotePickup) entry.staleQuotePickups += 1;
      if (!entry.validatorMarkouts.has(swap.validator)) entry.validatorMarkouts.set(swap.validator, []);
      if (analytics.markout30s != null) entry.validatorMarkouts.get(swap.validator)!.push(analytics.markout30s);
    }

    return grouped;
  }

  getRouteRisks(limit = 25): ApiRouteRisk[] {
    const swapAnalytics = this.buildSwapAnalyticsBySurface();
    const grouped = new Map<string, ApiRouteRiskAccumulator>();

    for (const attack of this.attacks) {
      const surface = parseSurface(attack.pool_address);
      const existing = grouped.get(attack.pool_address);

      if (!existing) {
        grouped.set(attack.pool_address, {
          route_key: attack.pool_address,
          route_kind: surface.route_kind,
          protocol: surface.protocol,
          label: surface.label,
          sandwich_count: attack.attack_type === "sandwich" ? 1 : 0,
          arbitrage_count: attack.attack_type === "arbitrage" ? 1 : 0,
          jit_count: attack.attack_type === "jit" ? 1 : 0,
          liquidation_count: attack.attack_type === "liquidation" ? 1 : 0,
          backrun_count: attack.attack_type === "backrun" ? 1 : 0,
          liquidity_snipe_count: attack.attack_type === "liquidity_snipe" ? 1 : 0,
          liquidity_drain_count: attack.attack_type === "liquidity_drain" ? 1 : 0,
          total_attacks: 1,
          total_extracted_usd: attack.profit_usd ?? 0,
          confidence_sum: attack.confidence ?? 0,
          bundle_sum: attack.bundle_likelihood ?? 0,
          attackers: new Set([attack.attacker_wallet]),
        });
        continue;
      }

      existing.total_attacks += 1;
      existing.total_extracted_usd += attack.profit_usd ?? 0;
      existing.confidence_sum += attack.confidence ?? 0;
      existing.bundle_sum += attack.bundle_likelihood ?? 0;
      existing.attackers.add(attack.attacker_wallet);
      existing.sandwich_count += attack.attack_type === "sandwich" ? 1 : 0;
      existing.arbitrage_count += attack.attack_type === "arbitrage" ? 1 : 0;
      existing.jit_count += attack.attack_type === "jit" ? 1 : 0;
      existing.liquidation_count += attack.attack_type === "liquidation" ? 1 : 0;
      existing.backrun_count += attack.attack_type === "backrun" ? 1 : 0;
      existing.liquidity_snipe_count += attack.attack_type === "liquidity_snipe" ? 1 : 0;
      existing.liquidity_drain_count += attack.attack_type === "liquidity_drain" ? 1 : 0;
    }

    return [...grouped.values()]
      .map((item) => {
        const liveAnalytics = swapAnalytics.get(item.route_key);
        const avgConfidence = item.total_attacks > 0 ? item.confidence_sum / item.total_attacks : 0;
        const bundleShare = item.total_attacks > 0 ? item.bundle_sum / item.total_attacks : 0;
        const sandwichRate = item.total_attacks > 0 ? item.sandwich_count / item.total_attacks : 0;
        const backrunRate = item.total_attacks > 0 ? item.backrun_count / item.total_attacks : 0;
        const arbitrageRate = item.total_attacks > 0 ? item.arbitrage_count / item.total_attacks : 0;
        const jitRate = item.total_attacks > 0 ? item.jit_count / item.total_attacks : 0;
        const liquidityRiskRate =
          item.total_attacks > 0 ? (item.liquidity_snipe_count + item.liquidity_drain_count) / item.total_attacks : 0;
        const riskScore = Math.min(
          100,
          Number(
            (
              item.sandwich_count * 16 +
              item.backrun_count * 10 +
              item.jit_count * 8 +
              item.liquidity_drain_count * 11 +
              item.liquidity_snipe_count * 9 +
              item.liquidation_count * 7 +
              item.arbitrage_count * 5 +
              item.total_extracted_usd / 90 +
              item.attackers.size * 2 +
              avgConfidence * 10 +
              bundleShare * 8
            ).toFixed(1),
          ),
        );
        const toxicFlowRate = round(
          clamp(
            sandwichRate * 58 +
              backrunRate * 32 +
              liquidityRiskRate * 30 +
              jitRate * 18 +
              arbitrageRate * 14 +
              item.attackers.size * 2.5,
            3,
            99,
          ),
        );
        const liveStaleRate =
          liveAnalytics && liveAnalytics.swaps > 0
            ? (liveAnalytics.staleQuotePickups / liveAnalytics.swaps) * 100
            : null;
        const staleQuotePickupRate = round(
          clamp(liveStaleRate ?? (arbitrageRate * 48 + sandwichRate * 36 + bundleShare * 18), 1, 98),
        );
        const quoteFreshnessMs = round(
          clamp(
            liveAnalytics?.quoteFreshnessMs.length
              ? this.median(liveAnalytics.quoteFreshnessMs) ?? 400
              : 920 - riskScore * 5.2 - item.total_attacks * 13,
            65,
            980,
          ),
          0,
        );
        const realizedSlippageBps = round(
          clamp(
            liveAnalytics?.slippageBps.length
              ? this.median(liveAnalytics.slippageBps) ?? 2
              : riskScore * 0.07 + sandwichRate * 8 + bundleShare * 3.8,
            0.8,
            28,
          ),
          2,
        );
        const markout1 = round(
          clamp(
            liveAnalytics?.markout1s.length
              ? this.median(liveAnalytics.markout1s) ?? 1
              : realizedSlippageBps * 0.6 + sandwichRate * 2.2 + bundleShare * 0.15,
            0.5,
            18,
          ),
          2,
        );
        const markout5 = round(
          clamp(
            liveAnalytics?.markout5s.length
              ? this.median(liveAnalytics.markout5s) ?? 1.5
              : realizedSlippageBps * 0.95 + sandwichRate * 4.1 + staleQuotePickupRate * 0.05,
            0.8,
            26,
          ),
          2,
        );
        const markout30 = round(
          clamp(
            liveAnalytics?.markout30s.length
              ? this.median(liveAnalytics.markout30s) ?? 2
              : realizedSlippageBps * 1.2 + sandwichRate * 5.5 + staleQuotePickupRate * 0.08,
            1,
            32,
          ),
          2,
        );
        const executionQualityScore = round(clamp(100 - (markout30 * 2 + realizedSlippageBps * 1.7 + toxicFlowRate * 0.42), 4, 98));
        const flowQualityScore = round(clamp(100 - toxicFlowRate * 0.72 - bundleShare * 16 + (item.route_kind === "venue" ? 6 : 0), 3, 97));
        const toxicityProbability = round(clamp(toxicFlowRate * 0.88 + bundleShare * 19, 4, 99));
        const retailLikelihood = round(clamp(100 - toxicFlowRate * 0.92 - bundleShare * 24, 2, 92));
        const lpAdverseSelectionProbability = round(clamp(staleQuotePickupRate * 0.62 + markout30 * 2.1 + sandwichRate * 21, 3, 99));
        const lvrProxyScore = round(clamp(staleQuotePickupRate * 0.58 + markout30 * 1.95 + arbitrageRate * 18 + sandwichRate * 12, 2, 99));
        const priorityFeePressure = round(clamp(bundleShare * 0.68 + avgConfidence * 12, 2, 98));
        const validatorMarkoutQuality = round(clamp(100 - markout5 * 3.1 - bundleShare * 24, 3, 96));
        const recommendedMaxNotionalUsd = round(clamp(180_000 - toxicFlowRate * 1_250 - bundleShare * 650, 7_500, 180_000), 0);
        const estimatedSavingsBps = round(clamp(markout30 * 0.55 + lvrProxyScore * 0.05, 0.3, 18), 2);
        const estimatedSavingsUsd = round((50_000 * estimatedSavingsBps) / 10_000, 2);
        const reasonCodes = buildReasonCodes({
          sandwichRate,
          bundleShare: bundleShare * 100,
          staleQuotePickupRate,
          markout30,
          lvrProxyScore,
          toxicFlowRate,
        });
        const policyAction =
          riskScore >= 86 || toxicityProbability >= 82
            ? "avoid"
            : riskScore >= 72 || lvrProxyScore >= 58
              ? "reroute"
              : riskScore >= 55
                ? "penalize"
                : riskScore >= 28
                  ? "monitor"
                  : "allow";
        const decomposition = buildDecomposition([
          { label: "sandwich_concentration", value: sandwichRate * 100 },
          { label: "stale_quote_pickups", value: staleQuotePickupRate },
          { label: "bundle_pressure", value: bundleShare * 100 },
          { label: "markout_deterioration", value: markout30 * 3 },
          { label: "lp_adverse_selection", value: lvrProxyScore },
        ]);
        const sourceHint =
          liveAnalytics && liveAnalytics.sourceCounts.size > 0
            ? [...liveAnalytics.sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
            : item.route_kind === "route"
              ? "aggregator-routed"
              : bundleShare >= 0.55
                ? "bundle-lane"
                : "searcher-bot";

        return {
          route_key: item.route_key,
          route_kind: item.route_kind,
          protocol: item.protocol,
          label: item.label,
          sandwich_count: item.sandwich_count,
          arbitrage_count: item.arbitrage_count,
          jit_count: item.jit_count,
          liquidation_count: item.liquidation_count,
          backrun_count: item.backrun_count,
          liquidity_snipe_count: item.liquidity_snipe_count,
          liquidity_drain_count: item.liquidity_drain_count,
          total_attacks: item.total_attacks,
          total_extracted_usd: item.total_extracted_usd,
          unique_attackers: item.attackers.size,
          avg_confidence: Number((avgConfidence * 100).toFixed(1)),
          bundle_share: Number((bundleShare * 100).toFixed(1)),
          risk_score: riskScore,
          recommendation: riskScore >= 80 ? "avoid" : riskScore >= 55 ? "penalize" : "monitor",
          execution_quality_score: executionQualityScore,
          toxic_flow_rate: toxicFlowRate,
          realized_slippage_bps: realizedSlippageBps,
          stale_quote_pickup_rate: staleQuotePickupRate,
          quote_freshness_ms: quoteFreshnessMs,
          markout_1s_bps: markout1,
          markout_5s_bps: markout5,
          markout_30s_bps: markout30,
          flow_quality_score: flowQualityScore,
          toxicity_probability: toxicityProbability,
          retail_likelihood: retailLikelihood,
          lp_adverse_selection_probability: lpAdverseSelectionProbability,
          lvr_proxy_score: lvrProxyScore,
          priority_fee_pressure: priorityFeePressure,
          validator_markout_quality: validatorMarkoutQuality,
          source_hint: sourceHint,
          recommended_max_notional_usd: recommendedMaxNotionalUsd,
          estimated_savings_bps: estimatedSavingsBps,
          estimated_savings_usd: estimatedSavingsUsd,
          policy_action: policyAction,
          reason_codes: reasonCodes,
          decomposition,
        } satisfies ApiRouteRisk;
      })
      .sort((a, b) => b.risk_score - a.risk_score || b.total_extracted_usd - a.total_extracted_usd)
      .slice(0, limit);
  }

  private estimateBpsAtRisk(
    route: Pick<ApiRouteRisk, "risk_score" | "bundle_share" | "total_attacks" | "avg_confidence">,
    objective: NonNullable<ApiRouteEvaluationRequest["objective"]>,
  ) {
    const objectiveMultiplier =
      objective === "protect_users" ? 1.18 : objective === "protect_lp" ? 1.1 : objective === "monitor_only" ? 0.82 : 1;
    const base =
      route.risk_score * 0.11 +
      route.bundle_share * 0.035 +
      Math.min(route.total_attacks, 12) * 0.35 +
      route.avg_confidence * 0.018;
    return Number(Math.max(1, Math.min(36, base * objectiveMultiplier)).toFixed(2));
  }

  private classifyRouteDecision(
    route: Pick<ApiRouteRisk, "risk_score" | "bundle_share">,
    objective: NonNullable<ApiRouteEvaluationRequest["objective"]>,
    estimatedBpsAtRisk: number,
    saferAlternativesCount: number,
  ): ApiRouteEvaluation["decision"] {
    const avoidThreshold = objective === "protect_users" ? 74 : objective === "protect_lp" ? 78 : 82;
    const penalizeThreshold = objective === "monitor_only" ? 68 : 56;
    const rerouteThreshold = objective === "monitor_only" ? 88 : 72;

    if (saferAlternativesCount > 0 && (route.risk_score >= rerouteThreshold || estimatedBpsAtRisk >= 12)) {
      return "reroute";
    }
    if (route.risk_score >= avoidThreshold || estimatedBpsAtRisk >= 15 || route.bundle_share >= 72) {
      return "avoid";
    }
    if (route.risk_score >= penalizeThreshold || estimatedBpsAtRisk >= 8) {
      return "penalize";
    }
    if (route.risk_score >= 28 || estimatedBpsAtRisk >= 3.5) {
      return "monitor";
    }
    return "allow";
  }

  private confidenceBand(route: Pick<ApiRouteRisk, "total_attacks" | "avg_confidence">): ApiRouteEvaluation["confidence_band"] {
    if (route.total_attacks >= 5 && route.avg_confidence >= 78) return "high";
    if (route.total_attacks >= 2 && route.avg_confidence >= 58) return "medium";
    return "exploratory";
  }

  private matchRouteRisk(query: ApiRouteEvaluationRequest, routeRisks: ApiRouteRisk[]) {
    if (query.route_key) {
      const exact = routeRisks.find((route) => route.route_key === query.route_key);
      if (exact) return { route: exact, matched_on: "route_key" as const };
    }

    const inputMint = query.input_mint ?? null;
    const outputMint = query.output_mint ?? null;

    if (query.protocol && inputMint && outputMint) {
      const protocolPair = routeRisks.find((route) => {
        const surface = parseSurface(route.route_key);
        return (
          route.protocol === query.protocol &&
          surface.mints[0] === inputMint &&
          surface.mints[1] === outputMint
        );
      });
      if (protocolPair) return { route: protocolPair, matched_on: "protocol_pair" as const };
    }

    if (inputMint && outputMint) {
      const pairMatch = routeRisks.find((route) => {
        const surface = parseSurface(route.route_key);
        return surface.mints[0] === inputMint && surface.mints[1] === outputMint;
      });
      if (pairMatch) return { route: pairMatch, matched_on: "pair" as const };
    }

    return { route: routeRisks[0] ?? null, matched_on: "fallback" as const };
  }

  evaluateRoute(request: ApiRouteEvaluationRequest): ApiRouteEvaluation {
    const objective = request.objective ?? "best_execution";
    const routeRisks = this.getRouteRisks(MAX_ATTACKS);
    const { route, matched_on } = this.matchRouteRisk(request, routeRisks);

    const fallbackRoute = routeRisks[0];
    const selected = route ?? fallbackRoute;
    if (!selected) {
      return {
        route_key: null,
        label: request.route_label ?? "Unknown route",
        protocol: request.protocol ?? null,
        matched_on,
        decision: "monitor",
        risk_score: 0,
        estimated_bps_at_risk: 0,
        estimated_loss_usd: 0,
        slippage_bps: request.slippage_bps ?? null,
        objective,
        confidence_band: "exploratory",
        safer_alternatives: [],
        rationale: ["no route history is available yet for this surface"],
        integration_actions: ["log the route for future evaluation", "fallback to monitor-only mode"],
      };
    }

    const selectedSurface = parseSurface(selected.route_key);
    const pairMatches = routeRisks
      .filter((route) => {
        const surface = parseSurface(route.route_key);
        return (
          surface.mints[0] === selectedSurface.mints[0] &&
          surface.mints[1] === selectedSurface.mints[1] &&
          route.route_key !== selected.route_key &&
          route.risk_score < selected.risk_score
        );
      })
      .sort((a, b) => a.risk_score - b.risk_score)
      .slice(0, 2);

    const estimatedBpsAtRisk = this.estimateBpsAtRisk(selected, objective);
    const notionalUsd = Math.max(0, request.notional_usd ?? 25_000);
    const estimatedLossUsd = Number(((notionalUsd * estimatedBpsAtRisk) / 10_000).toFixed(2));
    const saferAlternatives = pairMatches.map((route) => ({
      route_key: route.route_key,
      label: route.label,
      protocol: route.protocol,
      risk_score: route.risk_score,
      estimated_bps_saved: Number(Math.max(0, estimatedBpsAtRisk - this.estimateBpsAtRisk(route, objective)).toFixed(2)),
    }));
    const decision = this.classifyRouteDecision(selected, objective, estimatedBpsAtRisk, saferAlternatives.length);

    return {
      route_key: selected.route_key,
      label: selected.label,
      protocol: selected.protocol,
      matched_on,
      decision,
      risk_score: selected.risk_score,
      estimated_bps_at_risk: estimatedBpsAtRisk,
      estimated_loss_usd: estimatedLossUsd,
      slippage_bps: request.slippage_bps ?? null,
      objective,
      confidence_band: this.confidenceBand(selected),
      safer_alternatives: saferAlternatives,
      rationale: [
        `matched against ${matched_on.replace("_", " ")} intel for ${selected.label}`,
        `${selected.total_attacks} detections and ${selected.unique_attackers} unique operators are attached to this surface`,
        `bundle-heavy share is ${selected.bundle_share.toFixed(0)}% and average detector confidence is ${selected.avg_confidence.toFixed(0)}%`,
        `30s markout is ${selected.markout_30s_bps.toFixed(1)} bps and stale quote pickup rate is ${selected.stale_quote_pickup_rate.toFixed(0)}%`,
        `estimated LVR proxy score is ${selected.lvr_proxy_score.toFixed(0)} with flow quality ${selected.flow_quality_score.toFixed(0)}`,
      ],
      integration_actions: [
        decision === "reroute" || decision === "avoid"
          ? "prefer the safer alternative or remove this venue from the active route set"
          : decision === "penalize"
            ? "downrank this route in the scoring function before order submission"
            : "attach route intel to the trade record and continue monitoring",
        "emit this decision into routing logs and user-protection analytics",
        decision === "avoid" || decision === "reroute"
          ? "trigger a high-severity ops alert for repeated toxic execution on this pair"
          : "keep this surface under live alert monitoring",
        `cap order size near $${selected.recommended_max_notional_usd.toLocaleString()} unless the venue state improves`,
      ],
      execution_quality_score: selected.execution_quality_score,
      toxic_flow_rate: selected.toxic_flow_rate,
      realized_slippage_bps: selected.realized_slippage_bps,
      markout_1s_bps: selected.markout_1s_bps,
      markout_5s_bps: selected.markout_5s_bps,
      markout_30s_bps: selected.markout_30s_bps,
      stale_quote_pickup_rate: selected.stale_quote_pickup_rate,
      quote_freshness_ms: selected.quote_freshness_ms,
      flow_quality_score: selected.flow_quality_score,
      toxicity_probability: selected.toxicity_probability,
      retail_likelihood: selected.retail_likelihood,
      lp_adverse_selection_probability: selected.lp_adverse_selection_probability,
      lvr_proxy_score: selected.lvr_proxy_score,
      recommended_max_notional_usd: selected.recommended_max_notional_usd,
      estimated_savings_bps: selected.estimated_savings_bps,
      estimated_savings_usd: Number(((notionalUsd * selected.estimated_savings_bps) / 10_000).toFixed(2)),
      source_hint: selected.source_hint,
      reason_codes: selected.reason_codes,
      decomposition: selected.decomposition,
      policy_action: selected.policy_action,
    };
  }

  rankRoutes(request: ApiRouteRankingRequest): ApiRouteRanking {
    const objective = request.objective ?? "best_execution";
    const ranked = request.candidates
      .map((candidate) =>
        this.evaluateRoute({
          input_mint: candidate.input_mint ?? request.input_mint,
          output_mint: candidate.output_mint ?? request.output_mint,
          protocol: candidate.protocol ?? null,
          route_key: candidate.route_key ?? null,
          route_label: candidate.label ?? null,
          notional_usd: request.notional_usd,
          slippage_bps: request.slippage_bps,
          objective,
        }),
      )
      .sort((a, b) => a.estimated_bps_at_risk - b.estimated_bps_at_risk || a.risk_score - b.risk_score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    const chosen =
      ranked.find((entry) => entry.decision === "allow") ??
      ranked.find((entry) => entry.decision === "monitor") ??
      ranked.find((entry) => entry.decision === "penalize") ??
      ranked[0] ??
      null;

    const worstLoss = ranked.reduce((max, entry) => Math.max(max, entry.estimated_loss_usd), 0);
    const chosenLoss = chosen?.estimated_loss_usd ?? 0;
    const primary_action =
      !chosen || chosen.decision === "avoid"
        ? "block"
        : chosen.decision === "reroute"
          ? "reroute"
          : chosen.decision === "monitor"
            ? "monitor"
            : "route";
    const chosenSurface = chosen?.route_key ? parseSurface(chosen.route_key) : null;

    return {
      input_mint: request.input_mint ?? chosenSurface?.mints[0] ?? null,
      output_mint: request.output_mint ?? chosenSurface?.mints[1] ?? null,
      objective,
      selected_route_key: chosen?.route_key ?? null,
      selected_label: chosen?.label ?? null,
      primary_action,
      estimated_loss_avoided_usd: Number(Math.max(0, worstLoss - chosenLoss).toFixed(2)),
      estimated_bps_saved: Number(
        Math.max(
          0,
          (ranked[ranked.length - 1]?.estimated_bps_at_risk ?? chosen?.estimated_bps_at_risk ?? 0) -
            (chosen?.estimated_bps_at_risk ?? 0),
        ).toFixed(2),
      ),
      counterfactual_worst_route_key: ranked[ranked.length - 1]?.route_key ?? null,
      ranked_candidates: ranked,
    };
  }

  getRouteRecommendations(limit = 12): ApiRouteRecommendation[] {
    const grouped = new Map<
      string,
      {
        input_mint: string | null;
        output_mint: string | null;
        routes: ApiRouteRisk[];
      }
    >();

    for (const route of this.getRouteRisks(MAX_ATTACKS)) {
      const mints = parseSurface(route.route_key).mints;
      const inputMint = mints[0] ?? null;
      const outputMint = mints[1] ?? null;
      const pairKey = [inputMint ?? "unknown", outputMint ?? "unknown"].join("->");

      if (!grouped.has(pairKey)) {
        grouped.set(pairKey, {
          input_mint: inputMint,
          output_mint: outputMint,
          routes: [],
        });
      }

      grouped.get(pairKey)!.routes.push(route);
    }

    return [...grouped.values()]
      .map((group) => {
        const ranked = [...group.routes].sort(
          (a, b) => a.risk_score - b.risk_score || a.total_extracted_usd - b.total_extracted_usd,
        );
        const recommended_routes = ranked
          .filter((route) => route.recommendation !== "avoid")
          .slice(0, 2)
          .map((route) => ({
            route_key: route.route_key,
            label: route.label,
            protocol: route.protocol,
            recommendation: route.risk_score <= 32 ? ("prefer" as const) : ("monitor" as const),
            risk_score: route.risk_score,
            rationale: [
              route.risk_score <= 32
                ? "lowest observed route-risk surface for this pair"
                : "currently safer than the higher-toxicity alternatives in this pair",
              route.bundle_share >= 45
                ? `bundle exposure is still elevated at ${route.bundle_share.toFixed(0)}%`
                : `bundle exposure is moderate at ${route.bundle_share.toFixed(0)}%`,
              route.sandwich_count > 0
                ? `${route.sandwich_count} sandwich detections observed on this surface`
                : "no sandwich detections observed in the current sample",
            ],
          }));

        const avoid_routes = ranked
          .filter((route) => route.recommendation === "avoid")
          .slice(0, 2)
          .map((route) => ({
            route_key: route.route_key,
            label: route.label,
            protocol: route.protocol,
            risk_score: route.risk_score,
            rationale: [
              `route risk score is elevated at ${route.risk_score.toFixed(0)}`,
              `${route.total_attacks} detections and ${route.unique_attackers} unique operators observed`,
              route.bundle_share >= 50
                ? "bundle-aligned execution concentration is elevated"
                : "repeat hostile execution pressure remains elevated",
            ],
          }));

        return {
          input_mint: group.input_mint,
          output_mint: group.output_mint,
          recommended_routes,
          avoid_routes,
        } satisfies ApiRouteRecommendation;
      })
      .filter((item) => item.recommended_routes.length > 0 || item.avoid_routes.length > 0)
      .sort((a, b) => {
        const aRisk = a.avoid_routes[0]?.risk_score ?? a.recommended_routes[0]?.risk_score ?? 0;
        const bRisk = b.avoid_routes[0]?.risk_score ?? b.recommended_routes[0]?.risk_score ?? 0;
        return bRisk - aRisk;
      })
      .slice(0, limit);
  }

  getLiveAlerts(limit = 20): ApiLiveAlert[] {
    return this.attacks
      .slice(0, limit)
      .map((attack) => {
        const severity =
          attack.attack_type === "sandwich" && (attack.victim_loss_usd ?? 0) >= 100
            ? "critical"
            : attack.confidence >= 0.86 || (attack.profit_usd ?? 0) >= 400
              ? "high"
              : "medium";
        const action =
          severity === "critical"
            ? "block"
            : attack.execution_lane === "jito-aligned" || (attack.bundle_likelihood ?? 0) >= 0.55
              ? "penalize"
              : "monitor";
        const route = parseSurface(attack.pool_address);
        const rationale = [
          `${attack.attack_type} detector fired at ${(attack.confidence * 100).toFixed(0)}% confidence`,
          attack.bundle_likelihood && attack.bundle_likelihood >= 0.55
            ? `bundle likelihood is elevated at ${(attack.bundle_likelihood * 100).toFixed(0)}%`
            : `execution lane classified as ${attack.execution_lane ?? "standard"}`,
          attack.victim_loss_usd
            ? `estimated user harm: $${attack.victim_loss_usd.toFixed(0)}`
            : `estimated extracted value: $${(attack.profit_usd ?? 0).toFixed(0)}`,
        ];

        return {
          id: attack.id,
          attack_type: attack.attack_type,
          severity,
          summary: `${route.label} ${attack.attack_type} activity detected`,
          action,
          route_key: attack.pool_address,
          route_label: route.label,
          protocol: route.protocol,
          validator: attack.validator,
          attacker_wallet: attack.attacker_wallet,
          confidence: Number((attack.confidence * 100).toFixed(1)),
          bundle_likelihood: Number(((attack.bundle_likelihood ?? 0) * 100).toFixed(1)),
          block_time: attack.block_time,
          rationale,
        } satisfies ApiLiveAlert;
      });
  }

  getIntegrationFeeds(limit = 20) {
    return {
      live_alerts: this.getLiveAlerts(limit),
      route_risk: this.getRouteRisks(limit),
      pool_toxicity: this.getPools(limit),
      route_recommendations: this.getRouteRecommendations(Math.min(limit, 12)),
      execution_quality: this.getExecutionQuality(limit),
      lp_protection: this.getLpProtection(limit),
      flow_segments: this.getFlowSegments(),
      source_attribution: this.getSourceAttribution(limit),
      savings_summary: this.getSavingsSummary(),
      liquidation_firewall: this.getLiquidationFirewall(Math.min(limit, 8)),
      toxic_flow_terminal: this.getToxicFlowTerminal(Math.min(limit, 8)),
    };
  }

  getToxicFlowTerminal(
    limit = 8,
    interval: ToxicFlowTerminalRecord["interval"] = "1m",
  ): ToxicFlowTerminalRecord {
    const normalizedInterval =
      interval === "1h" || interval === "15m" || interval === "5m" || interval === "1m"
        ? interval
        : "1m";
    const surfaces = this.getRouteRisks(Math.max(limit * 2, 24))
      .map((route, index) => buildToxicFlowSurface(route, index, this.attacks, this.recentSwaps, normalizedInterval))
      .sort(
        (a, b) =>
          terminalSurfaceEventCount(b) - terminalSurfaceEventCount(a) ||
          terminalSurfaceObservedValue(b) - terminalSurfaceObservedValue(a) ||
          b.risk_score - a.risk_score,
      )
      .slice(0, limit);

    return {
      generated_at: new Date().toISOString(),
      source: "chain",
      interval: normalizedInterval,
      summary: {
        surfaces_tracked: surfaces.length,
        routes_in_block: surfaces.filter((surface) => surface.action === "avoid" || surface.action === "reroute").length,
        estimated_loss_at_risk_24h_usd: round(surfaces.reduce((sum, surface) => sum + surface.loss_at_risk_24h_usd, 0), 2),
        estimated_prevented_loss_24h_usd: round(surfaces.reduce((sum, surface) => sum + surface.prevented_loss_24h_usd, 0), 2),
        highest_toxicity_route: [...surfaces].sort((a, b) => b.toxic_flow_score - a.toxic_flow_score)[0]?.label ?? null,
        safest_route: [...surfaces].sort((a, b) => a.risk_score - b.risk_score)[0]?.label ?? null,
      },
      surfaces,
    };
  }

  getExecutionQuality(limit = 20) {
    return this.getRouteRisks(Math.max(limit, 20)).slice(0, limit).map((route) => ({
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
    }));
  }

  getLpProtection(limit = 20) {
    return this.getPools(limit).map((pool) => ({
      pool_address: pool.pool_address,
      protocol: pool.protocol,
      toxicity_score: pool.toxicity_score,
      lvr_proxy_score: pool.lvr_proxy_score ?? 0,
      adverse_selection_intensity: pool.adverse_selection_intensity ?? 0,
      stale_quote_arb_frequency: pool.stale_quote_arb_frequency ?? 0,
      lp_drag_estimate_usd: pool.lp_drag_estimate_usd ?? 0,
      toxic_to_benign_volume_ratio: pool.toxic_to_benign_volume_ratio ?? 0,
      quote_freshness_stress: pool.quote_freshness_stress ?? 0,
      saved_fee_bps_if_segmented: pool.saved_fee_bps_if_segmented ?? 0,
      primary_cause: pool.primary_cause ?? "unknown",
      reason_codes: pool.reason_codes ?? [],
    }));
  }

  getFlowSegments() {
    const grouped = new Map<string, { description: string; attacks: ApiAttack[] }>();
    for (const attack of this.attacks) {
      const segment = classifyFlowSegment(attack);
      if (!grouped.has(segment.segment)) {
        grouped.set(segment.segment, { description: segment.description, attacks: [] });
      }
      grouped.get(segment.segment)!.attacks.push(attack);
    }

    const segments: FlowSegmentRecord[] = [...grouped.entries()]
      .map(([segment, entry]) => ({
        segment,
        description: entry.description,
        attack_count: entry.attacks.length,
        flow_share: round((entry.attacks.length / Math.max(1, this.attacks.length)) * 100),
        avg_confidence: round(entry.attacks.reduce((sum, attack) => sum + attack.confidence, 0) / Math.max(1, entry.attacks.length) * 100),
        avg_profit_usd: round(entry.attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0) / Math.max(1, entry.attacks.length), 2),
        toxicity_probability: round(
          clamp(
            entry.attacks.reduce((sum, attack) => sum + (((attack.tip_lamports ?? 0) >= 120_000 ? 28 : 12) + attack.confidence * 32), 0) /
              Math.max(1, entry.attacks.length),
            8,
            99,
          ),
        ),
      }))
      .sort((a, b) => b.flow_share - a.flow_share);

    return {
      segments,
      sources: this.getSourceAttribution(8),
    };
  }

  getSourceAttribution(limit = 8) {
    const grouped = new Map<
      string,
      {
        label: string;
        category: SourceAttributionRecord["category"];
        attacks: ApiAttack[];
        swaps: ParsedSwapCandidate[];
      }
    >();

    for (const swap of this.recentSwaps) {
      const rawSource = swap.source?.toLowerCase() ?? (swap.pool_address?.startsWith("route:") ? "aggregator-routed" : "wallet-originated");
      const category: SourceAttributionRecord["category"] =
        rawSource.includes("jupiter") || rawSource.includes("route") ? "aggregator" :
        rawSource.includes("jito") ? "bundle-lane" :
        rawSource.includes("liquidation") ? "liquidation" :
        rawSource.includes("raydium") || rawSource.includes("orca") || rawSource.includes("meteora") ? "searcher" :
        "wallet";
      if (!grouped.has(rawSource)) {
        grouped.set(rawSource, {
          label: rawSource,
          category,
          attacks: [],
          swaps: [],
        });
      }
      grouped.get(rawSource)!.swaps.push(swap);
    }

    for (const attack of this.attacks) {
      const meta = inferSourceLabel(attack);
      const key = meta.key;
      if (!grouped.has(key)) {
        grouped.set(key, {
          label: meta.label,
          category: meta.category,
          attacks: [],
          swaps: [],
        });
      }
      grouped.get(key)!.attacks.push(attack);
    }

    return [...grouped.values()]
      .map(({ label, category, attacks, swaps }) => {
        const avgBundle =
          (attacks.reduce((sum, attack) => sum + (((attack.tip_lamports ?? 0) >= 120_000 || attack.validator.toLowerCase().includes("jito")) ? 72 : 24), 0) +
            swaps.reduce((sum, swap) => sum + (((swap.priority_fee ?? 0) >= 120_000 || swap.validator.toLowerCase().includes("jito")) ? 72 : 18), 0)) /
          Math.max(1, attacks.length + swaps.length);
        const avgRisk =
          (attacks.reduce((sum, attack) => sum + (attack.entity_risk ?? attack.confidence), 0) +
            swaps.reduce((sum, swap) => sum + (((swap.priority_fee ?? 0) > 20_000 ? 0.74 : 0.38) + ((swap.notional_usd ?? 0) > 25_000 ? 0.08 : 0)), 0)) /
          Math.max(1, attacks.length + swaps.length);
        const toxicityProbability = round(clamp(avgRisk * 72 + avgBundle * 0.28, 6, 98));
        return {
          source_key: label,
          label,
          category,
          flow_count: attacks.length + swaps.length,
          flow_share: round(((attacks.length + swaps.length) / Math.max(1, this.attacks.length + this.recentSwaps.length)) * 100),
          flow_quality_score: round(clamp(100 - toxicityProbability * 0.72 - avgBundle * 0.12, 4, 96)),
          toxicity_probability: toxicityProbability,
          retail_likelihood: round(clamp(category === "wallet" ? 76 : 100 - toxicityProbability * 0.88, 3, 90)),
          bundle_likelihood: round(clamp(avgBundle, 4, 97)),
          lp_adverse_selection_probability: round(clamp(toxicityProbability * 0.82 + (category === "searcher" ? 12 : 0), 3, 99)),
          endorser_inference: category === "aggregator" ? "endorsed-like" : category === "searcher" ? "unendorsed" : "unknown",
        } satisfies SourceAttributionRecord;
      })
      .sort((a, b) => b.flow_share - a.flow_share)
      .slice(0, limit);
  }

  getRoutePolicies(limit = 20, objective: NonNullable<ApiRouteEvaluationRequest["objective"]> = "protect_users") {
    return this.getRouteRisks(Math.max(limit, 20))
      .slice(0, limit)
      .map((route) => ({
        route_key: route.route_key,
        label: route.label,
        objective,
        policy_action: route.policy_action,
        recommended_max_notional_usd: route.recommended_max_notional_usd,
        estimated_savings_bps: route.estimated_savings_bps,
        estimated_savings_usd: route.estimated_savings_usd,
        reason_codes: route.reason_codes,
        decomposition: route.decomposition,
      }));
  }

  private buildSavingsProof(
    evaluation: ApiRouteEvaluation,
    ranking: ApiRouteRanking | null,
    request: ApiRouteEvaluationRequest,
    action: PreventionGuardRecord["action"],
  ): SavingsProofRecord {
    const notionalUsd = Math.max(0, request.notional_usd ?? 25_000);
    const bestCandidate = ranking?.ranked_candidates[0] ?? null;
    const worstCandidate = ranking?.ranked_candidates[ranking.ranked_candidates.length - 1] ?? null;
    const bestComparableLoss = bestCandidate?.estimated_loss_usd ?? 0;
    const directPrevented =
      action === "block" || action === "reroute"
        ? Math.max(0, evaluation.estimated_loss_usd - bestComparableLoss)
        : evaluation.estimated_savings_usd ?? 0;
    const estimatedLossPreventedUsd = round(
      Math.max(
        directPrevented,
        ranking?.estimated_loss_avoided_usd ?? 0,
        action === "penalize" ? evaluation.estimated_loss_usd * 0.42 : 0,
        action === "monitor" ? evaluation.estimated_loss_usd * 0.18 : 0,
      ),
      2,
    );
    const estimatedBpsSaved = round(
      Math.max(
        ranking?.estimated_bps_saved ?? 0,
        evaluation.estimated_savings_bps ?? 0,
        bestCandidate ? evaluation.estimated_bps_at_risk - bestCandidate.estimated_bps_at_risk : 0,
      ),
      2,
    );
    const tradesPerDayAssumption =
      action === "block" || action === "reroute" ? 120 : action === "penalize" ? 80 : action === "monitor" ? 35 : 18;

    return {
      route_key: evaluation.route_key,
      selected_label: evaluation.label,
      protected_notional_usd: notionalUsd,
      estimated_loss_prevented_usd: estimatedLossPreventedUsd,
      monthly_savings_projection_usd: round(estimatedLossPreventedUsd * tradesPerDayAssumption * 30, 2),
      estimated_bps_saved: estimatedBpsSaved,
      counterfactual_route_key: worstCandidate?.route_key ?? evaluation.route_key,
      counterfactual_label: worstCandidate?.label ?? evaluation.label,
      confidence: evaluation.confidence_band,
      trades_per_day_assumption: tradesPerDayAssumption,
      proof_points: [
        `${evaluation.estimated_bps_at_risk.toFixed(2)} bps expected loss-at-risk on ${evaluation.label}`,
        bestCandidate && bestCandidate.route_key !== evaluation.route_key
          ? `${bestCandidate.label} is currently the cleanest candidate in the route set`
          : "no cleaner same-pair candidate was available, so the policy caps or blocks size",
        `${tradesPerDayAssumption} similar checks/day projects ${round(estimatedLossPreventedUsd * tradesPerDayAssumption * 30, 0).toLocaleString()} USD/month protected`,
      ],
    };
  }

  private buildProtectedSendPolicy(
    action: PreventionGuardRecord["action"],
    evaluation: ApiRouteEvaluation,
    request: ApiRouteEvaluationRequest,
  ): ProtectedSendPolicyRecord {
    const slippageBps = request.slippage_bps ?? null;
    const maxSlippageBps =
      slippageBps == null
        ? null
        : round(clamp(slippageBps - evaluation.estimated_bps_at_risk * 0.55, 5, slippageBps), 0);
    const maxNotionalUsd = evaluation.recommended_max_notional_usd ?? request.notional_usd ?? 25_000;

    if (action === "block") {
      return {
        mode: "block",
        submit_via: "do_not_submit",
        use_jito_dontfront: false,
        fail_closed: true,
        ttl_ms: 4_000,
        max_slippage_bps: maxSlippageBps,
        max_notional_usd: maxNotionalUsd,
        route_action: action,
        implementation_steps: [
          "do not submit the transaction on the current route",
          "request a fresh quote excluding the flagged venue or route key",
          "only retry if the new guard response is allow, monitor, or penalize",
        ],
        rationale: [
          "expected loss-at-risk is above the fail-closed threshold",
          "submitting publicly would expose the order to known toxic flow pressure",
        ],
      };
    }

    if (action === "reroute") {
      return {
        mode: "reroute",
        submit_via: "jito_dontfront",
        use_jito_dontfront: true,
        fail_closed: true,
        ttl_ms: 5_000,
        max_slippage_bps: maxSlippageBps,
        max_notional_usd: maxNotionalUsd,
        route_action: action,
        implementation_steps: [
          "switch to the top safer alternative returned by the guard",
          "submit through a protected/private lane with dont-front semantics when available",
          "cap notional at the recommended max until toxicity drops",
        ],
        rationale: [
          "a cleaner candidate exists for this pair",
          "private submission reduces public mempool exposure while the route is replaced",
        ],
      };
    }

    if (action === "penalize") {
      return {
        mode: "cap_and_monitor",
        submit_via: "private_rpc",
        use_jito_dontfront: false,
        fail_closed: false,
        ttl_ms: 7_500,
        max_slippage_bps: maxSlippageBps,
        max_notional_usd: maxNotionalUsd,
        route_action: action,
        implementation_steps: [
          "downrank this candidate inside the router score",
          "tighten slippage and cap size for the current quote",
          "emit the reason codes into execution analytics",
        ],
        rationale: [
          "route is not toxic enough to fully block but is too expensive to treat as neutral",
          "size and slippage controls reduce the expected value leakage",
        ],
      };
    }

    if (action === "monitor") {
      return {
        mode: "private_submit",
        submit_via: "private_rpc",
        use_jito_dontfront: false,
        fail_closed: false,
        ttl_ms: 10_000,
        max_slippage_bps: maxSlippageBps,
        max_notional_usd: maxNotionalUsd,
        route_action: action,
        implementation_steps: [
          "submit normally or through a private RPC if trade size is elevated",
          "attach the guard response to logs for post-trade markout review",
          "rescore the route if quote age or slippage changes",
        ],
        rationale: [
          "toxicity is visible but below hard intervention thresholds",
          "continued monitoring builds route-level evidence without blocking flow",
        ],
      };
    }

    return {
      mode: "standard_submit",
      submit_via: "public_rpc",
      use_jito_dontfront: false,
      fail_closed: false,
      ttl_ms: 12_000,
      max_slippage_bps: slippageBps,
      max_notional_usd: maxNotionalUsd,
      route_action: action,
      implementation_steps: [
        "submit the transaction with normal routing",
        "record the guard id and route score for execution-quality analytics",
      ],
      rationale: [
        "route is currently below toxicity thresholds",
        "no immediate private-send or reroute intervention is required",
      ],
    };
  }

  private buildCustomerImpact(): CustomerImpactRecord[] {
    return [
      {
        buyer: "wallet",
        saves: "blocks sandwich-prone swaps before the user signs or submits",
        primary_metric: "expected_loss_at_risk_usd",
      },
      {
        buyer: "router",
        saves: "downranks toxic venues and proves why the safer route was selected",
        primary_metric: "estimated_bps_saved",
      },
      {
        buyer: "lp",
        saves: "flags pools where stale quotes, JIT, and adverse selection are dragging LP returns",
        primary_metric: "lp_drag_estimate_usd",
      },
      {
        buyer: "lending",
        saves: "throttles liquidation regimes that create toxic keeper flow or bad-debt risk",
        primary_metric: "bad_debt_risk_bps",
      },
      {
        buyer: "trading-desk",
        saves: "routes large orders through safer lanes with size caps and fail-closed controls",
        primary_metric: "recommended_max_notional_usd",
      },
    ];
  }

  preventionGuard(request: ApiRouteEvaluationRequest & { candidates?: ApiRouteRankingRequest["candidates"] }): PreventionGuardRecord {
    const objective = request.objective ?? "protect_users";
    const ranking = request.candidates?.length
      ? this.rankRoutes({
          input_mint: request.input_mint,
          output_mint: request.output_mint,
          notional_usd: request.notional_usd,
          slippage_bps: request.slippage_bps,
          objective,
          candidates: request.candidates,
        })
      : null;
    const evaluation = request.route_key || request.protocol || request.input_mint || request.output_mint
      ? this.evaluateRoute(request)
      : ranking?.ranked_candidates[0] ?? this.evaluateRoute(request);

    const action =
      evaluation.decision === "avoid" ? "block" :
      evaluation.decision === "reroute" ? "reroute" :
      evaluation.decision;
    const savingsProof = this.buildSavingsProof(evaluation, ranking, request, action);
    const protectedSendPolicy = this.buildProtectedSendPolicy(action, evaluation, request);

    return {
      action,
      reason_codes: evaluation.reason_codes ?? [],
      expected_loss_at_risk_bps: evaluation.estimated_bps_at_risk,
      expected_loss_at_risk_usd: evaluation.estimated_loss_usd,
      recommended_max_notional_usd: evaluation.recommended_max_notional_usd ?? 25_000,
      selected_route_key: evaluation.route_key,
      selected_label: evaluation.label,
      safer_alternatives: evaluation.safer_alternatives,
      savings_proof: savingsProof,
      protected_send_policy: protectedSendPolicy,
      customer_impact: this.buildCustomerImpact(),
      warning:
        action === "block"
          ? `block this route now: expected loss-at-risk is ${evaluation.estimated_bps_at_risk.toFixed(1)} bps`
          : action === "reroute"
            ? `reroute flow: ${evaluation.safer_alternatives[0]?.label ?? "safer alternative"} looks materially cleaner`
            : `monitor surface closely: toxicity probability is ${(evaluation.toxicity_probability ?? 0).toFixed(0)}%`,
    };
  }

  protectedSendPlan(request: ApiRouteEvaluationRequest & { candidates?: ApiRouteRankingRequest["candidates"] }): PreventionGuardRecord {
    return this.preventionGuard(request);
  }

  getSavingsSummary(): SavingsSummaryRecord {
    const risks = this.getRouteRisks(MAX_ATTACKS);
    const pools = this.getPools(MAX_ATTACKS);
    return {
      estimated_loss_avoided_usd_24h: round(risks.reduce((sum, route) => sum + route.estimated_savings_usd, 0), 2),
      estimated_bps_saved_avg: round(risks.reduce((sum, route) => sum + route.estimated_savings_bps, 0) / Math.max(1, risks.length), 2),
      routes_flagged: risks.filter((route) => route.policy_action === "avoid" || route.policy_action === "reroute").length,
      pools_protected: pools.filter((pool) => (pool.lvr_proxy_score ?? 0) >= 45).length,
      users_protected_proxy: risks.reduce((sum, route) => sum + Math.max(1, route.total_attacks), 0),
    };
  }

  getLiquidationFirewall(limit = 8): LiquidationFirewallRecord[] {
    const markets: Array<{
      protocol: LiquidationFirewallRecord["protocol"];
      market: string;
      notional_at_risk_usd: number;
      seed_pressure: number;
    }> = [
      { protocol: "drift", market: "SOL-PERP / spot margin", notional_at_risk_usd: 1_800_000, seed_pressure: 28 },
      { protocol: "kamino", market: "SOL collateral loans", notional_at_risk_usd: 2_400_000, seed_pressure: 24 },
      { protocol: "save", market: "isolated borrow markets", notional_at_risk_usd: 1_050_000, seed_pressure: 18 },
      { protocol: "marginfi", market: "cross-margin accounts", notional_at_risk_usd: 1_650_000, seed_pressure: 32 },
    ];
    const routeRisks = this.getRouteRisks(MAX_ATTACKS);
    const liquidationAttacks = this.attacks.filter((attack) => attack.attack_type === "liquidation");

    return markets
      .map((market) => {
        const relatedRoutes = routeRisks.filter((route) =>
          route.protocol?.toLowerCase().includes(market.protocol) || route.route_key.toLowerCase().includes(market.protocol),
        );
        const relatedAttacks = this.attacks.filter((attack) =>
          attack.pool_address.toLowerCase().includes(market.protocol) || attack.attack_type === "liquidation",
        );
        const routePressure = relatedRoutes.reduce((max, route) => Math.max(max, route.toxicity_probability), 0);
        const bundlePressure = relatedRoutes.reduce((max, route) => Math.max(max, route.bundle_share), 0);
        const liquidationCount = Math.max(
          liquidationAttacks.length,
          relatedRoutes.reduce((sum, route) => sum + route.liquidation_count, 0),
        );
        const liquidationPressure = round(
          clamp(market.seed_pressure + routePressure * 0.42 + bundlePressure * 0.24 + liquidationCount * 7, 12, 98),
        );
        const toxicLiquidatorShare = round(
          clamp(relatedAttacks.reduce((sum, attack) => sum + attack.confidence * 18, 0) + bundlePressure * 0.55, 8, 96),
        );
        const badDebtRiskBps = round(clamp(liquidationPressure * 0.18 + toxicLiquidatorShare * 0.08, 1, 42), 2);
        const estimatedPreventable = round(
          market.notional_at_risk_usd * badDebtRiskBps / 10_000 +
            relatedAttacks.reduce((sum, attack) => sum + (attack.victim_loss_usd ?? attack.profit_usd ?? 0), 0) * 0.35,
          2,
        );
        const regime =
          liquidationPressure >= 84 ? "stress" :
          liquidationPressure >= 70 ? "toxic" :
          liquidationPressure >= 45 ? "watch" :
          "normal";
        const recommendedAction =
          regime === "stress" ? "pause" :
          regime === "toxic" ? "throttle" :
          regime === "watch" ? "route_private" :
          "monitor";

        return {
          protocol: market.protocol,
          market: market.market,
          regime,
          liquidation_pressure: liquidationPressure,
          toxic_liquidator_share: toxicLiquidatorShare,
          bad_debt_risk_bps: badDebtRiskBps,
          estimated_loss_preventable_usd_24h: estimatedPreventable,
          recommended_action: recommendedAction,
          reason_codes: buildReasonCodes({
            bundleShare: bundlePressure,
            toxicFlowRate: liquidationPressure,
            markout30: badDebtRiskBps,
          }),
          playbook: [
            recommendedAction === "pause"
              ? "pause risky liquidations or raise keeper requirements until the regime cools"
              : recommendedAction === "throttle"
                ? "throttle keeper access, cap liquidation size, and require fresh oracle checks"
                : recommendedAction === "route_private"
                  ? "route liquidation transactions through protected lanes and monitor post-liquidation markout"
                  : "keep the market monitored and continue collecting keeper-quality evidence",
            "compare keeper win-rate, priority fee pressure, and post-liquidation markout before widening access",
            "alert risk teams when the same operator clusters dominate liquidation flow",
          ],
        } satisfies LiquidationFirewallRecord;
      })
      .sort((a, b) => b.estimated_loss_preventable_usd_24h - a.estimated_loss_preventable_usd_24h)
      .slice(0, limit);
  }

  getPredictionMarketExecution(limit = 6) {
    return this.getRouteRisks(Math.max(limit, 12))
      .filter((route) => route.route_kind === "venue" || route.route_kind === "route")
      .slice(0, limit)
      .map((route) => ({
        market_type: "prediction",
        route_key: route.route_key,
        label: route.label,
        protocol: route.protocol,
        execution_quality_score: route.execution_quality_score,
        liquidity_stress_score: round(clamp(route.toxic_flow_rate * 0.7 + route.bundle_share * 0.22, 4, 99)),
        toxic_flow_flag: route.toxicity_probability >= 64 || route.policy_action === "avoid",
        recommended_action: route.policy_action === "avoid" ? "avoid" : route.execution_quality_score >= 60 ? "prefer" : "monitor",
        estimated_slippage_bps: route.realized_slippage_bps,
        rationale: [
          `${route.label} is scored for event-driven flow where short-lived repricing can dominate outcomes`,
          `execution quality is ${route.execution_quality_score.toFixed(0)} and markout 30s is ${route.markout_30s_bps.toFixed(1)} bps`,
        ],
      }));
  }

  getPoolDetails(address: string) {
    const toxicity = this.getPools(MAX_ATTACKS).filter((pool) => pool.pool_address === address);
    const recent_attacks = this.attacks.filter((attack) => attack.pool_address === address);
    const top_attackers = this.getEntities({ limit: String(MAX_ATTACKS) })
      .filter((entity) => recent_attacks.some((attack) => entity.sample_wallets.includes(attack.attacker_wallet)))
      .map((entity) => ({
        attacker_wallet: entity.operator_wallet ?? entity.sample_wallets[0] ?? entity.id,
        entity_id: entity.id,
        entity_label: entity.label,
        attack_count: entity.attack_count,
        profit: entity.total_profit_usd,
      }));

    return { toxicity, top_attackers, recent_attacks };
  }

  getValidators() {
    const entityContext = this.buildEntityContext();
    const swapAnalytics = this.buildSwapAnalyticsBySurface();
    const map = new Map<
      string,
      {
        validator: string;
        total_mev_attacks: number;
        unique_entities: Set<string>;
        unique_wallets: Set<string>;
        total_extracted: number;
        sandwich_count: number;
        arbitrage_count: number;
        jit_count: number;
        liquidation_count: number;
        wide_sandwich_count: number;
        confirmed_count: number;
        tips: number[];
      }
    >();

    for (const attack of this.attacks) {
      if (!map.has(attack.validator)) {
        map.set(attack.validator, {
          validator: attack.validator,
          total_mev_attacks: 0,
          unique_entities: new Set(),
          unique_wallets: new Set(),
          total_extracted: 0,
          sandwich_count: 0,
          arbitrage_count: 0,
          jit_count: 0,
          liquidation_count: 0,
          wide_sandwich_count: 0,
          confirmed_count: 0,
          tips: [],
        });
      }

      const item = map.get(attack.validator)!;
      item.total_mev_attacks += 1;
      item.unique_entities.add(entityContext.entityByWallet.get(attack.attacker_wallet)?.id ?? attack.attacker_wallet);
      item.unique_wallets.add(attack.attacker_wallet);
      item.total_extracted += attack.profit_usd ?? 0;
      item.sandwich_count += attack.attack_type === "sandwich" ? 1 : 0;
      item.arbitrage_count += attack.attack_type === "arbitrage" ? 1 : 0;
      item.jit_count += attack.attack_type === "jit" ? 1 : 0;
      item.liquidation_count += attack.attack_type === "liquidation" ? 1 : 0;
      item.wide_sandwich_count += attack.detector?.includes("wide") ? 1 : 0;
      item.confirmed_count += attack.attack_quality === "confirmed" ? 1 : 0;
      if (attack.tip_lamports) item.tips.push(attack.tip_lamports);
    }

    const totalValidatorAttacks = [...map.values()].reduce((sum, item) => sum + item.total_mev_attacks, 0);

    return [...map.values()]
      .map((item) => {
        const validatorMarkouts = [...swapAnalytics.values()]
          .flatMap((surface) => surface.validatorMarkouts.get(item.validator) ?? []);
        const sandwichShare = item.total_mev_attacks > 0 ? item.sandwich_count / item.total_mev_attacks : 0;
        const wideShare = item.sandwich_count > 0 ? item.wide_sandwich_count / item.sandwich_count : 0;
        const confirmedShare = item.total_mev_attacks > 0 ? item.confirmed_count / item.total_mev_attacks : 0;
        const entityConcentration =
          item.total_mev_attacks > 0 ? item.unique_entities.size / item.total_mev_attacks : 1;
        const avgTip =
          item.tips.length > 0 ? item.tips.reduce((sum, value) => sum + value, 0) / item.tips.length : 0;
        const feeSignal = avgTip > 0 ? Math.min(0.12, avgTip / 250000) : 0;
        const concentrationSignal = Math.max(0, 1 - entityConcentration);
        const extractionSignal =
          item.total_extracted > 0 ? Math.min(0.12, Math.log10(item.total_extracted + 1) * 0.03) : 0;
        const diversityCount = [
          item.sandwich_count,
          item.arbitrage_count,
          item.jit_count,
          item.liquidation_count,
        ].filter((count) => count > 0).length;
        const diversitySignal = diversityCount > 1 ? Math.min(0.08, (diversityCount - 1) * 0.025) : 0;
        const activitySignal = item.total_mev_attacks >= 5 ? 1 : item.total_mev_attacks / 5;
        const riskScore = Math.min(
          0.99,
          Number(
            (
              (0.08 +
                sandwichShare * 0.22 +
                wideShare * 0.16 +
                confirmedShare * 0.18 +
                diversitySignal +
                extractionSignal +
                feeSignal +
                concentrationSignal * 0.12) *
              activitySignal
            ).toFixed(2),
          ),
        );
        const jitoBundleShare = round(clamp((avgTip / 220_000) * 62 + sandwichShare * 28, 4, 97));
        const priorityFeePressure = round(clamp(avgTip / 2_500, 2, 99));
        const medianValidatorMarkout = validatorMarkouts.length > 0 ? this.median(validatorMarkouts) ?? 0 : 0;
        const markoutQualityScore = round(
          clamp(100 - sandwichShare * 72 - priorityFeePressure * 0.24 - medianValidatorMarkout * 2.6, 5, 96),
        );
        const mevShareOfFlow = round(clamp((item.total_mev_attacks / Math.max(1, totalValidatorAttacks)) * 100 * 2.4, 3, 95));
        const entityConcentrationScore = round(clamp((1 - entityConcentration) * 100, 3, 99));
        const stakeCentralizationRisk = round(
          clamp(mevShareOfFlow * 0.46 + sandwichShare * 32 + entityConcentrationScore * 0.34 + wideShare * 18, 4, 99),
        );
        const regime =
          jitoBundleShare >= 62
            ? "jito-dominant"
            : priorityFeePressure >= 58
              ? "priority-fee heavy"
              : markoutQualityScore >= 68
                ? "balanced"
                : "searcher-dense";

        return {
          validator: item.validator,
          total_mev_attacks: item.total_mev_attacks,
          unique_entities: item.unique_entities.size,
          unique_wallets: item.unique_wallets.size,
          total_extracted: item.total_extracted,
          sandwich_count: item.sandwich_count,
          arbitrage_count: item.arbitrage_count,
          jit_count: item.jit_count,
          liquidation_count: item.liquidation_count,
          wide_sandwich_count: item.wide_sandwich_count,
          wide_sandwich_share: Number((wideShare * 100).toFixed(1)),
          confirmed_share: Number((confirmedShare * 100).toFixed(1)),
          sandwich_share: Number((sandwichShare * 100).toFixed(1)),
          risk_score: riskScore,
          avg_tip_lamports: avgTip,
          jito_bundle_share: jitoBundleShare,
          priority_fee_pressure: priorityFeePressure,
          markout_quality_score: markoutQualityScore,
          mev_share_of_flow: mevShareOfFlow,
          observed_sandwich_rate: round(clamp(sandwichShare * 100, 0, 99.9), 1),
          entity_concentration_score: entityConcentrationScore,
          stake_centralization_risk: stakeCentralizationRisk,
          regime,
        };
      })
      .sort((a, b) => b.risk_score - a.risk_score || b.total_mev_attacks - a.total_mev_attacks);
  }

  getWallet(address: string) {
    const entity = this.getEntities({ limit: String(MAX_ATTACKS) }).find((item) => item.sample_wallets.includes(address));
    const walletAttacks = this.attacks.filter((attack) => attack.attacker_wallet === address);

    return {
      wallet: address,
      is_mev_actor: walletAttacks.length > 0,
      entity: entity ?? null,
      attacks: {
        attacks: walletAttacks.length,
        total_profit: this.sumProfit(walletAttacks),
        dominant_type: walletAttacks[0]?.attack_type ?? null,
      },
      label: entity
        ? {
            wallet: address,
            name: entity.label,
            source: "chain",
            confidence: entity.risk_score,
          }
        : null,
    };
  }

  private sumProfit(attacks: Array<{ profit_usd: number | null }>) {
    return attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0);
  }
}

export const liveChainService = new LiveChainService();
