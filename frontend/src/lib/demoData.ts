import type {
  Attack,
  EngineSnapshot,
  Entity,
  EntityDetail,
  GlobalStats,
  LiveAlert,
  PoolToxicity,
  RouteRecommendation,
  RouteRisk,
  SystemStatus,
} from "@/lib/api";

const now = Date.now();

const entities: Entity[] = [
  {
    id: "entity_b91_alpha",
    label: "B91 Sandwich Cluster",
    operator_wallet: "b91MkNr9Z7JQNDYUbMuA5vfP3FDtCBVxKh7vGPnP9bm",
    first_seen: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(now - 2 * 60 * 1000).toISOString(),
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
    first_seen: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(now - 4 * 60 * 1000).toISOString(),
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
    first_seen: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(now - 11 * 60 * 1000).toISOString(),
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

const attacks: Attack[] = [
  {
    id: 1,
    attack_type: "sandwich",
    slot: 329800012,
    block_time: new Date(now - 35 * 1000).toISOString(),
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
    detector: "parsed_swap_sandwich",
    evidence: [
      "same pool route detected around victim swap",
      "attacker reappeared with reverse direction after victim",
      "price impact and profit leg confirmed",
    ],
    frontrun_tx: "3o8dSandwichFront111111111111111111111111111111",
    victim_tx: "7r2vVictim111111111111111111111111111111111111",
    backrun_tx: "5n9kSandwichBack11111111111111111111111111111",
  },
  {
    id: 2,
    attack_type: "arbitrage",
    slot: 329800011,
    block_time: new Date(now - 95 * 1000).toISOString(),
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
    detector: "parsed_swap_arbitrage",
    evidence: [
      "same signer touched multiple pools",
      "stablecoin profit leg observed",
      "route-aware parsed swap candidate",
    ],
    frontrun_tx: null,
    victim_tx: null,
    backrun_tx: null,
  },
  {
    id: 3,
    attack_type: "jit",
    slot: 329800010,
    block_time: new Date(now - 3 * 60 * 1000).toISOString(),
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
    detector: "raw_delta_jit",
    evidence: [
      "in-slot LP add/remove pattern detected",
      "victim swap observed between LP legs",
      "profit extracted on removal leg",
    ],
    frontrun_tx: "8m2pJitAdd11111111111111111111111111111111111",
    victim_tx: "4u6nVictimSwap1111111111111111111111111111111",
    backrun_tx: "2q9rJitRemove11111111111111111111111111111111",
  },
];

const pools: PoolToxicity[] = [
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

const routeRisks: RouteRisk[] = [
  {
    route_key: attacks[0].pool_address,
    route_kind: "route",
    protocol: "raydium_amm",
    label: "RAYDIUM_AMM route • SOL / USDC",
    sandwich_count: 81,
    arbitrage_count: 12,
    jit_count: 3,
    liquidation_count: 0,
    backrun_count: 18,
    total_attacks: 122,
    total_extracted_usd: 62450,
    unique_attackers: 11,
    avg_confidence: 91,
    bundle_share: 67,
    risk_score: 93,
    recommendation: "avoid",
  },
  {
    route_key: attacks[1].pool_address,
    route_kind: "venue",
    protocol: "orca_whirlpool",
    label: "ORCA_WHIRLPOOL venue • USDC / SOL",
    sandwich_count: 6,
    arbitrage_count: 74,
    jit_count: 11,
    liquidation_count: 0,
    backrun_count: 9,
    total_attacks: 100,
    total_extracted_usd: 41820,
    unique_attackers: 14,
    avg_confidence: 86,
    bundle_share: 44,
    risk_score: 71,
    recommendation: "penalize",
  },
  {
    route_key: attacks[2].pool_address,
    route_kind: "venue",
    protocol: "meteora_dlmm",
    label: "METEORA_DLMM venue • SOL / USDC",
    sandwich_count: 9,
    arbitrage_count: 17,
    jit_count: 22,
    liquidation_count: 2,
    backrun_count: 5,
    total_attacks: 55,
    total_extracted_usd: 22140,
    unique_attackers: 7,
    avg_confidence: 84,
    bundle_share: 38,
    risk_score: 61,
    recommendation: "penalize",
  },
];

const routeRecommendations: RouteRecommendation[] = [
  {
    input_mint: "So11111111111111111111111111111111111111112",
    output_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    recommended_routes: [
      {
        route_key: attacks[2].pool_address,
        label: "METEORA_DLMM venue • SOL / USDC",
        protocol: "meteora_dlmm",
        recommendation: "monitor",
        risk_score: 61,
        rationale: [
          "currently safer than the most toxic route in this pair",
          "bundle exposure remains moderate relative to the raydium route",
        ],
      },
    ],
    avoid_routes: [
      {
        route_key: attacks[0].pool_address,
        label: "RAYDIUM_AMM route • SOL / USDC",
        protocol: "raydium_amm",
        risk_score: 93,
        rationale: [
          "repeat sandwich pressure is materially elevated",
          "bundle-aligned execution concentration is high",
        ],
      },
    ],
  },
];

const liveAlerts: LiveAlert[] = attacks.map((attack) => ({
  id: attack.id,
  attack_type: attack.attack_type,
  severity:
    attack.attack_type === "sandwich" && (attack.victim_loss_usd ?? 0) >= 100 ? "critical" : attack.confidence >= 0.86 ? "high" : "medium",
  summary: `${routeRisks.find((route) => route.route_key === attack.pool_address)?.label ?? attack.pool_address} ${attack.attack_type} activity detected`,
  action:
    attack.attack_type === "sandwich" && (attack.victim_loss_usd ?? 0) >= 100
      ? "block"
      : (attack.tip_lamports ?? 0) >= 120_000 || attack.validator.toLowerCase().includes("jito")
        ? "penalize"
        : "monitor",
  route_key: attack.pool_address,
  route_label: routeRisks.find((route) => route.route_key === attack.pool_address)?.label ?? attack.pool_address,
  protocol: routeRisks.find((route) => route.route_key === attack.pool_address)?.protocol ?? null,
  validator: attack.validator,
  attacker_wallet: attack.attacker_wallet,
  confidence: Number((attack.confidence * 100).toFixed(1)),
  bundle_likelihood:
    attack.validator.toLowerCase().includes("jito") || (attack.tip_lamports ?? 0) >= 120_000 ? 64 : 22,
  block_time: attack.block_time,
  rationale: [
    `${attack.attack_type} detector fired at ${(attack.confidence * 100).toFixed(0)}% confidence`,
    attack.validator.toLowerCase().includes("jito") ? "jito-aligned execution lane observed" : "standard execution lane observed",
    attack.victim_loss_usd
      ? `estimated user harm: $${attack.victim_loss_usd.toFixed(0)}`
      : `estimated extracted value: $${(attack.profit_usd ?? 0).toFixed(0)}`,
  ],
}));

export const demoStats: GlobalStats = {
  total_attacks: attacks.length,
  attacks_24h: attacks.length,
  attacks_1h: attacks.length,
  total_extracted_usd: attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0),
  extracted_24h: attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0),
  total_entities: entities.length,
  total_wallets: new Set(attacks.map((attack) => attack.attacker_wallet)).size,
  total_victims: new Set(attacks.map((attack) => attack.victim_wallet).filter(Boolean)).size,
  sandwich_count: attacks.filter((attack) => attack.attack_type === "sandwich").length,
  arb_count: attacks.filter((attack) => attack.attack_type === "arbitrage").length,
  jit_count: attacks.filter((attack) => attack.attack_type === "jit").length,
};

export const demoSystemStatus: SystemStatus = {
  mode: "fallback",
  heliusConfigured: false,
  started: false,
  syncing: false,
  lastProcessedSlot: null,
  latestChainSlot: null,
  blocksProcessed: 0,
  attacksDetected: attacks.length,
  lastSyncAt: null,
  lastError: "Backend unreachable. Showing demo intelligence feed.",
  recentMetrics: {
    candidateRows: 18,
    detectedAttacks: attacks.length,
    parsedTransactions: 18,
    parsedSwaps: 9,
    rawSlotTxs: 42,
    sandwichCandidates: 2,
    arbitrageCandidates: 1,
    jitCandidates: 1,
    liquidationCandidates: 0,
    suspiciousCandidates: 3,
    backrunCandidates: 1,
  },
  recentAttackPreview: attacks.map((attack) => ({
    attack_type: attack.attack_type,
    detector: attack.detector ?? "demo",
    confidence: attack.confidence,
    slot: attack.slot,
  })),
};

export const demoEngineHistory: EngineSnapshot[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  mode: "fallback",
  last_processed_slot: 329800000 + index * 3,
  latest_chain_slot: 329800002 + index * 3,
  blocks_processed: 30 + index * 4,
  attacks_detected: Math.min(attacks.length + index, 18),
  parsed_transactions: 25 + index * 3,
  parsed_swaps: 10 + index * 2,
  raw_slot_txs: 90 + index * 5,
  sandwich_candidates: 2 + (index % 3),
  arbitrage_candidates: 1 + (index % 2),
  jit_candidates: 1,
  liquidation_candidates: index % 2,
  suspicious_candidates: 2 + (index % 2),
  backrun_candidates: 1 + (index % 2),
  last_error: null,
  created_at: new Date(now - index * 5 * 60 * 1000).toISOString(),
}));

export function getDemoAttacks(params?: {
  type?: string;
  pool?: string;
  limit?: string;
  since?: string;
}): Attack[] {
  let result = [...attacks].sort(
    (a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime(),
  );

  if (params?.type) result = result.filter((attack) => attack.attack_type === params.type);
  if (params?.pool) result = result.filter((attack) => attack.pool_address === params.pool);
  if (params?.since) {
    const since = new Date(params.since).getTime();
    result = result.filter((attack) => new Date(attack.block_time).getTime() > since);
  }

  const limit = Number.parseInt(params?.limit ?? "50", 10) || 50;
  return result.slice(0, limit);
}

export function getDemoEntities(params?: {
  strategy?: string;
  min_risk?: string;
  sort?: string;
  limit?: string;
}): Entity[] {
  let result = [...entities];

  if (params?.strategy) {
    result = result.filter((entity) => entity.strategies_used.includes(params.strategy!));
  }

  if (params?.min_risk) {
    const minRisk = Number.parseFloat(params.min_risk);
    result = result.filter((entity) => entity.risk_score >= minRisk);
  }

  if (params?.sort === "attacks") {
    result.sort((a, b) => b.attack_count - a.attack_count);
  } else if (params?.sort === "risk") {
    result.sort((a, b) => b.risk_score - a.risk_score);
  } else {
    result.sort((a, b) => b.total_profit_usd - a.total_profit_usd);
  }

  const limit = Number.parseInt(params?.limit ?? "50", 10) || 50;
  return result.slice(0, limit);
}

export function getDemoEntity(id: string): EntityDetail | null {
  const entity = entities.find((item) => item.id === id);
  if (!entity) return null;

  const recent_attacks = attacks.filter((attack) => attack.entity_id === id);
  return {
    ...entity,
    wallets: entity.sample_wallets.map((wallet, index) => ({
      wallet,
      role: index === 0 ? "operator" : "executor",
      tx_count: 40 - index * 10,
      operator_label: index === 0 ? entity.label : null,
    })),
    recent_attacks,
    targeted_pools: pools
      .filter((pool) => pool.top_entity_id === id)
      .map((pool) => ({
        pool_address: pool.pool_address,
        attack_count: pool.total_attacks,
        total_profit: pool.total_extracted_usd,
      })),
    validator_correlation: recent_attacks.map((attack) => ({
      validator: attack.validator,
      attacks: 1,
    })),
    profit_timeline: Array.from({ length: 7 }, (_, index) => ({
      day: new Date(now - (6 - index) * 24 * 60 * 60 * 1000).toISOString(),
      profit: Math.round(entity.profit_7d_usd / 7),
      attacks: Math.max(1, Math.round(entity.attack_count / 14)),
    })),
  };
}

export function getDemoPools(limit = 50): PoolToxicity[] {
  return [...pools].slice(0, limit);
}

export function getDemoRouteRisks(limit = 25): RouteRisk[] {
  return [...routeRisks].slice(0, limit);
}

export function getDemoRouteRecommendations(limit = 12): RouteRecommendation[] {
  return [...routeRecommendations].slice(0, limit);
}

export function getDemoLiveAlerts(limit = 20): LiveAlert[] {
  return [...liveAlerts].slice(0, limit);
}
