// ============================================================
// KNOWN DEX PROGRAM IDs ON SOLANA
// Sources: docs.raydium.io, Solana docs, Jito docs, Helius Enhanced Transactions docs
// ============================================================

// ─── Raydium AMM v4 instruction opcodes (byte 0 of instruction data) ─────────
// Source: github.com/raydium-io/raydium-amm/blob/master/program/src/instruction.rs
export const RAYDIUM_AMM_V4_OPCODES: Record<number, string> = {
  3:  "Deposit",
  4:  "Withdraw",
  9:  "SwapBaseIn",
  11: "SwapBaseOut",
  16: "SwapBaseInV2",   // no OpenBook — modern variant
  17: "SwapBaseOutV2",
};

export const RAYDIUM_AMM_V4_SWAP_OPCODES = new Set([9, 11, 16, 17]);
export const RAYDIUM_AMM_V4_LIQUIDITY_OPCODES = new Set([3, 4]);

// ─── Raydium product metadata ─────────────────────────────────────────────────
// Program IDs are fixed security boundaries. Fee tiers, LaunchLab curve params,
// protocol/fund shares, and admin ownership are intentionally read from live
// Raydium config endpoints or chain accounts instead of hardcoded tables.

export const RAYDIUM_PROGRAM_IDS = {
  LAUNCHLAB: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
  CPMM: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  AMM_V4: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  STABLE_AMM: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h",
  CLMM: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  ROUTER: "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS",
} as const;

export const RAYDIUM_CONFIG_ENDPOINTS = {
  INFO: "https://api-v3.raydium.io/main/info",
  CPMM_CONFIG: "https://api-v3.raydium.io/main/cpmm-config",
  CLMM_CONFIG: "https://api-v3.raydium.io/main/clmm-config",
  DEVNET_INFO: "https://api-v3-devnet.raydium.io/main/info",
} as const;

// ─── Orca product metadata ────────────────────────────────────────────────────
// Orca Whirlpools is a CLMM. The program ID and config addresses are fixed
// boundaries, while pool fees, tick spacing, adaptive-fee state, and Token-2022
// badges must be read from the Whirlpool / FeeTier / Oracle / TokenBadge state.

export const ORCA_PROGRAM_IDS = {
  WHIRLPOOL: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  LEGACY_V1: "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1",
  LEGACY_V2: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
} as const;

export const ORCA_CONFIG_ENDPOINTS = {
  PROTOCOL: "https://api.orca.so/v2/solana/protocol",
  POOLS: "https://api.orca.so/v2/solana/pools",
  POOL_SEARCH: "https://api.orca.so/v2/solana/pools/search",
} as const;

export const ORCA_CHAIN_CONFIGS = {
  MAINNET_WHIRLPOOLS_CONFIG: "2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ",
  MAINNET_CONFIG_EXTENSION: "777H5H3Tp9U11uRVRzFwM8BinfiakbaLT8vQpeuhvEiH",
  DEVNET_WHIRLPOOLS_CONFIG: "FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR",
  DEVNET_CONFIG_EXTENSION: "475EJ7JqnRpVLoFVzp2ruEYvWWMCf6Z8KMWRujtXXNSU",
} as const;

export type OrcaProtocol = "orca_whirlpool" | "orca_legacy_v1" | "orca_legacy_v2";

export type OrcaProgramMeta = {
  protocol: OrcaProtocol;
  programId: string;
  label: string;
  product: "concentrated_liquidity" | "legacy_constant_product";
  docsUrl: string;
  configEndpoint: string | null;
  feeSource: string;
  primaryRisks: string[];
  guardrails: string[];
  riskWeight: number;
};

export const ORCA_PROGRAM_METADATA: Record<OrcaProtocol, OrcaProgramMeta> = {
  orca_whirlpool: {
    protocol: "orca_whirlpool",
    programId: ORCA_PROGRAM_IDS.WHIRLPOOL,
    label: "Orca Whirlpool",
    product: "concentrated_liquidity",
    docsUrl: "https://docs.orca.so/developers/architecture/whirlpool-parameters",
    configEndpoint: ORCA_CONFIG_ENDPOINTS.POOLS,
    feeSource: "Whirlpool, FeeTier, AdaptiveFeeTier/Oracle, TickArray, and TokenBadge accounts",
    primaryRisks: [
      "jit_liquidity",
      "tick_array_staleness",
      "adaptive_fee_volatility",
      "token_extension_badge_risk",
      "lp_adverse_selection",
    ],
    guardrails: [
      "read Whirlpool feeRate, protocolFeeRate, tickSpacing, and adaptive-fee state before scoring",
      "track add/swap/remove windows around active tick arrays",
      "prefer V2 instructions and validate Token-2022 badge/extension risk",
      "cap size when adaptive fees or tick crossings imply elevated volatility",
    ],
    riskWeight: 1.15,
  },
  orca_legacy_v1: {
    protocol: "orca_legacy_v1",
    programId: ORCA_PROGRAM_IDS.LEGACY_V1,
    label: "Orca Legacy v1",
    product: "legacy_constant_product",
    docsUrl: "https://docs.orca.so/",
    configEndpoint: null,
    feeSource: "legacy pool state",
    primaryRisks: ["sandwich", "stale_quote_backrun", "lp_adverse_selection"],
    guardrails: ["treat as legacy AMM flow", "prefer Whirlpool routes when liquidity and toxicity are cleaner"],
    riskWeight: 1.03,
  },
  orca_legacy_v2: {
    protocol: "orca_legacy_v2",
    programId: ORCA_PROGRAM_IDS.LEGACY_V2,
    label: "Orca Legacy v2",
    product: "legacy_constant_product",
    docsUrl: "https://docs.orca.so/",
    configEndpoint: null,
    feeSource: "legacy pool state",
    primaryRisks: ["sandwich", "stale_quote_backrun", "lp_adverse_selection"],
    guardrails: ["treat as legacy AMM flow", "prefer Whirlpool routes when liquidity and toxicity are cleaner"],
    riskWeight: 1.04,
  },
};

export type RaydiumProtocol =
  | "raydium_amm_v4"
  | "raydium_cpmm"
  | "raydium_clmm"
  | "raydium_launchlab"
  | "raydium_stable_amm"
  | "raydium_router";

export type RaydiumProgramMeta = {
  protocol: RaydiumProtocol;
  programId: string;
  label: string;
  product:
    | "constant_product"
    | "concentrated_liquidity"
    | "bonding_curve_launch"
    | "stable_swap"
    | "router";
  docsUrl: string;
  configEndpoint: string | null;
  feeSource: string;
  primaryRisks: string[];
  guardrails: string[];
  riskWeight: number;
};

export const RAYDIUM_PROGRAM_METADATA: Record<RaydiumProtocol, RaydiumProgramMeta> = {
  raydium_amm_v4: {
    protocol: "raydium_amm_v4",
    programId: RAYDIUM_PROGRAM_IDS.AMM_V4,
    label: "Raydium AMM v4",
    product: "constant_product",
    docsUrl: "https://docs.raydium.io/protocol-overview/versions-and-migration",
    configEndpoint: null,
    feeSource: "per-pool legacy AMM v4 state; AMM v4 fee structure is frozen for new fee tiers",
    primaryRisks: ["sandwich", "stale_quote_backrun", "lp_adverse_selection"],
    guardrails: ["prefer CPMM/CLMM when same-pair liquidity is cleaner", "cap stale quotes and large public swaps"],
    riskWeight: 1.08,
  },
  raydium_cpmm: {
    protocol: "raydium_cpmm",
    programId: RAYDIUM_PROGRAM_IDS.CPMM,
    label: "Raydium CPMM",
    product: "constant_product",
    docsUrl: "https://docs.raydium.io/products/cpmm/fees",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.CPMM_CONFIG,
    feeSource: "AmmConfig trade_fee_rate, creator_fee_rate, protocol_fee_rate, and fund_fee_rate",
    primaryRisks: ["sandwich", "creator_fee_misread", "stale_quote_backrun", "lp_adverse_selection"],
    guardrails: ["read AmmConfig before quoting", "segment toxic orderflow", "downrank high markout pools"],
    riskWeight: 1.12,
  },
  raydium_clmm: {
    protocol: "raydium_clmm",
    programId: RAYDIUM_PROGRAM_IDS.CLMM,
    label: "Raydium CLMM",
    product: "concentrated_liquidity",
    docsUrl: "https://raydium.mintlify.app/products/clmm/fees",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.CLMM_CONFIG,
    feeSource: "CLMM AmmConfig for trade fee, protocol/fund shares, and tick spacing",
    primaryRisks: ["jit_liquidity", "tick_range_fee_capture", "lp_adverse_selection"],
    guardrails: ["track add/swap/remove sequences", "compare fee growth against passive LP share", "cap flow during JIT clusters"],
    riskWeight: 1.16,
  },
  raydium_launchlab: {
    protocol: "raydium_launchlab",
    programId: RAYDIUM_PROGRAM_IDS.LAUNCHLAB,
    label: "Raydium LaunchLab",
    product: "bonding_curve_launch",
    docsUrl: "https://docs.raydium.io/products/launchlab/bonding-curve",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.INFO,
    feeSource: "LaunchState curve_type, quote_reserve_target, and per-launch fee fields",
    primaryRisks: ["first_slot_snipe", "curve_floor_capture", "graduation_migration_risk"],
    guardrails: ["watch initialize plus first buy timing", "throttle first-slot bundle lanes", "monitor curve progress to graduation"],
    riskWeight: 1.18,
  },
  raydium_stable_amm: {
    protocol: "raydium_stable_amm",
    programId: RAYDIUM_PROGRAM_IDS.STABLE_AMM,
    label: "Raydium Stable AMM",
    product: "stable_swap",
    docsUrl: "https://docs.raydium.io/reference/program-addresses",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.INFO,
    feeSource: "program and pool state; Stable AMM is a lower-liquidity/deprecated surface",
    primaryRisks: ["stale_quote_arbitrage", "depeg_markout"],
    guardrails: ["monitor stale stable-pair quotes", "cap depeg-sensitive size"],
    riskWeight: 0.82,
  },
  raydium_router: {
    protocol: "raydium_router",
    programId: RAYDIUM_PROGRAM_IDS.ROUTER,
    label: "Raydium Router",
    product: "router",
    docsUrl: "https://docs.raydium.io/reference/program-addresses",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.INFO,
    feeSource: "underlying pool program configs",
    primaryRisks: ["route_staleness", "multi_pool_markout", "bundle_lane_pressure"],
    guardrails: ["score every hop", "fail closed when any hop is avoid", "prefer cleaner same-pair venues"],
    riskWeight: 1.04,
  },
};

const RAYDIUM_PROTOCOL_ALIASES: Record<RaydiumProtocol, string[]> = {
  raydium_amm_v4: ["raydium_amm_v4", "raydium_amm", "amm_v4"],
  raydium_cpmm: ["raydium_cpmm", "cpmm", "raydium_cp_swap"],
  raydium_clmm: ["raydium_clmm", "clmm"],
  raydium_launchlab: ["raydium_launchlab", "launchlab", "raydium_launch", "launch_lab"],
  raydium_stable_amm: ["raydium_stable_amm", "stable_amm", "raydium_stable"],
  raydium_router: ["raydium_router", "router", "amm_routing"],
};

const ORCA_PROTOCOL_ALIASES: Record<OrcaProtocol, string[]> = {
  orca_whirlpool: ["orca_whirlpool", "whirlpool", "whirlpools", "orca_clmm", "orca_whirlpools"],
  orca_legacy_v1: ["orca_v1", "orca_legacy_v1", "orca_legacy"],
  orca_legacy_v2: ["orca_v2", "orca_legacy_v2"],
};

function normalizeProtocol(value?: string | null) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") ?? "";
}

export function resolveRaydiumProtocol(value?: string | null): RaydiumProtocol | null {
  const normalized = normalizeProtocol(value);
  if (!normalized) return null;
  if (normalized in RAYDIUM_PROGRAM_METADATA) return normalized as RaydiumProtocol;

  for (const [protocol, aliases] of Object.entries(RAYDIUM_PROTOCOL_ALIASES) as Array<[RaydiumProtocol, string[]]>) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) return protocol;
  }
  return null;
}

export function getRaydiumProgramMeta(value?: string | null): RaydiumProgramMeta | null {
  const protocol = resolveRaydiumProtocol(value);
  return protocol ? RAYDIUM_PROGRAM_METADATA[protocol] : null;
}

export function getRaydiumProgramMetaById(programId?: string | null): RaydiumProgramMeta | null {
  if (!programId) return null;
  return Object.values(RAYDIUM_PROGRAM_METADATA).find((meta) => meta.programId === programId) ?? null;
}

export function resolveOrcaProtocol(value?: string | null): OrcaProtocol | null {
  const normalized = normalizeProtocol(value);
  if (!normalized) return null;
  if (normalized in ORCA_PROGRAM_METADATA) return normalized as OrcaProtocol;

  for (const [protocol, aliases] of Object.entries(ORCA_PROTOCOL_ALIASES) as Array<[OrcaProtocol, string[]]>) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) return protocol;
  }
  return null;
}

export function getOrcaProgramMeta(value?: string | null): OrcaProgramMeta | null {
  const protocol = resolveOrcaProtocol(value);
  return protocol ? ORCA_PROGRAM_METADATA[protocol] : null;
}

export function getOrcaProgramMetaById(programId?: string | null): OrcaProgramMeta | null {
  if (!programId) return null;
  return Object.values(ORCA_PROGRAM_METADATA).find((meta) => meta.programId === programId) ?? null;
}

export function isRaydiumProgramId(programId?: string | null): boolean {
  return Boolean(getRaydiumProgramMetaById(programId));
}

export function isRaydiumProtocol(value?: string | null): boolean {
  return Boolean(resolveRaydiumProtocol(value));
}

export function isOrcaProgramId(programId?: string | null): boolean {
  return Boolean(getOrcaProgramMetaById(programId));
}

export function isOrcaProtocol(value?: string | null): boolean {
  return Boolean(resolveOrcaProtocol(value));
}

export function isRaydiumConstantProduct(protocol?: string | null): boolean {
  const meta = getRaydiumProgramMeta(protocol);
  return meta?.product === "constant_product" || meta?.product === "router" || meta?.product === "stable_swap";
}

export function raydiumGuardReasonCodes(protocol?: string | null): string[] {
  const meta = getRaydiumProgramMeta(protocol);
  if (!meta) return [];
  if (meta.protocol === "raydium_cpmm" || meta.protocol === "raydium_clmm") return ["read_live_amm_config", ...meta.primaryRisks];
  if (meta.protocol === "raydium_launchlab") return ["read_launch_state", ...meta.primaryRisks];
  return meta.primaryRisks;
}

export function orcaGuardReasonCodes(protocol?: string | null): string[] {
  const meta = getOrcaProgramMeta(protocol);
  if (!meta) return [];
  if (meta.protocol === "orca_whirlpool") {
    return ["read_whirlpool_state", "read_tick_arrays", "adaptive_fee_state", ...meta.primaryRisks];
  }
  return meta.primaryRisks;
}

// ─── Known MEV bots ───────────────────────────────────────────────────────────
// Source: Helius MEV report, Coinmonks research, B91 case study
export const KNOWN_MEV_BOTS: Record<string, { label: string; riskScore: number; strategies: string[] }> = {
  "vpeNALD89BZ4KxNUFjdLmFXBCwtyqBDQ85ouNoax38b": {
    label: "Vpe Sandwich Bot",
    riskScore: 0.97,
    strategies: ["sandwich"],
    // 1.55M sandwiches over 30 days, 65,880 SOL profit — Helius MEV report
  },
};

export function getKnownBotInfo(wallet: string) {
  return KNOWN_MEV_BOTS[wallet] ?? null;
}

export function isKnownMevBot(wallet: string): boolean {
  return wallet in KNOWN_MEV_BOTS;
}

// ─── Per-attack USD caps ──────────────────────────────────────────────────────
// Research shows even the largest Solana sandwich attacks rarely exceed $50K victim loss.
// Values above this threshold are almost certainly wrong decimal/price artifacts.
// The largest documented single MEV event on Solana was ~$50K (April 2025).
export const MAX_VICTIM_LOSS_USD = 50_000;
export const MAX_PROFIT_USD = 100_000;

export const DEX_PROGRAMS: Record<string, string> = {
  // Raydium
  [RAYDIUM_PROGRAM_IDS.LAUNCHLAB]: "raydium_launchlab",
  [RAYDIUM_PROGRAM_IDS.CPMM]: "raydium_cpmm",
  [RAYDIUM_PROGRAM_IDS.AMM_V4]: "raydium_amm_v4",
  [RAYDIUM_PROGRAM_IDS.STABLE_AMM]: "raydium_stable_amm",
  [RAYDIUM_PROGRAM_IDS.CLMM]: "raydium_clmm",
  [RAYDIUM_PROGRAM_IDS.ROUTER]: "raydium_router",

  // Orca / Whirlpool
  [ORCA_PROGRAM_IDS.LEGACY_V1]: "orca_legacy_v1",
  [ORCA_PROGRAM_IDS.LEGACY_V2]: "orca_legacy_v2",
  [ORCA_PROGRAM_IDS.WHIRLPOOL]:  "orca_whirlpool",

  // Meteora
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EkRBj45":  "meteora_pools",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo":  "meteora_dlmm",

  // Jupiter (aggregator)
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB":   "jupiter_v4",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4":   "jupiter_v6",

  // Drift execution / keeper infrastructure
  "J1TnP8zvVxbtF5KFp5xRmWuvG9McnhzmBd9XGfCyuxFP":   "drift_jit_proxy",

  // Phoenix (CLOB)
  "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY":   "phoenix",

  // Lifinity
  "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S":   "lifinity",
};

export const LENDING_PROGRAMS: Record<string, string> = {
  "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo": "solend",
  "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA":  "marginfi",
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD": "kamino",
  "JD3bq9hGdy38PuWQ4h2YJpELmHVGPPfFSuFkpzAd9zfu": "solend_v2",
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH": "drift",
};

export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
export const USDC_MINT   = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT   = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export function getDexName(programId: string): string | null {
  return DEX_PROGRAMS[programId] ?? null;
}

export function getLendingName(programId: string): string | null {
  return LENDING_PROGRAMS[programId] ?? null;
}

export function getProgramLabel(programId: string | null | undefined): string | null {
  if (!programId) return null;
  return DEX_PROGRAMS[programId] ?? LENDING_PROGRAMS[programId] ?? null;
}

export function isDex(programId: string): boolean {
  return programId in DEX_PROGRAMS;
}

export function isLending(programId: string): boolean {
  return programId in LENDING_PROGRAMS;
}

// Stablecoins + major tokens we can price
export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  [WRAPPED_SOL]: { symbol: "SOL", decimals: 9 },
  [USDC_MINT]:   { symbol: "USDC", decimals: 6 },
  [USDT_MINT]:   { symbol: "USDT", decimals: 6 },
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { symbol: "mSOL", decimals: 9 },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { symbol: "ETH", decimals: 8 },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": { symbol: "stSOL", decimals: 9 },
};
