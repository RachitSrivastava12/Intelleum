// Raydium on-chain constants and detection utilities.
// Sources: docs.raydium.io, github.com/raydium-io, Helius MEV report, academic research.

// ─── Program IDs ─────────────────────────────────────────────────────────────

export const RAYDIUM_PROGRAMS = {
  AMM_V4:     "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  CPMM:       "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  CLMM:       "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  LAUNCHLAB:  "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
  STABLE_AMM: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h",
  ROUTER:     "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS",
} as const;

export type RaydiumProgramKey = keyof typeof RAYDIUM_PROGRAMS;

export type RaydiumResearchNote = {
  id: string;
  title: string;
  source: string;
  href: string;
  signal: string;
  guardrail: string;
};

export const RAYDIUM_CONFIG_ENDPOINTS = {
  INFO: "https://api-v3.raydium.io/main/info",
  CPMM_CONFIG: "https://api-v3.raydium.io/main/cpmm-config",
  CLMM_CONFIG: "https://api-v3.raydium.io/main/clmm-config",
} as const;

export const RAYDIUM_PROGRAM_RESEARCH: Record<RaydiumProgramKey, {
  label: string;
  product: string;
  feeSource: string;
  primaryRisk: string;
  guardrail: string;
  href: string;
  configEndpoint: string | null;
}> = {
  AMM_V4: {
    label: "AMM v4",
    product: "legacy constant product",
    feeSource: "pool/program state",
    primaryRisk: "sandwich and stale-quote backrun pressure",
    guardrail: "cap public swaps and prefer cleaner same-pair CPMM/CLMM routes when markout rises",
    href: "https://docs.raydium.io/protocol-overview/versions-and-migration",
    configEndpoint: null,
  },
  CPMM: {
    label: "CPMM",
    product: "constant product",
    feeSource: "AmmConfig trade, creator, protocol, and fund fee fields",
    primaryRisk: "sandwich, creator-fee misread, stale quote pickup",
    guardrail: "read CPMM config before quoting and downrank high-markout pools",
    href: "https://docs.raydium.io/products/cpmm/fees",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.CPMM_CONFIG,
  },
  CLMM: {
    label: "CLMM",
    product: "concentrated liquidity",
    feeSource: "CLMM AmmConfig fee and tick spacing",
    primaryRisk: "JIT add/swap/remove fee capture",
    guardrail: "track same-slot liquidity add, victim swap, and remove sequences around active ticks",
    href: "https://raydium.mintlify.app/products/clmm/fees",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.CLMM_CONFIG,
  },
  LAUNCHLAB: {
    label: "LaunchLab",
    product: "bonding-curve launch",
    feeSource: "LaunchState curve, quote target, and per-launch fee fields",
    primaryRisk: "first-slot snipe and graduation migration risk",
    guardrail: "watch initialize plus first buy timing and curve progress to graduation",
    href: "https://docs.raydium.io/products/launchlab/bonding-curve",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.INFO,
  },
  STABLE_AMM: {
    label: "Stable AMM",
    product: "stable swap",
    feeSource: "program and pool state",
    primaryRisk: "stale stable-pair quote and depeg markout",
    guardrail: "monitor stale quote pickups and cap depeg-sensitive size",
    href: "https://docs.raydium.io/reference/program-addresses",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.INFO,
  },
  ROUTER: {
    label: "Router",
    product: "multi-hop routing",
    feeSource: "underlying pool configs",
    primaryRisk: "multi-hop stale route and bundle lane pressure",
    guardrail: "score every hop and fail closed when any hop is avoid",
    href: "https://docs.raydium.io/reference/program-addresses",
    configEndpoint: RAYDIUM_CONFIG_ENDPOINTS.INFO,
  },
};

export const RAYDIUM_RESEARCH_NOTES: RaydiumResearchNote[] = [
  {
    id: "cpmm-config",
    title: "CPMM fees are config state",
    source: "Raydium CPMM fees",
    href: "https://docs.raydium.io/products/cpmm/fees",
    signal: "AmmConfig controls trade, creator, protocol, and fund fee rates.",
    guardrail: "Never price CPMM protection from a frontend fee table; refresh config before route scoring.",
  },
  {
    id: "clmm-jit",
    title: "CLMM needs tick-aware JIT checks",
    source: "Raydium CLMM fees",
    href: "https://raydium.mintlify.app/products/clmm/fees",
    signal: "CLMM fee/tick settings come from AmmConfig and active range state.",
    guardrail: "Flag add, swap, remove sequences where a short-lived position captures flow around the active tick.",
  },
  {
    id: "launchlab-curve",
    title: "LaunchLab graduation is stateful",
    source: "Raydium LaunchLab bonding curve",
    href: "https://docs.raydium.io/products/launchlab/bonding-curve",
    signal: "Launches can use different curve types and graduate when quote reserve targets are met.",
    guardrail: "Detect first-slot buys and read LaunchState before labeling migration or graduation risk.",
  },
  {
    id: "jito-dontfront",
    title: "Protected send must be ordered",
    source: "Jito low-latency send",
    href: "https://docs.jito.wtf/lowlatencytxnsend/",
    signal: "Jito's dont-front marker only protects the marked transaction when it is first in the bundle.",
    guardrail: "For reroutes, submit protected tx first and cap compute-unit fees to avoid unnecessary spend.",
  },
];

/** Protocol string variants the API may return for each program */
const PROTOCOL_ALIASES: Record<RaydiumProgramKey, string[]> = {
  AMM_V4:     ["raydium_amm", "raydium_amm_v4", "amm_v4"],
  CPMM:       ["raydium_cpmm", "cpmm"],
  CLMM:       ["raydium_clmm", "clmm"],
  LAUNCHLAB:  ["raydium_launchlab", "launchlab", "raydium_launch", "raydium_launchpad"],
  STABLE_AMM: ["raydium_stable_amm", "stable_amm", "raydium_stable"],
  ROUTER:     ["raydium_router", "router"],
};

/** Resolve an API protocol string to a canonical program key */
export function resolveProgram(protocol?: string | null): RaydiumProgramKey | null {
  if (!protocol) return null;
  const lower = protocol.toLowerCase();
  for (const [key, aliases] of Object.entries(PROTOCOL_ALIASES) as [RaydiumProgramKey, string[]][]) {
    if (aliases.some((a) => lower.includes(a))) return key;
  }
  return null;
}

// ─── Program display names ────────────────────────────────────────────────────

export function raydiumProgramLabel(protocol?: string | null, fallback = "Raydium"): string {
  const key = resolveProgram(protocol);
  switch (key) {
    case "AMM_V4":     return "AMM v4";
    case "CPMM":       return "CPMM";
    case "CLMM":       return "CLMM";
    case "LAUNCHLAB":  return "LaunchLab";
    case "STABLE_AMM": return "Stable AMM";
    case "ROUTER":     return "Router";
    default:           return fallback;
  }
}

export function raydiumProgramId(protocol?: string | null): string | null {
  const key = resolveProgram(protocol);
  return key ? RAYDIUM_PROGRAMS[key] : null;
}

// ─── AMM v4 instruction opcodes (byte 0 of instruction data) ─────────────────
// Source: github.com/raydium-io/raydium-amm/blob/master/program/src/instruction.rs

export const AMM_V4_OPCODES: Record<number, string> = {
  3:  "Deposit",
  4:  "Withdraw",
  9:  "SwapBaseIn",
  11: "SwapBaseOut",
  16: "SwapBaseInV2",   // no OpenBook — modern variant
  17: "SwapBaseOutV2",  // no OpenBook
};

// ─── Confidence scoring helpers ──────────────────────────────────────────────

export type ConfidenceSignal = {
  label: string;
  weight: number;     // 0–1 contribution
  present: boolean;
};

/** Build a list of scored confidence signals for a sandwich attack */
export function sandwichConfidenceSignals(attack: {
  confidence: number;
  tip_lamports?: number | null;
  execution_lane?: string | null;
  bundle_likelihood?: number | null;
  frontrun_tx?: string | null;
  backrun_tx?: string | null;
  victim_tx?: string | null;
  evidence?: string[] | null;
}): ConfidenceSignal[] {
  const e = (attack.evidence ?? []).join(" ").toLowerCase();
  return [
    {
      label: "Jito bundle (frontrun + backrun bundled)",
      weight: 0.30,
      present: attack.execution_lane === "jito-aligned" || (attack.bundle_likelihood ?? 0) >= 0.75,
    },
    {
      label: "Same-slot ordering confirmed",
      weight: 0.25,
      present: e.includes("same slot") || e.includes("slot"),
    },
    {
      label: "Frontrun + backrun transaction pair",
      weight: 0.20,
      present: !!attack.frontrun_tx && !!attack.backrun_tx,
    },
    {
      label: "Victim transaction identified",
      weight: 0.15,
      present: !!attack.victim_tx,
    },
    {
      label: "Reverse direction (sell after buy) confirmed",
      weight: 0.10,
      present: e.includes("reverse") || e.includes("opposite") || e.includes("sell"),
    },
  ];
}

/** Build confidence signals for a JIT attack */
export function jitConfidenceSignals(attack: {
  confidence: number;
  tip_lamports?: number | null;
  execution_lane?: string | null;
  bundle_likelihood?: number | null;
  frontrun_tx?: string | null;
  backrun_tx?: string | null;
  evidence?: string[] | null;
}): ConfidenceSignal[] {
  const e = (attack.evidence ?? []).join(" ").toLowerCase();
  return [
    {
      label: "Jito bundle (add + remove bundled)",
      weight: 0.30,
      present: attack.execution_lane === "jito-aligned" || (attack.bundle_likelihood ?? 0) >= 0.75,
    },
    {
      label: "LP add + remove in same slot",
      weight: 0.30,
      present: e.includes("in-slot") || e.includes("same slot"),
    },
    {
      label: "Add and remove by same signer",
      weight: 0.20,
      present: !!attack.frontrun_tx && !!attack.backrun_tx,
    },
    {
      label: "Tight tick range around swap price",
      weight: 0.20,
      present: e.includes("tick") || e.includes("range"),
    },
  ];
}

// ─── Attack type metadata ─────────────────────────────────────────────────────

export const ATTACK_META: Record<string, {
  label: string;
  shortLabel: string;
  color: string;       // tailwind text class
  bgColor: string;     // tailwind bg/border class
  affectedPrograms: string[];
  description: string;
}> = {
  sandwich: {
    label: "Sandwich Attack",
    shortLabel: "Sandwich",
    color: "text-red-300",
    bgColor: "border-red-500/40 bg-red-500/10",
    affectedPrograms: ["AMM v4", "CPMM"],
    description: "Bot inserts a buy before the victim's swap and a sell after, capturing the price impact caused by the victim.",
  },
  jit: {
    label: "JIT Liquidity",
    shortLabel: "JIT",
    color: "text-cyan-300",
    bgColor: "border-cyan-500/40 bg-cyan-500/10",
    affectedPrograms: ["CLMM"],
    description: "Bot adds concentrated liquidity just before a large swap to capture fees, then removes it immediately after. Passive LPs lose their fair share.",
  },
  backrun: {
    label: "Backrun",
    shortLabel: "Backrun",
    color: "text-orange-300",
    bgColor: "border-orange-500/40 bg-orange-500/10",
    affectedPrograms: ["AMM v4", "CPMM", "CLMM"],
    description: "Bot trades immediately after a large swap to exploit the price movement. No frontrun — the victim isn't directly harmed but the bot extracts from the protocol.",
  },
  arbitrage: {
    label: "Arbitrage",
    shortLabel: "Arb",
    color: "text-blue-300",
    bgColor: "border-blue-500/40 bg-blue-500/10",
    affectedPrograms: ["AMM v4", "CPMM", "CLMM"],
    description: "Bot exploits price differences between Raydium pools or other DEXes. Neutral to users but extracts value from LPs via adverse selection.",
  },
  liquidity_snipe: {
    label: "Launch Snipe",
    shortLabel: "Snipe",
    color: "text-yellow-200",
    bgColor: "border-yellow-500/40 bg-yellow-500/10",
    affectedPrograms: ["LaunchLab"],
    description: "Bot detects a new LaunchLab pool creation and buys tokens in the same slot at curve floor price, before organic buyers can react.",
  },
  liquidity_drain: {
    label: "Liquidity Drain",
    shortLabel: "Drain",
    color: "text-yellow-400",
    bgColor: "border-yellow-600/40 bg-yellow-600/10",
    affectedPrograms: ["AMM v4", "CPMM"],
    description: "Bot aggressively removes liquidity then dumps tokens, destabilizing the pool. Often precedes a price crash.",
  },
  liquidation: {
    label: "Liquidation",
    shortLabel: "Liq",
    color: "text-purple-300",
    bgColor: "border-purple-500/40 bg-purple-500/10",
    affectedPrograms: ["AMM v4", "CLMM"],
    description: "Forced position closure that passes through Raydium pools, generating adverse price impact for other LPs.",
  },
};

export function attackMeta(type: string) {
  return ATTACK_META[type] ?? {
    label: type.replace(/_/g, " "),
    shortLabel: type.replace(/_/g, " "),
    color: "text-muted-foreground",
    bgColor: "border-border/40 bg-card/40",
    affectedPrograms: [],
    description: "Unclassified extraction event.",
  };
}

// ─── Value formatting ─────────────────────────────────────────────────────────
// Shared formatter used across Raydium pages.
// M = million, K = thousand, B = billion.

export function fmtUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)     return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)         return `$${(value / 1_000).toFixed(1)}K`;
  if (abs > 0 && abs < 1)   return "<$1";
  return `$${value.toFixed(0)}`;
}

export function fmtBps(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} bps`;
}

export function fmtLamports(lamports?: number | null): string {
  if (!lamports) return "—";
  const sol = lamports / 1_000_000_000;
  return sol >= 0.001 ? `${sol.toFixed(4)} SOL` : `${lamports.toLocaleString()} lam`;
}

export function fmtPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}
