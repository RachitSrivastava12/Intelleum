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
}

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
  return validators;
}

export function getRouteRisks(limit = 25): RouteRiskRecord[] {
  const grouped = new Map<
    string,
    Omit<RouteRiskRecord, "avg_confidence" | "risk_score" | "recommendation" | "bundle_share"> & {
      confidence_sum: number;
      bundle_sum: number;
      attackers: Set<string>;
    }
  >();

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
    ],
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
  };
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
