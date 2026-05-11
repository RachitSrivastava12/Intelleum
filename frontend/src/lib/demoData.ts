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
  {
    id: "entity_launch_hunter",
    label: "Launch Hunter Cluster",
    operator_wallet: "L4unch9pQx3Vt7hD2nM8kP1sR5wY9aF4uJ6cB2mN8qK",
    first_seen: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(now - 7 * 60 * 1000).toISOString(),
    total_profit_usd: 44120,
    profit_24h_usd: 6120,
    profit_7d_usd: 22140,
    attack_count: 88,
    victim_count: 12,
    dominant_strategy: "liquidity_snipe" as any,
    strategies_used: ["liquidity_snipe" as any, "liquidity_drain" as any],
    risk_score: 0.67,
    fee_aggression: 0.64,
    position_dominance: 0.72,
    pool_concentration: 0.84,
    profit_consistency: 0.73,
    wallet_count: 3,
    sample_wallets: [
      "L4unch9pQx3Vt7hD2nM8kP1sR5wY9aF4uJ6cB2mN8qK",
      "9sN1p3R8uD5mQ2kC7wX4aB6tY1vP8jL3fH2gM5zN7qR",
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
  {
    id: 4,
    attack_type: "liquidity_snipe",
    slot: 329800009,
    block_time: new Date(now - 4 * 60 * 1000).toISOString(),
    validator: "Jito-Validator-Gamma",
    attacker_wallet: entities[3].sample_wallets[0],
    entity_id: entities[3].id,
    entity_label: entities[3].label,
    entity_risk: entities[3].risk_score,
    victim_wallet: "PoolDeployr9H2mQ7sL1vB4xD6nR3wT8pC5jK7yM2fQ4",
    victim_loss_usd: null,
    pool_address: "venue:raydium_launchpad:So11111111111111111111111111111111111111112->LaunchToken111111111111111111111111111111",
    token_mint: "LaunchToken111111111111111111111111111111",
    profit_usd: null,
    tip_lamports: 164000,
    confidence: 0.88,
    detector: "launch_liquidity_snipe",
    evidence: [
      "new pool creation was followed immediately by the first buy",
      "buy landed in the same slot as initialization",
      "launch-sensitive route showed first-fill capture behavior",
    ],
    frontrun_tx: "LaunchCreate1111111111111111111111111111111111",
    victim_tx: "LaunchFirstBuy11111111111111111111111111111111",
    backrun_tx: null,
  },
  {
    id: 5,
    attack_type: "liquidity_drain",
    slot: 329800008,
    block_time: new Date(now - 6 * 60 * 1000).toISOString(),
    validator: "Jito-Validator-Gamma",
    attacker_wallet: entities[3].sample_wallets[1],
    entity_id: entities[3].id,
    entity_label: entities[3].label,
    entity_risk: entities[3].risk_score,
    victim_wallet: null,
    victim_loss_usd: null,
    pool_address: "venue:raydium_amm:DrainToken111111111111111111111111111111->So11111111111111111111111111111111111111112",
    token_mint: "DrainToken111111111111111111111111111111",
    profit_usd: 1920.42,
    tip_lamports: 72000,
    confidence: 0.9,
    detector: "liquidity_drain_with_dump",
    evidence: [
      "liquidity was removed aggressively from the pool surface",
      "same signer followed with a dump-style swap shortly after removal",
      "removal looked non-passive and materially destabilizing",
    ],
    frontrun_tx: "DrainRemove111111111111111111111111111111111",
    victim_tx: null,
    backrun_tx: "DrainDump1111111111111111111111111111111111",
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
    lvr_proxy_score: 78,
    adverse_selection_intensity: 84,
    stale_quote_arb_frequency: 12,
    lp_drag_estimate_usd: 36119,
    toxic_to_benign_volume_ratio: 6.14,
    quote_freshness_stress: 81,
    saved_fee_bps_if_segmented: 9.5,
    primary_cause: "sandwich pressure",
    reason_codes: ["high_sandwich_concentration", "lp_adverse_selection", "toxic_flow_dominance"],
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
    lvr_proxy_score: 72,
    adverse_selection_intensity: 63,
    stale_quote_arb_frequency: 76,
    lp_drag_estimate_usd: 29037.6,
    toxic_to_benign_volume_ratio: 2.23,
    quote_freshness_stress: 71,
    saved_fee_bps_if_segmented: 7.6,
    primary_cause: "stale quote arbitrage",
    reason_codes: ["stale_quote_pickups", "lp_adverse_selection"],
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
    lvr_proxy_score: 54,
    adverse_selection_intensity: 51,
    stale_quote_arb_frequency: 29,
    lp_drag_estimate_usd: 13682.6,
    toxic_to_benign_volume_ratio: 1.38,
    quote_freshness_stress: 57,
    saved_fee_bps_if_segmented: 6.1,
    primary_cause: "jit liquidity pressure",
    reason_codes: ["bundle_lane_pressure", "monitor_surface"],
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
    execution_quality_score: 18,
    toxic_flow_rate: 91,
    realized_slippage_bps: 14.8,
    stale_quote_pickup_rate: 52,
    quote_freshness_ms: 118,
    markout_1s_bps: 9.6,
    markout_5s_bps: 15.2,
    markout_30s_bps: 20.4,
    flow_quality_score: 12,
    toxicity_probability: 95,
    retail_likelihood: 6,
    lp_adverse_selection_probability: 88,
    lvr_proxy_score: 82,
    priority_fee_pressure: 56,
    validator_markout_quality: 22,
    source_hint: "aggregator-routed",
    recommended_max_notional_usd: 14000,
    estimated_savings_bps: 11.4,
    estimated_savings_usd: 15.96,
    order_flow_imbalance: 58.4,
    lp_annual_loss_rate_pct: 28.2,
    lp_annual_loss_usd_estimate: 3948,
    policy_action: "avoid",
    reason_codes: ["high_sandwich_concentration", "bundle_lane_pressure", "markout_deterioration", "lp_adverse_selection"],
    decomposition: [
      { label: "sandwich_concentration", value: 66 },
      { label: "stale_quote_pickups", value: 52 },
      { label: "bundle_pressure", value: 67 },
      { label: "markout_deterioration", value: 61 },
      { label: "lp_adverse_selection", value: 82 },
    ],
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
    execution_quality_score: 47,
    toxic_flow_rate: 61,
    realized_slippage_bps: 7.2,
    stale_quote_pickup_rate: 79,
    quote_freshness_ms: 294,
    markout_1s_bps: 4.6,
    markout_5s_bps: 8.7,
    markout_30s_bps: 12.5,
    flow_quality_score: 43,
    toxicity_probability: 67,
    retail_likelihood: 24,
    lp_adverse_selection_probability: 73,
    lvr_proxy_score: 76,
    priority_fee_pressure: 38,
    validator_markout_quality: 44,
    source_hint: "searcher-bot",
    recommended_max_notional_usd: 52000,
    estimated_savings_bps: 6.2,
    estimated_savings_usd: 32.24,
    order_flow_imbalance: 34.1,
    lp_annual_loss_rate_pct: 17.6,
    lp_annual_loss_usd_estimate: 9152,
    policy_action: "reroute",
    reason_codes: ["stale_quote_pickups", "lp_adverse_selection"],
    decomposition: [
      { label: "sandwich_concentration", value: 6 },
      { label: "stale_quote_pickups", value: 79 },
      { label: "bundle_pressure", value: 44 },
      { label: "markout_deterioration", value: 38 },
      { label: "lp_adverse_selection", value: 76 },
    ],
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
    execution_quality_score: 58,
    toxic_flow_rate: 54,
    realized_slippage_bps: 5.8,
    stale_quote_pickup_rate: 34,
    quote_freshness_ms: 362,
    markout_1s_bps: 3.4,
    markout_5s_bps: 6.5,
    markout_30s_bps: 9.1,
    flow_quality_score: 52,
    toxicity_probability: 59,
    retail_likelihood: 31,
    lp_adverse_selection_probability: 49,
    lvr_proxy_score: 52,
    priority_fee_pressure: 34,
    validator_markout_quality: 55,
    source_hint: "bundle-lane",
    recommended_max_notional_usd: 71000,
    estimated_savings_bps: 4.1,
    estimated_savings_usd: 29.11,
    order_flow_imbalance: 22.7,
    lp_annual_loss_rate_pct: 12.1,
    lp_annual_loss_usd_estimate: 8591,
    policy_action: "penalize",
    reason_codes: ["bundle_lane_pressure", "monitor_surface"],
    decomposition: [
      { label: "sandwich_concentration", value: 16 },
      { label: "stale_quote_pickups", value: 34 },
      { label: "bundle_pressure", value: 38 },
      { label: "markout_deterioration", value: 27 },
      { label: "lp_adverse_selection", value: 52 },
    ],
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
  liquidity_snipe_count: attacks.filter((attack) => attack.attack_type === "liquidity_snipe").length,
  liquidity_drain_count: attacks.filter((attack) => attack.attack_type === "liquidity_drain").length,
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
    liquiditySnipeCandidates: 1,
    liquidityDrainCandidates: 1,
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
  liquidity_snipe_candidates: index % 2,
  liquidity_drain_candidates: 1 + (index % 2),
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
  const related_surfaces = pools
    .filter((pool) => pool.top_entity_id === id)
    .map((pool, index) => ({
      surface: pool.pool_address,
      wallet_count: Math.max(2, entity.wallet_count - (index > 1 ? 1 : 0)),
      attacks: pool.total_attacks,
      total_profit: pool.total_extracted_usd,
    }));
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
      exposure_share: Number((100 / Math.max(1, recent_attacks.length)).toFixed(1)),
      validator_risk: entity.risk_score,
      observed_sandwich_rate: entity.dominant_strategy === "sandwich" ? 62 : 18,
      stake_centralization_risk: entity.risk_score >= 0.7 ? 71 : 44,
      recommended_action: entity.risk_score >= 0.7 ? "reroute" : "monitor",
    })),
    cluster_evidence: {
      shared_surface_count: related_surfaces.length,
      shared_validator_count: Math.max(1, Math.min(entity.wallet_count, 3)),
      shared_strategy_count: entity.strategies_used.length,
      coordinated_window_count: Math.max(2, Math.round(entity.attack_count / 6)),
    },
    related_surfaces,
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
