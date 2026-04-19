type AttackType = "sandwich" | "arbitrage" | "jit" | "liquidation" | "backrun";

interface AttackRecord {
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
  frontrun_tx: string | null;
  victim_tx: string | null;
  backrun_tx: string | null;
}

interface EntityRecord {
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

interface PoolRecord {
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

interface RouteRiskRecord {
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

type RouteRiskAccumulator = Pick<
  RouteRiskRecord,
  | "route_key"
  | "route_kind"
  | "protocol"
  | "label"
  | "sandwich_count"
  | "arbitrage_count"
  | "jit_count"
  | "liquidation_count"
  | "backrun_count"
  | "total_attacks"
  | "total_extracted_usd"
  | "unique_attackers"
> & {
  confidence_sum: number;
  bundle_sum: number;
  attackers: Set<string>;
};

interface RouteRecommendationRecord {
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

interface LiveAlertRecord {
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

interface PreventionGuardRequest {
  input_mint?: string | null;
  output_mint?: string | null;
  notional_usd?: number | null;
  slippage_bps?: number | null;
  objective?: RouteEvaluationRequest["objective"];
  candidates?: RouteRankingRequest["candidates"];
}

interface PreventionGuardRecord {
  action: "allow" | "monitor" | "penalize" | "reroute" | "block";
  reason_codes: string[];
  expected_loss_at_risk_bps: number;
  expected_loss_at_risk_usd: number;
  recommended_max_notional_usd: number;
  selected_route_key: string | null;
  selected_label: string | null;
  safer_alternatives: RouteEvaluationRecord["safer_alternatives"];
  warning: string;
}

interface SavingsSummaryRecord {
  estimated_loss_avoided_usd_24h: number;
  estimated_bps_saved_avg: number;
  routes_flagged: number;
  pools_protected: number;
  users_protected_proxy: number;
}

interface PredictionMarketExecutionRecord {
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

interface RouteEvaluationRequest {
  input_mint?: string | null;
  output_mint?: string | null;
  protocol?: string | null;
  route_key?: string | null;
  route_label?: string | null;
  notional_usd?: number | null;
  slippage_bps?: number | null;
  objective?: "best_execution" | "protect_users" | "protect_lp" | "monitor_only";
}

interface RouteEvaluationRecord {
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

interface RouteRankingRequest {
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

interface RouteRankingRecord {
  input_mint: string | null;
  output_mint: string | null;
  objective: NonNullable<RouteRankingRequest["objective"]>;
  selected_route_key: string | null;
  selected_label: string | null;
  primary_action: "route" | "monitor" | "reroute" | "block";
  estimated_loss_avoided_usd: number;
  estimated_bps_saved?: number;
  counterfactual_worst_route_key?: string | null;
  ranked_candidates: Array<RouteEvaluationRecord & { rank: number }>;
}

interface ValidatorRecord {
  validator: string;
  total_mev_attacks: number;
  unique_entities: number;
  unique_wallets: number;
  total_extracted: number;
  sandwich_count: number;
  jit_count: number;
  avg_tip_lamports: number;
  arbitrage_count?: number;
  liquidation_count?: number;
  wide_sandwich_count?: number;
  wide_sandwich_share?: number;
  confirmed_share?: number;
  sandwich_share?: number;
  risk_score?: number;
  jito_bundle_share?: number;
  priority_fee_pressure?: number;
  markout_quality_score?: number;
  mev_share_of_flow?: number;
  regime?: string;
}

const NOW = Date.now();
const BASE_SLOT = 329_800_000;

const entities: EntityRecord[] = [
  {
    id: "entity_b91_alpha",
    label: "B91 Sandwich Cluster",
    operator_wallet: "b91MkNr9Z7JQNDYUbMuA5vfP3FDtCBVxKh7vGPnP9bm",
    first_seen: new Date(NOW - 6 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(NOW - 2 * 60 * 1000).toISOString(),
    total_profit_usd: 184230,
    profit_24h_usd: 22480,
    profit_7d_usd: 118400,
    attack_count: 392,
    victim_count: 307,
    dominant_strategy: "sandwich",
    strategies_used: ["sandwich", "backrun"],
    risk_score: 0.92,
    fee_aggression: 0.87,
    position_dominance: 0.91,
    pool_concentration: 0.82,
    profit_consistency: 0.88,
    wallet_count: 4,
    sample_wallets: [
      "b91MkNr9Z7JQNDYUbMuA5vfP3FDtCBVxKh7vGPnP9bm",
      "9vaFZf1V4zW8j5n4U8w7v7d2x8yT8s4T1r7qX5mA9uP",
    ],
  },
  {
    id: "entity_orca_arb",
    label: "Orca Cross-Pool Arb",
    operator_wallet: "ARBotXVjkWdx9jQ7xNfLJjP4G7Xsdf9kPNsVMFf3k5z",
    first_seen: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(NOW - 4 * 60 * 1000).toISOString(),
    total_profit_usd: 128940,
    profit_24h_usd: 16420,
    profit_7d_usd: 84210,
    attack_count: 514,
    victim_count: 0,
    dominant_strategy: "arbitrage",
    strategies_used: ["arbitrage"],
    risk_score: 0.74,
    fee_aggression: 0.69,
    position_dominance: 0.65,
    pool_concentration: 0.72,
    profit_consistency: 0.93,
    wallet_count: 3,
    sample_wallets: [
      "ARBotXVjkWdx9jQ7xNfLJjP4G7Xsdf9kPNsVMFf3k5z",
      "52nqv4Qk9UPkC91g3jPQt4P4mTVXxb93x7m7GYz9EWxJ",
    ],
  },
  {
    id: "entity_jit_labs",
    label: "JIT Liquidity Desk",
    operator_wallet: "J1TLabsT7Q2m3LQm1w3sB2c6m8bQ7rN6v2cW8x4z7kL",
    first_seen: new Date(NOW - 14 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(NOW - 11 * 60 * 1000).toISOString(),
    total_profit_usd: 73120,
    profit_24h_usd: 9080,
    profit_7d_usd: 40210,
    attack_count: 141,
    victim_count: 24,
    dominant_strategy: "jit",
    strategies_used: ["jit", "arbitrage"],
    risk_score: 0.61,
    fee_aggression: 0.58,
    position_dominance: 0.54,
    pool_concentration: 0.77,
    profit_consistency: 0.81,
    wallet_count: 2,
    sample_wallets: [
      "J1TLabsT7Q2m3LQm1w3sB2c6m8bQ7rN6v2cW8x4z7kL",
      "7yCkPp9J4mSxQ8Kk4bP8nS3rU2vY5fL6tP1jN7wR2dM",
    ],
  },
];

const attacks: AttackRecord[] = [
  {
    id: 1,
    attack_type: "sandwich",
    slot: BASE_SLOT + 12,
    block_time: new Date(NOW - 35 * 1000).toISOString(),
    validator: "Jito-Validator-Alpha",
    attacker_wallet: entities[0].sample_wallets[0],
    entity_id: entities[0].id,
    entity_label: entities[0].label,
    entity_risk: entities[0].risk_score,
    victim_wallet: "5fHq3Vn2D8sW4mK1pQ7xT9zL2nR4vB6cD8eF1gH2jK3",
    victim_loss_usd: 412.17,
    pool_address: "route:raydium_amm:So11111111111111111111111111111111111111112->EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    token_mint: "So11111111111111111111111111111111111111112",
    profit_usd: 1382.4,
    tip_lamports: 190000,
    confidence: 0.94,
    frontrun_tx: "3o8dSandwichFront111111111111111111111111111111",
    victim_tx: "7r2vVictim111111111111111111111111111111111111",
    backrun_tx: "5n9kSandwichBack11111111111111111111111111111",
  },
  {
    id: 2,
    attack_type: "arbitrage",
    slot: BASE_SLOT + 11,
    block_time: new Date(NOW - 95 * 1000).toISOString(),
    validator: "Stakewiz-Pro-12",
    attacker_wallet: entities[1].sample_wallets[0],
    entity_id: entities[1].id,
    entity_label: entities[1].label,
    entity_risk: entities[1].risk_score,
    victim_wallet: null,
    victim_loss_usd: null,
    pool_address: "venue:orca_whirlpool:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v->So11111111111111111111111111111111111111112",
    token_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    profit_usd: 672.08,
    tip_lamports: 94000,
    confidence: 0.88,
    frontrun_tx: null,
    victim_tx: null,
    backrun_tx: null,
  },
  {
    id: 3,
    attack_type: "jit",
    slot: BASE_SLOT + 10,
    block_time: new Date(NOW - 3 * 60 * 1000).toISOString(),
    validator: "Jito-Validator-Beta",
    attacker_wallet: entities[2].sample_wallets[0],
    entity_id: entities[2].id,
    entity_label: entities[2].label,
    entity_risk: entities[2].risk_score,
    victim_wallet: "9dVg4tR2mL8pZ6qW4vH2dT7kB1sN9aQ3cF5eJ7uP1mR",
    victim_loss_usd: 145.26,
    pool_address: "venue:meteora_dlmm:So11111111111111111111111111111111111111112->EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    token_mint: null,
    profit_usd: 518.33,
    tip_lamports: 123000,
    confidence: 0.86,
    frontrun_tx: "8m2pJitAdd11111111111111111111111111111111111",
    victim_tx: "4u6nVictimSwap1111111111111111111111111111111",
    backrun_tx: "2q9rJitRemove11111111111111111111111111111111",
  },
  {
    id: 4,
    attack_type: "backrun",
    slot: BASE_SLOT + 8,
    block_time: new Date(NOW - 6 * 60 * 1000).toISOString(),
    validator: "Marinade-Node-7",
    attacker_wallet: entities[0].sample_wallets[1],
    entity_id: entities[0].id,
    entity_label: entities[0].label,
    entity_risk: entities[0].risk_score,
    victim_wallet: null,
    victim_loss_usd: null,
    pool_address: "pair:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v->So11111111111111111111111111111111111111112",
    token_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    profit_usd: 284.91,
    tip_lamports: 54000,
    confidence: 0.79,
    frontrun_tx: null,
    victim_tx: "7u3nVictimSpot1111111111111111111111111111111",
    backrun_tx: "9k1mBackrun111111111111111111111111111111111",
  },
  {
    id: 5,
    attack_type: "liquidation",
    slot: BASE_SLOT + 7,
    block_time: new Date(NOW - 9 * 60 * 1000).toISOString(),
    validator: "Jito-Validator-Gamma",
    attacker_wallet: entities[1].sample_wallets[1],
    entity_id: entities[1].id,
    entity_label: entities[1].label,
    entity_risk: entities[1].risk_score,
    victim_wallet: "3mRk5wT8qP1sB7dN4xH2cL9vY6uF3jQ8tW1eR5zK2nM",
    victim_loss_usd: 923.1,
    pool_address: "venue:marginfi:So11111111111111111111111111111111111111112->EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    token_mint: "So11111111111111111111111111111111111111112",
    profit_usd: 1604.72,
    tip_lamports: 211000,
    confidence: 0.83,
    frontrun_tx: null,
    victim_tx: "1q2wLiquidationVictim111111111111111111111111",
    backrun_tx: "4e5rLiquidationBot111111111111111111111111111",
  },
];

const pools: PoolRecord[] = [
  {
    pool_address: attacks[0].pool_address,
    epoch: 712,
    protocol: "raydium",
    sandwich_count: 81,
    arbitrage_count: 12,
    jit_count: 3,
    total_attacks: 104,
    total_extracted_usd: 48810,
    unique_attackers: 9,
    toxicity_score: 86,
    top_entity_id: entities[0].id,
    top_entity_label: entities[0].label,
    top_entity_risk: entities[0].risk_score,
  },
  {
    pool_address: attacks[1].pool_address,
    epoch: 712,
    protocol: "orca",
    sandwich_count: 6,
    arbitrage_count: 74,
    jit_count: 11,
    total_attacks: 97,
    total_extracted_usd: 39240,
    unique_attackers: 14,
    toxicity_score: 69,
    top_entity_id: entities[1].id,
    top_entity_label: entities[1].label,
    top_entity_risk: entities[1].risk_score,
  },
  {
    pool_address: attacks[2].pool_address,
    epoch: 712,
    protocol: "meteora",
    sandwich_count: 9,
    arbitrage_count: 17,
    jit_count: 22,
    total_attacks: 58,
    total_extracted_usd: 18490,
    unique_attackers: 6,
    toxicity_score: 58,
    top_entity_id: entities[2].id,
    top_entity_label: entities[2].label,
    top_entity_risk: entities[2].risk_score,
  },
];

const validators: ValidatorRecord[] = [
  {
    validator: "Jito-Validator-Alpha",
    total_mev_attacks: 141,
    unique_entities: 2,
    unique_wallets: 6,
    total_extracted: 72910,
    sandwich_count: 83,
    jit_count: 12,
    avg_tip_lamports: 148000,
  },
  {
    validator: "Stakewiz-Pro-12",
    total_mev_attacks: 104,
    unique_entities: 2,
    unique_wallets: 5,
    total_extracted: 48110,
    sandwich_count: 18,
    jit_count: 8,
    avg_tip_lamports: 102000,
  },
  {
    validator: "Marinade-Node-7",
    total_mev_attacks: 72,
    unique_entities: 3,
    unique_wallets: 8,
    total_extracted: 29220,
    sandwich_count: 11,
    jit_count: 5,
    avg_tip_lamports: 71000,
  },
];

const TOKEN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};

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

function sortByNewest<T extends { block_time: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime(),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function inferSourceLabel(attack: AttackRecord) {
  const surface = parseSurface(attack.pool_address);
  const validator = attack.validator.toLowerCase();

  if (attack.attack_type === "liquidation") {
    return { key: "protocol-liquidation", label: "protocol liquidation flow", category: "liquidation" as const };
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

function classifyFlowSegment(attack: AttackRecord) {
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

function buildStats() {
  const totalExtracted = attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0);
  const victims = new Set(attacks.map((attack) => attack.victim_wallet).filter(Boolean));

  return {
    total_attacks: attacks.length,
    attacks_24h: attacks.length,
    attacks_1h: attacks.filter(
      (attack) => Date.now() - new Date(attack.block_time).getTime() <= 60 * 60 * 1000,
    ).length,
    total_extracted_usd: totalExtracted,
    extracted_24h: totalExtracted,
    total_entities: entities.length,
    total_wallets: new Set(attacks.map((attack) => attack.attacker_wallet)).size,
    total_victims: victims.size,
    sandwich_count: attacks.filter((attack) => attack.attack_type === "sandwich").length,
    arb_count: attacks.filter((attack) => attack.attack_type === "arbitrage").length,
    jit_count: attacks.filter((attack) => attack.attack_type === "jit").length,
  };
}

export function getStats() {
  return buildStats();
}

export function getAttacks(params: {
  type?: string;
  pool?: string;
  limit?: string;
  offset?: string;
  since?: string;
}) {
  let results = sortByNewest(attacks);

  if (params.type) {
    results = results.filter((attack) => attack.attack_type === params.type);
  }

  if (params.pool) {
    results = results.filter((attack) => attack.pool_address === params.pool);
  }

  if (params.since) {
    const sinceTs = new Date(params.since).getTime();
    if (!Number.isNaN(sinceTs)) {
      results = results.filter(
        (attack) => new Date(attack.block_time).getTime() > sinceTs,
      );
    }
  }

  const offset = Number.parseInt(params.offset ?? "0", 10) || 0;
  const limit = Number.parseInt(params.limit ?? "50", 10) || 50;
  return results.slice(offset, offset + limit);
}

export function getEntities(params: {
  strategy?: string;
  min_risk?: string;
  sort?: string;
  limit?: string;
  offset?: string;
}) {
  let results = [...entities];

  if (params.strategy) {
    results = results.filter((entity) =>
      entity.strategies_used.includes(params.strategy as AttackType),
    );
  }

  if (params.min_risk) {
    const minRisk = Number.parseFloat(params.min_risk);
    if (!Number.isNaN(minRisk)) {
      results = results.filter((entity) => entity.risk_score >= minRisk);
    }
  }

  const sort = params.sort ?? "profit";
  if (sort === "attacks") {
    results.sort((a, b) => b.attack_count - a.attack_count);
  } else if (sort === "risk") {
    results.sort((a, b) => b.risk_score - a.risk_score);
  } else {
    results.sort((a, b) => b.total_profit_usd - a.total_profit_usd);
  }

  const offset = Number.parseInt(params.offset ?? "0", 10) || 0;
  const limit = Number.parseInt(params.limit ?? "50", 10) || 50;
  return results.slice(offset, offset + limit);
}

export function getEntity(id: string) {
  const entity = entities.find((item) => item.id === id);
  if (!entity) return null;

  const recentAttacks = sortByNewest(
    attacks.filter((attack) => attack.entity_id === entity.id),
  );
  const targetedPools = pools
    .filter((pool) => pool.top_entity_id === entity.id)
    .map((pool) => ({
      pool_address: pool.pool_address,
      attack_count: pool.total_attacks,
      total_profit: pool.total_extracted_usd,
    }));
  const validatorMap = new Map<string, number>();
  for (const attack of recentAttacks) {
    validatorMap.set(attack.validator, (validatorMap.get(attack.validator) ?? 0) + 1);
  }
  const validatorCorrelation = [...validatorMap.entries()]
    .map(([validator, attackCount]) => ({ validator, attacks: attackCount }))
    .sort((a, b) => b.attacks - a.attacks);
  const wallets = entity.sample_wallets.map((wallet, index) => ({
    wallet,
    role: index === 0 ? "operator" : "executor",
    tx_count: 40 - index * 9,
    operator_label: index === 0 ? entity.label : null,
  }));
  const profit_timeline = Array.from({ length: 7 }, (_, idx) => {
    const day = new Date(NOW - (6 - idx) * 24 * 60 * 60 * 1000);
    const baseline = entity.profit_7d_usd / 7;
    return {
      day: day.toISOString(),
      profit: Math.round(baseline * (0.7 + idx * 0.08)),
      attacks: Math.max(1, Math.round(entity.attack_count / 14) + idx),
    };
  });

  return {
    entity,
    wallets,
    recent_attacks: recentAttacks,
    targeted_pools: targetedPools,
    validator_correlation: validatorCorrelation,
    profit_timeline,
  };
}

export function getPools(limit = 50) {
  return [...pools]
    .map((pool) => ({
      ...pool,
      protocol: pool.protocol ?? parseSurface(pool.pool_address).protocol,
      lvr_proxy_score:
        pool.lvr_proxy_score ??
        round(clamp(pool.toxicity_score * 0.72 + pool.arbitrage_count * 0.5 + pool.sandwich_count * 0.3, 8, 99)),
      adverse_selection_intensity:
        pool.adverse_selection_intensity ??
        round(clamp(pool.sandwich_count * 0.7 + pool.arbitrage_count * 0.48 + pool.jit_count * 0.42, 4, 99)),
      stale_quote_arb_frequency:
        pool.stale_quote_arb_frequency ??
        round(clamp((pool.arbitrage_count / Math.max(1, pool.total_attacks)) * 100, 1, 95)),
      lp_drag_estimate_usd:
        pool.lp_drag_estimate_usd ?? round(pool.total_extracted_usd * 0.74, 2),
      toxic_to_benign_volume_ratio:
        pool.toxic_to_benign_volume_ratio ??
        round(clamp(pool.toxicity_score / Math.max(12, 100 - pool.toxicity_score), 0.1, 9.9), 2),
      quote_freshness_stress:
        pool.quote_freshness_stress ??
        round(clamp(pool.toxicity_score * 0.82 + pool.arbitrage_count * 0.35, 5, 99)),
      saved_fee_bps_if_segmented:
        pool.saved_fee_bps_if_segmented ?? round(clamp(pool.toxicity_score * 0.11, 0.4, 12), 2),
      primary_cause:
        pool.primary_cause ??
        (pool.sandwich_count >= pool.arbitrage_count && pool.sandwich_count >= pool.jit_count
          ? "sandwich pressure"
          : pool.arbitrage_count >= pool.jit_count
            ? "stale quote arbitrage"
            : "jit liquidity pressure"),
      reason_codes:
        pool.reason_codes ??
        buildReasonCodes({
          sandwichRate: pool.sandwich_count / Math.max(1, pool.total_attacks),
          staleQuotePickupRate: (pool.arbitrage_count / Math.max(1, pool.total_attacks)) * 100,
          lvrProxyScore: pool.lvr_proxy_score ?? pool.toxicity_score * 0.72,
          toxicFlowRate: pool.toxicity_score,
        }),
    }))
    .sort((a, b) => b.toxicity_score - a.toxicity_score)
    .slice(0, limit);
}

export function getPoolDetails(address: string) {
  const toxicity = pools.filter((pool) => pool.pool_address === address);
  const recentAttacks = sortByNewest(
    attacks.filter((attack) => attack.pool_address === address),
  );
  const topAttackers = recentAttacks.map((attack) => ({
    attacker_wallet: attack.attacker_wallet,
    entity_id: attack.entity_id,
    entity_label: attack.entity_label,
    attack_count: 1,
    profit: attack.profit_usd ?? 0,
  }));

  return {
    toxicity,
    top_attackers: topAttackers,
    recent_attacks: recentAttacks,
  };
}

export function getValidators() {
  const totalAttacks = validators.reduce((sum, validator) => sum + validator.total_mev_attacks, 0);
  return validators.map((validator) => {
    const jitoBundleShare = round(
      clamp((validator.avg_tip_lamports / 220_000) * 62 + (validator.sandwich_count / Math.max(1, validator.total_mev_attacks)) * 28, 4, 97),
    );
    const priorityFeePressure = round(clamp(validator.avg_tip_lamports / 2_500, 2, 99));
    const markoutQualityScore = round(
      clamp(100 - (validator.sandwich_count / Math.max(1, validator.total_mev_attacks)) * 72 - priorityFeePressure * 0.24, 5, 96),
    );
    const mevShareOfFlow = round(clamp((validator.total_mev_attacks / Math.max(1, totalAttacks)) * 100 * 2.4, 3, 95));
    const regime =
      jitoBundleShare >= 62
        ? "jito-dominant"
        : priorityFeePressure >= 58
          ? "priority-fee heavy"
          : markoutQualityScore >= 68
            ? "balanced"
            : "searcher-dense";

    return {
      ...validator,
      arbitrage_count: Math.max(4, Math.round(validator.total_mev_attacks * 0.18)),
      liquidation_count: Math.max(2, Math.round(validator.total_mev_attacks * 0.06)),
      wide_sandwich_count: Math.round(validator.sandwich_count * 0.28),
      wide_sandwich_share: round((validator.sandwich_count * 0.28 / Math.max(1, validator.sandwich_count)) * 100),
      confirmed_share: round(clamp(62 + jitoBundleShare * 0.18, 44, 96)),
      sandwich_share: round((validator.sandwich_count / Math.max(1, validator.total_mev_attacks)) * 100),
      risk_score: round(clamp((validator.sandwich_count / Math.max(1, validator.total_mev_attacks)) * 0.58 + jitoBundleShare / 100 * 0.24 + priorityFeePressure / 100 * 0.18, 0.08, 0.97), 2),
      jito_bundle_share: jitoBundleShare,
      priority_fee_pressure: priorityFeePressure,
      markout_quality_score: markoutQualityScore,
      mev_share_of_flow: mevShareOfFlow,
      regime,
    };
  });
}

export function getRouteRisks(limit = 25): RouteRiskRecord[] {
  const grouped = new Map<string, RouteRiskAccumulator>();

  for (const attack of attacks) {
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
        total_attacks: 1,
        total_extracted_usd: attack.profit_usd ?? 0,
        unique_attackers: 0,
        confidence_sum: attack.confidence ?? 0,
        bundle_sum:
          attack.validator.toLowerCase().includes("jito") || (attack.tip_lamports ?? 0) >= 120_000 ? 0.64 : 0.22,
        attackers: new Set([attack.attacker_wallet]),
      });
      continue;
    }

    existing.total_attacks += 1;
    existing.total_extracted_usd += attack.profit_usd ?? 0;
    existing.confidence_sum += attack.confidence ?? 0;
    existing.bundle_sum +=
      attack.validator.toLowerCase().includes("jito") || (attack.tip_lamports ?? 0) >= 120_000 ? 0.64 : 0.22;
    existing.attackers.add(attack.attacker_wallet);
    existing.sandwich_count += attack.attack_type === "sandwich" ? 1 : 0;
    existing.arbitrage_count += attack.attack_type === "arbitrage" ? 1 : 0;
    existing.jit_count += attack.attack_type === "jit" ? 1 : 0;
    existing.liquidation_count += attack.attack_type === "liquidation" ? 1 : 0;
    existing.backrun_count += attack.attack_type === "backrun" ? 1 : 0;
  }

  return [...grouped.values()]
    .map((item) => {
      const avgConfidence = item.total_attacks > 0 ? item.confidence_sum / item.total_attacks : 0;
      const bundleShare = item.total_attacks > 0 ? item.bundle_sum / item.total_attacks : 0;
      const sandwichRate = item.total_attacks > 0 ? item.sandwich_count / item.total_attacks : 0;
      const backrunRate = item.total_attacks > 0 ? item.backrun_count / item.total_attacks : 0;
      const arbitrageRate = item.total_attacks > 0 ? item.arbitrage_count / item.total_attacks : 0;
      const jitRate = item.total_attacks > 0 ? item.jit_count / item.total_attacks : 0;
      const riskScore = Math.min(
        100,
        Number(
          (
            item.sandwich_count * 16 +
            item.backrun_count * 10 +
            item.jit_count * 8 +
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
        clamp(sandwichRate * 58 + backrunRate * 32 + jitRate * 18 + arbitrageRate * 14 + item.attackers.size * 2.5, 3, 99),
      );
      const staleQuotePickupRate = round(clamp(arbitrageRate * 48 + sandwichRate * 36 + bundleShare * 18, 1, 98));
      const quoteFreshnessMs = round(clamp(920 - riskScore * 5.2 - item.total_attacks * 13, 65, 980), 0);
      const realizedSlippageBps = round(clamp(riskScore * 0.07 + sandwichRate * 8 + bundleShare * 3.8, 0.8, 28), 2);
      const markout1 = round(clamp(realizedSlippageBps * 0.6 + sandwichRate * 2.2 + bundleShare * 0.15, 0.5, 18), 2);
      const markout5 = round(clamp(realizedSlippageBps * 0.95 + sandwichRate * 4.1 + staleQuotePickupRate * 0.05, 0.8, 26), 2);
      const markout30 = round(clamp(realizedSlippageBps * 1.2 + sandwichRate * 5.5 + staleQuotePickupRate * 0.08, 1, 32), 2);
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
      const sourceHint = item.route_kind === "route" ? "aggregator-routed" : bundleShare >= 0.55 ? "bundle-lane" : "searcher-bot";

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
      } satisfies RouteRiskRecord;
    })
    .sort((a, b) => b.risk_score - a.risk_score || b.total_extracted_usd - a.total_extracted_usd)
    .slice(0, limit);
}

function estimateBpsAtRisk(
  route: Pick<RouteRiskRecord, "risk_score" | "bundle_share" | "total_attacks" | "avg_confidence">,
  objective: NonNullable<RouteEvaluationRequest["objective"]>,
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

function classifyRouteDecision(
  route: Pick<RouteRiskRecord, "risk_score" | "bundle_share">,
  objective: NonNullable<RouteEvaluationRequest["objective"]>,
  estimatedBpsAtRisk: number,
  saferAlternativesCount: number,
): RouteEvaluationRecord["decision"] {
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

function confidenceBand(route: Pick<RouteRiskRecord, "total_attacks" | "avg_confidence">): RouteEvaluationRecord["confidence_band"] {
  if (route.total_attacks >= 5 && route.avg_confidence >= 78) return "high";
  if (route.total_attacks >= 2 && route.avg_confidence >= 58) return "medium";
  return "exploratory";
}

function matchRouteRisk(query: RouteEvaluationRequest, routeRisks: RouteRiskRecord[]) {
  if (query.route_key) {
    const exact = routeRisks.find((route) => route.route_key === query.route_key);
    if (exact) return { route: exact, matched_on: "route_key" as const };
  }

  const inputMint = query.input_mint ?? null;
  const outputMint = query.output_mint ?? null;

  if (query.protocol && inputMint && outputMint) {
    const protocolPair = routeRisks.find((route) => {
      const surface = parseSurface(route.route_key);
      return route.protocol === query.protocol && surface.mints[0] === inputMint && surface.mints[1] === outputMint;
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

export function evaluateRoute(request: RouteEvaluationRequest): RouteEvaluationRecord {
  const objective = request.objective ?? "best_execution";
  const routeRisks = getRouteRisks(100);
  const { route, matched_on } = matchRouteRisk(request, routeRisks);
  const selected = route ?? routeRisks[0];

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

  const estimatedBpsAtRisk = estimateBpsAtRisk(selected, objective);
  const notionalUsd = Math.max(0, request.notional_usd ?? 25_000);
  const estimatedLossUsd = Number(((notionalUsd * estimatedBpsAtRisk) / 10_000).toFixed(2));
  const saferAlternatives = pairMatches.map((route) => ({
    route_key: route.route_key,
    label: route.label,
    protocol: route.protocol,
    risk_score: route.risk_score,
    estimated_bps_saved: Number(Math.max(0, estimatedBpsAtRisk - estimateBpsAtRisk(route, objective)).toFixed(2)),
  }));
  const decision = classifyRouteDecision(selected, objective, estimatedBpsAtRisk, saferAlternatives.length);

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
    confidence_band: confidenceBand(selected),
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

export function rankRoutes(request: RouteRankingRequest): RouteRankingRecord {
  const objective = request.objective ?? "best_execution";
  const ranked = request.candidates
    .map((candidate) =>
      evaluateRoute({
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

  return {
    input_mint: request.input_mint ?? null,
    output_mint: request.output_mint ?? null,
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

export function getRouteRecommendations(limit = 12): RouteRecommendationRecord[] {
  const grouped = new Map<
    string,
    {
      input_mint: string | null;
      output_mint: string | null;
      routes: RouteRiskRecord[];
    }
  >();

  for (const route of getRouteRisks(100)) {
    const mints = parseSurface(route.route_key).mints;
    const pairKey = [mints[0] ?? "unknown", mints[1] ?? "unknown"].join("->");
    if (!grouped.has(pairKey)) {
      grouped.set(pairKey, {
        input_mint: mints[0] ?? null,
        output_mint: mints[1] ?? null,
        routes: [],
      });
    }
    grouped.get(pairKey)!.routes.push(route);
  }

  return [...grouped.values()]
    .map((group) => {
      const ranked = [...group.routes].sort((a, b) => a.risk_score - b.risk_score);
      return {
        input_mint: group.input_mint,
        output_mint: group.output_mint,
        recommended_routes: ranked
          .filter((route) => route.recommendation !== "avoid")
          .slice(0, 2)
          .map((route) => ({
            route_key: route.route_key,
            label: route.label,
            protocol: route.protocol,
            recommendation: route.risk_score <= 32 ? "prefer" : "monitor",
            risk_score: route.risk_score,
            rationale: [
              "lowest observed route-risk surface in the sample",
              route.bundle_share >= 45
                ? `bundle exposure remains elevated at ${route.bundle_share.toFixed(0)}%`
                : `bundle exposure is moderate at ${route.bundle_share.toFixed(0)}%`,
            ],
          })),
        avoid_routes: ranked
          .filter((route) => route.recommendation === "avoid")
          .slice(0, 2)
          .map((route) => ({
            route_key: route.route_key,
            label: route.label,
            protocol: route.protocol,
            risk_score: route.risk_score,
            rationale: [
              `route risk score is elevated at ${route.risk_score.toFixed(0)}`,
              `${route.total_attacks} detections observed on this route`,
            ],
          })),
      } satisfies RouteRecommendationRecord;
    })
    .filter((entry) => entry.recommended_routes.length > 0 || entry.avoid_routes.length > 0)
    .slice(0, limit);
}

export function getLiveAlerts(limit = 20): LiveAlertRecord[] {
  return sortByNewest(attacks)
    .slice(0, limit)
    .map((attack) => {
      const bundleLikelihood =
        attack.validator.toLowerCase().includes("jito") || (attack.tip_lamports ?? 0) >= 120_000 ? 64 : 22;
      const severity =
        attack.attack_type === "sandwich" && (attack.victim_loss_usd ?? 0) >= 100
          ? "critical"
          : attack.confidence >= 0.86 || (attack.profit_usd ?? 0) >= 400
            ? "high"
            : "medium";
      const route = parseSurface(attack.pool_address);
      return {
        id: attack.id,
        attack_type: attack.attack_type,
        severity,
        summary: `${route.label} ${attack.attack_type} activity detected`,
        action: severity === "critical" ? "block" : bundleLikelihood >= 50 ? "penalize" : "monitor",
        route_key: attack.pool_address,
        route_label: route.label,
        protocol: route.protocol,
        validator: attack.validator,
        attacker_wallet: attack.attacker_wallet,
        confidence: Number((attack.confidence * 100).toFixed(1)),
        bundle_likelihood: bundleLikelihood,
        block_time: attack.block_time,
        rationale: [
          `${attack.attack_type} detector fired at ${(attack.confidence * 100).toFixed(0)}% confidence`,
          bundleLikelihood >= 50 ? "bundle-aligned execution likelihood is elevated" : "standard execution lane classification",
          attack.victim_loss_usd
            ? `estimated user harm: $${attack.victim_loss_usd.toFixed(0)}`
            : `estimated extracted value: $${(attack.profit_usd ?? 0).toFixed(0)}`,
        ],
      } satisfies LiveAlertRecord;
    });
}

export function getIntegrationFeeds(limit = 20) {
  return {
    live_alerts: getLiveAlerts(limit),
    route_risk: getRouteRisks(limit),
    pool_toxicity: getPools(limit),
    route_recommendations: getRouteRecommendations(Math.min(limit, 12)),
    execution_quality: getExecutionQuality(limit),
    lp_protection: getLpProtection(limit),
    flow_segments: getFlowSegments(),
    source_attribution: getSourceAttribution(limit),
    savings_summary: getSavingsSummary(),
  };
}

export function getExecutionQuality(limit = 20) {
  return getRouteRisks(Math.max(limit, 20)).slice(0, limit).map((route) => ({
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

export function getLpProtection(limit = 20) {
  return getPools(limit).map((pool) => ({
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

export function getFlowSegments() {
  const grouped = new Map<string, { description: string; attacks: AttackRecord[] }>();
  for (const attack of attacks) {
    const segment = classifyFlowSegment(attack);
    if (!grouped.has(segment.segment)) {
      grouped.set(segment.segment, { description: segment.description, attacks: [] });
    }
    grouped.get(segment.segment)!.attacks.push(attack);
  }

  const segments: FlowSegmentRecord[] = [...grouped.entries()].map(([segment, entry]) => ({
    segment,
    description: entry.description,
    attack_count: entry.attacks.length,
    flow_share: round((entry.attacks.length / Math.max(1, attacks.length)) * 100),
    avg_confidence: round(entry.attacks.reduce((sum, attack) => sum + attack.confidence, 0) / Math.max(1, entry.attacks.length) * 100),
    avg_profit_usd: round(entry.attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0) / Math.max(1, entry.attacks.length), 2),
    toxicity_probability: round(
      clamp(
        entry.attacks.reduce((sum, attack) => sum + ((attack.tip_lamports ?? 0) >= 120_000 ? 28 : 12) + attack.confidence * 32, 0) /
          Math.max(1, entry.attacks.length),
        8,
        99,
      ),
    ),
  })).sort((a, b) => b.flow_share - a.flow_share);

  return {
    segments,
    sources: getSourceAttribution(8),
  };
}

export function getSourceAttribution(limit = 8) {
  const grouped = new Map<string, { meta: ReturnType<typeof inferSourceLabel>; attacks: AttackRecord[] }>();
  for (const attack of attacks) {
    const meta = inferSourceLabel(attack);
    if (!grouped.has(meta.key)) grouped.set(meta.key, { meta, attacks: [] });
    grouped.get(meta.key)!.attacks.push(attack);
  }

  return [...grouped.values()]
    .map(({ meta, attacks: sourceAttacks }) => {
      const avgBundle = sourceAttacks.reduce((sum, attack) => sum + (((attack.tip_lamports ?? 0) >= 120_000 || attack.validator.toLowerCase().includes("jito")) ? 72 : 24), 0) / Math.max(1, sourceAttacks.length);
      const avgRisk = sourceAttacks.reduce((sum, attack) => sum + (attack.entity_risk ?? attack.confidence), 0) / Math.max(1, sourceAttacks.length);
      const toxicityProbability = round(clamp(avgRisk * 72 + avgBundle * 0.28, 6, 98));
      return {
        source_key: meta.key,
        label: meta.label,
        category: meta.category,
        flow_count: sourceAttacks.length,
        flow_share: round((sourceAttacks.length / Math.max(1, attacks.length)) * 100),
        flow_quality_score: round(clamp(100 - toxicityProbability * 0.72 - avgBundle * 0.12, 4, 96)),
        toxicity_probability: toxicityProbability,
        retail_likelihood: round(clamp(meta.category === "wallet" ? 76 : 100 - toxicityProbability * 0.88, 3, 90)),
        bundle_likelihood: round(clamp(avgBundle, 4, 97)),
        lp_adverse_selection_probability: round(clamp(toxicityProbability * 0.82 + (meta.category === "searcher" ? 12 : 0), 3, 99)),
        endorser_inference: meta.category === "aggregator" ? "endorsed-like" : meta.category === "searcher" ? "unendorsed" : "unknown",
      } satisfies SourceAttributionRecord;
    })
    .sort((a, b) => b.flow_share - a.flow_share)
    .slice(0, limit);
}

export function preventionGuard(request: PreventionGuardRequest): PreventionGuardRecord {
  const objective = request.objective ?? "protect_users";
  const ranking = request.candidates?.length
    ? rankRoutes({
        input_mint: request.input_mint,
        output_mint: request.output_mint,
        notional_usd: request.notional_usd,
        slippage_bps: request.slippage_bps,
        objective,
        candidates: request.candidates,
      })
    : null;
  const evaluation = ranking?.ranked_candidates[0]
    ? ranking.ranked_candidates[0]
    : evaluateRoute({
        input_mint: request.input_mint,
        output_mint: request.output_mint,
        notional_usd: request.notional_usd,
        slippage_bps: request.slippage_bps,
        objective,
      });

  const action =
    evaluation.decision === "avoid" ? "block" :
    evaluation.decision === "reroute" ? "reroute" :
    evaluation.decision;

  return {
    action,
    reason_codes: evaluation.reason_codes ?? [],
    expected_loss_at_risk_bps: evaluation.estimated_bps_at_risk,
    expected_loss_at_risk_usd: evaluation.estimated_loss_usd,
    recommended_max_notional_usd: evaluation.recommended_max_notional_usd ?? request.notional_usd ?? 0,
    selected_route_key: evaluation.route_key,
    selected_label: evaluation.label,
    safer_alternatives: evaluation.safer_alternatives,
    warning:
      action === "block"
        ? `block this route now: expected loss-at-risk is ${evaluation.estimated_bps_at_risk.toFixed(1)} bps`
        : action === "reroute"
          ? `reroute flow: ${evaluation.safer_alternatives[0]?.label ?? "safer alternative"} looks materially cleaner`
          : `monitor surface closely: toxicity probability is ${(evaluation.toxicity_probability ?? 0).toFixed(0)}%`,
  };
}

export function getSavingsSummary(): SavingsSummaryRecord {
  const risks = getRouteRisks(100);
  const pools = getPools(100);
  return {
    estimated_loss_avoided_usd_24h: round(risks.reduce((sum, route) => sum + route.estimated_savings_usd, 0), 2),
    estimated_bps_saved_avg: round(risks.reduce((sum, route) => sum + route.estimated_savings_bps, 0) / Math.max(1, risks.length), 2),
    routes_flagged: risks.filter((route) => route.policy_action === "avoid" || route.policy_action === "reroute").length,
    pools_protected: pools.filter((pool) => (pool.lvr_proxy_score ?? 0) >= 45).length,
    users_protected_proxy: risks.reduce((sum, route) => sum + Math.max(1, route.total_attacks), 0),
  };
}

export function getPredictionMarketExecution(limit = 6) {
  return getRouteRisks(Math.max(limit, 12))
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
    } satisfies PredictionMarketExecutionRecord));
}

export function getWallet(address: string) {
  const entity = entities.find((item) => item.sample_wallets.includes(address)) ?? null;
  const walletAttacks = attacks.filter((attack) => attack.attacker_wallet === address);

  return {
    wallet: address,
    is_mev_actor: walletAttacks.length > 0 || Boolean(entity),
    entity,
    attacks: {
      attacks: walletAttacks.length,
      total_profit: walletAttacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0),
      dominant_type: walletAttacks[0]?.attack_type ?? null,
    },
    label: entity
      ? {
          wallet: address,
          name: entity.label,
          source: "demo",
          confidence: entity.risk_score,
        }
      : null,
  };
}
