// Orca on-chain constants and intelligence helpers.
// Sources: docs.orca.so, dev.orca.so, github.com/orca-so/whirlpools.

export const ORCA_PROGRAMS = {
  WHIRLPOOL: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  LEGACY_V1: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
  LEGACY_V2: "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1",
} as const;

export type OrcaProgramKey = keyof typeof ORCA_PROGRAMS;

export const ORCA_CONFIGS = {
  MAINNET_WHIRLPOOLS_CONFIG: "2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ",
  MAINNET_CONFIG_EXTENSION: "777H5H3Tp9U11uRVRzFwM8BinfiakbaLT8vQpeuhvEiH",
  DEVNET_WHIRLPOOLS_CONFIG: "FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR",
  DEVNET_CONFIG_EXTENSION: "475EJ7JqnRpVLoFVzp2ruEYvWWMCf6Z8KMWRujtXXNSU",
} as const;

export const ORCA_API_ENDPOINTS = {
  PROTOCOL: "https://api.orca.so/v2/solana/protocol",
  POOLS: "https://api.orca.so/v2/solana/pools",
  POOL_SEARCH: "https://api.orca.so/v2/solana/pools/search",
} as const;

export type OrcaResearchNote = {
  id: string;
  title: string;
  source: string;
  href: string;
  signal: string;
  guardrail: string;
};

export const ORCA_FEE_TIERS = [
  { tickSpacing: 1, feeRatePct: 0.01, label: "0.01%" },
  { tickSpacing: 2, feeRatePct: 0.02, label: "0.02%" },
  { tickSpacing: 4, feeRatePct: 0.04, label: "0.04%" },
  { tickSpacing: 8, feeRatePct: 0.08, label: "0.08%" },
  { tickSpacing: 16, feeRatePct: 0.16, label: "0.16%" },
  { tickSpacing: 64, feeRatePct: 0.3, label: "0.30%" },
  { tickSpacing: 96, feeRatePct: 0.65, label: "0.65%" },
  { tickSpacing: 128, feeRatePct: 1, label: "1.00%" },
  { tickSpacing: 256, feeRatePct: 2, label: "2.00%" },
] as const;

export const ORCA_PROGRAM_RESEARCH: Record<OrcaProgramKey, {
  label: string;
  product: string;
  feeSource: string;
  primaryRisk: string;
  guardrail: string;
  href: string;
  configEndpoint: string | null;
}> = {
  WHIRLPOOL: {
    label: "Whirlpool",
    product: "concentrated liquidity",
    feeSource: "Whirlpool feeRate/protocolFeeRate plus FeeTier, TickArray, and adaptive-fee Oracle state",
    primaryRisk: "JIT liquidity, tick-array staleness, adaptive-fee volatility, and LP adverse selection",
    guardrail: "read Whirlpool state before scoring; cap swaps when tick crossings/adaptive fees spike",
    href: "https://docs.orca.so/developers/architecture/whirlpool-parameters",
    configEndpoint: ORCA_API_ENDPOINTS.POOLS,
  },
  LEGACY_V1: {
    label: "Legacy v1",
    product: "legacy pool",
    feeSource: "legacy pool state",
    primaryRisk: "sandwich and stale-quote backrun pressure",
    guardrail: "prefer cleaner Whirlpool or same-pair routes when markout rises",
    href: "https://docs.orca.so/",
    configEndpoint: null,
  },
  LEGACY_V2: {
    label: "Legacy v2",
    product: "legacy pool",
    feeSource: "legacy pool state",
    primaryRisk: "sandwich and stale-quote backrun pressure",
    guardrail: "prefer cleaner Whirlpool or same-pair routes when markout rises",
    href: "https://docs.orca.so/",
    configEndpoint: null,
  },
};

export const ORCA_RESEARCH_NOTES: OrcaResearchNote[] = [
  {
    id: "whirlpool-state",
    title: "Whirlpool state is the fee boundary",
    source: "Orca Whirlpool parameters",
    href: "https://docs.orca.so/developers/architecture/whirlpool-parameters",
    signal: "Program/config IDs and initialized fee tiers are fixed, but pool state carries fee/tick values.",
    guardrail: "Refresh Whirlpool and FeeTier state before using fee, tick, or quote assumptions.",
  },
  {
    id: "tick-arrays",
    title: "Tick arrays are execution-critical",
    source: "Orca tick arrays",
    href: "https://dev.orca.so/Architecture%20Overview/Understanding%20Tick%20Arrays/",
    signal: "Swaps traverse tick arrays, and position changes require the arrays covering selected ticks.",
    guardrail: "Detect stale tick-array routes and JIT add/swap/remove sequences around the active tick.",
  },
  {
    id: "adaptive-fees",
    title: "Adaptive fees can surge with volatility",
    source: "Orca adaptive fees",
    href: "https://docs.orca.so/liquidity/concepts/adaptive-fees",
    signal: "Adaptive pools combine a base fee with a volatility-sensitive component.",
    guardrail: "Cap notional or reroute when effective fee and tick-group crossing pressure rise together.",
  },
  {
    id: "token-extensions",
    title: "Token-2022 requires V2 path checks",
    source: "Orca TokenExtensions",
    href: "https://docs.orca.so/developers/architecture/token-extensions",
    signal: "V2 instructions support Token-2022 combinations and TokenBadge gates risky extensions.",
    guardrail: "Use V2 instruction assumptions and validate TokenBadge/extension risk before pool initialization or routing.",
  },
];

const PROTOCOL_ALIASES: Record<OrcaProgramKey, string[]> = {
  WHIRLPOOL: ["orca_whirlpool", "whirlpool", "whirlpools", "orca_clmm", "orca_whirlpools"],
  LEGACY_V1: ["orca_v1", "orca_legacy_v1", "orca_legacy"],
  LEGACY_V2: ["orca_v2", "orca_legacy_v2"],
};

export function resolveOrcaProgram(protocol?: string | null): OrcaProgramKey | null {
  if (!protocol) return null;
  const lower = protocol.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  for (const [key, aliases] of Object.entries(PROTOCOL_ALIASES) as [OrcaProgramKey, string[]][]) {
    if (aliases.some((alias) => lower === alias || lower.includes(alias))) return key;
  }
  return null;
}

export function orcaProgramLabel(protocol?: string | null, fallback = "Orca"): string {
  const key = resolveOrcaProgram(protocol);
  switch (key) {
    case "WHIRLPOOL": return "Whirlpool";
    case "LEGACY_V1": return "Legacy v1";
    case "LEGACY_V2": return "Legacy v2";
    default: return fallback;
  }
}

export function orcaProgramId(protocol?: string | null): string | null {
  const key = resolveOrcaProgram(protocol);
  return key ? ORCA_PROGRAMS[key] : null;
}

export function isOrcaText(value?: string | null) {
  return !!value && /orca|whirlpool/i.test(value);
}

export function fmtUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (abs > 0 && abs < 1) return "<$1";
  return `$${value.toFixed(0)}`;
}

export function fmtBps(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)} bps`;
}

export function fmtLamports(lamports?: number | null): string {
  if (!lamports) return "--";
  const sol = lamports / 1_000_000_000;
  return sol >= 0.001 ? `${sol.toFixed(4)} SOL` : `${lamports.toLocaleString()} lam`;
}
