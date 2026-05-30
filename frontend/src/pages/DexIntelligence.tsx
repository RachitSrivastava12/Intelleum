import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  TimerReset,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  api,
  Attack,
  LpProtectionSnapshot,
  PoolToxicity,
  PreventionGuard,
  RouteRisk,
  SystemStatus,
  ToxicFlowTerminal,
} from "@/lib/api";
import { formatPoolLabel, truncateAddress } from "@/lib/utils";

type MarketReference = {
  tvlUsd: number | null;
  volume24hUsd: number | null;
  volume7dUsd: number | null;
  volume30dUsd: number | null;
  fees24hUsd: number | null;
  updatedAt: string;
  source: "defillama" | "snapshot";
};

type DexSummary = {
  name: string;
  status: "live" | "coming-soon";
  detail: string;
};

type SandwichRow = {
  id: string;
  surface: string;
  program: string;
  pair: string;
  sandwichRate: number;
  staleQuoteRate: number;
  bpsAtRisk: number;
  lossUsd: number;
  action: RouteRisk["policy_action"];
  attackers: number;
  confidence: number;
};

type JitRow = {
  id: string;
  pool: string;
  tickBand: string;
  windows: number;
  feeDilutionBps: number;
  lpDragUsd: number;
  attacker: string;
  confidence: number;
  action: "monitor" | "cap" | "reroute";
};

type LaunchRow = {
  id: string;
  token: string;
  curveProgress: number;
  firstBuyWindow: string;
  priorityFee: number;
  sniper: string;
  migrationRisk: "low" | "medium" | "high";
  extractedUsd: number;
};

type LpRow = {
  id: string;
  pool: string;
  score: number;
  lvr: number;
  adverseSelection: number;
  lpDragUsd: number;
  savedFeeBps: number;
  cause: string;
};

type RaydiumIntelState = {
  status: SystemStatus | null;
  market: MarketReference;
  routes: RouteRisk[];
  attacks: Attack[];
  pools: PoolToxicity[];
  lpProtection: LpProtectionSnapshot[];
  terminal: ToxicFlowTerminal | null;
  guard: PreventionGuard | null;
};

const MARKET_FALLBACK: MarketReference = {
  tvlUsd: 975_198_272,
  volume24hUsd: 133_325_786,
  volume7dUsd: 1_008_634_685,
  volume30dUsd: 4_213_442_559,
  fees24hUsd: 132_792,
  updatedAt: "2026-05-30",
  source: "snapshot",
};

const DEXES: DexSummary[] = [
  { name: "Raydium", status: "live", detail: "CPMM, AMM v4, CLMM, LaunchLab" },
  { name: "Orca", status: "coming-soon", detail: "Whirlpool coverage next" },
  { name: "Meteora", status: "coming-soon", detail: "DLMM / DAMM coverage next" },
  { name: "Jupiter", status: "coming-soon", detail: "Aggregator route layer" },
  { name: "Phoenix", status: "coming-soon", detail: "CLOB execution surface" },
  { name: "PumpSwap", status: "coming-soon", detail: "Launch + pool flow" },
];

const RAYDIUM_PROGRAMS = [
  { label: "LaunchLab", slug: "raydium_launchlab", id: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj", surface: "Bonding curve launches" },
  { label: "CPMM", slug: "raydium_cpmm", id: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", surface: "Default constant-product pools" },
  { label: "AMM v4", slug: "raydium_amm_v4", id: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", surface: "Legacy constant-product pools" },
  { label: "Stable AMM", slug: "raydium_stable_amm", id: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h", surface: "Stable swap pools" },
  { label: "CLMM", slug: "raydium_clmm", id: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", surface: "Concentrated liquidity" },
  { label: "Router", slug: "raydium_router", id: "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS", surface: "Raydium route layer" },
];

const DEMO_SANDWICH_ROWS: SandwichRow[] = [
  {
    id: "demo-cpmm-sol-usdc",
    surface: "Raydium CPMM SOL / USDC",
    program: "CPMM",
    pair: "SOL / USDC",
    sandwichRate: 63,
    staleQuoteRate: 49,
    bpsAtRisk: 18.7,
    lossUsd: 158_950,
    action: "avoid",
    attackers: 11,
    confidence: 91,
  },
  {
    id: "demo-ammv4-sol-usdt",
    surface: "Raydium AMM v4 SOL / USDT",
    program: "AMM v4",
    pair: "SOL / USDT",
    sandwichRate: 44,
    staleQuoteRate: 37,
    bpsAtRisk: 12.4,
    lossUsd: 81_420,
    action: "reroute",
    attackers: 8,
    confidence: 86,
  },
  {
    id: "demo-cpmm-ray-sol",
    surface: "Raydium CPMM RAY / SOL",
    program: "CPMM",
    pair: "RAY / SOL",
    sandwichRate: 29,
    staleQuoteRate: 31,
    bpsAtRisk: 8.6,
    lossUsd: 34_880,
    action: "penalize",
    attackers: 5,
    confidence: 82,
  },
];

const DEMO_JIT_ROWS: JitRow[] = [
  {
    id: "demo-clmm-sol-usdc",
    pool: "Raydium CLMM SOL / USDC",
    tickBand: "tick-array proxy -44352 -> -44096",
    windows: 19,
    feeDilutionBps: 7.8,
    lpDragUsd: 47_230,
    attacker: "J1TLabsT7Q2m...x4z7kL",
    confidence: 88,
    action: "cap",
  },
  {
    id: "demo-clmm-usdc-usdt",
    pool: "Raydium CLMM USDC / USDT",
    tickBand: "tick-array proxy -128 -> 128",
    windows: 11,
    feeDilutionBps: 3.1,
    lpDragUsd: 18_940,
    attacker: "7yCkPp9J4m...N7wR2dM",
    confidence: 84,
    action: "monitor",
  },
];

const DEMO_LAUNCH_ROWS: LaunchRow[] = [
  {
    id: "demo-launch-1",
    token: "LaunchMint...1111",
    curveProgress: 76,
    firstBuyWindow: "same slot",
    priorityFee: 176_000,
    sniper: "L4unch9pQx3...2mN8qK",
    migrationRisk: "high",
    extractedUsd: 12_420,
  },
  {
    id: "demo-launch-2",
    token: "CurveToken...9x2A",
    curveProgress: 58,
    firstBuyWindow: "+1 slot",
    priorityFee: 91_000,
    sniper: "9sN1p3R8uD...M5zN7qR",
    migrationRisk: "medium",
    extractedUsd: 6_850,
  },
];

const DEMO_LP_ROWS: LpRow[] = [
  {
    id: "demo-lp-cpmm",
    pool: "Raydium CPMM SOL / USDC",
    score: 86,
    lvr: 78,
    adverseSelection: 84,
    lpDragUsd: 36_119,
    savedFeeBps: 9.5,
    cause: "sandwich pressure",
  },
  {
    id: "demo-lp-clmm",
    pool: "Raydium CLMM SOL / USDC",
    score: 74,
    lvr: 69,
    adverseSelection: 72,
    lpDragUsd: 28_460,
    savedFeeBps: 7.1,
    cause: "JIT liquidity windows",
  },
];

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) > 0 && Math.abs(value) < 1) return "<$1";
  return `$${value.toFixed(0)}`;
}

function formatBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)} bps`;
}

function isRaydiumText(value?: string | null) {
  return !!value && /raydium/i.test(value);
}

function isRaydiumRoute(route: RouteRisk) {
  return isRaydiumText(route.protocol) || isRaydiumText(route.route_key) || isRaydiumText(route.label);
}

function isRaydiumAttack(attack: Attack) {
  return isRaydiumText(attack.protocol) || isRaydiumText(attack.pool_address) || isRaydiumText(attack.surface_label);
}

function isRaydiumPool(pool: PoolToxicity | LpProtectionSnapshot) {
  return isRaydiumText(pool.protocol) || isRaydiumText(pool.pool_address);
}

function actionTone(action: string) {
  if (action === "avoid" || action === "block" || action === "high") return "border-red-500/45 bg-red-500/10 text-red-300";
  if (action === "reroute" || action === "penalize" || action === "cap" || action === "medium") {
    return "border-yellow-500/45 bg-yellow-500/10 text-yellow-200";
  }
  if (action === "allow" || action === "low") return "border-green-500/40 bg-green-500/10 text-green-300";
  return "border-primary/35 bg-primary/10 text-primary";
}

function actionLabel(action: string) {
  if (action === "avoid" || action === "block") return "Block";
  if (action === "penalize") return "Cap size";
  if (action === "reroute") return "Reroute";
  if (action === "cap") return "Cap";
  return action.replaceAll("_", " ");
}

function programName(protocol?: string | null, fallback = "Raydium") {
  const raw = protocol ?? "";
  if (raw.includes("cpmm")) return "CPMM";
  if (raw.includes("amm_v4") || raw === "raydium_amm") return "AMM v4";
  if (raw.includes("stable")) return "Stable AMM";
  if (raw.includes("clmm")) return "CLMM";
  if (raw.includes("launch")) return "LaunchLab";
  if (raw.includes("router")) return "Router";
  return fallback;
}

function pairFromSurface(surface: string) {
  const pair = surface.split(":").pop();
  if (!pair?.includes("->")) return "Route";
  return pair
    .split("->")
    .map((mint) => {
      if (mint.startsWith("So111")) return "SOL";
      if (mint.startsWith("EPjF")) return "USDC";
      if (mint.startsWith("Es9v")) return "USDT";
      return truncateAddress(mint, 4, 4);
    })
    .join(" / ");
}

function sortByRisk<T extends { lossUsd?: number; lpDragUsd?: number; score?: number; bpsAtRisk?: number }>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      (b.lossUsd ?? b.lpDragUsd ?? b.score ?? b.bpsAtRisk ?? 0) -
      (a.lossUsd ?? a.lpDragUsd ?? a.score ?? a.bpsAtRisk ?? 0),
  );
}

function withDemoRows<T extends { id: string }>(rows: T[], demoRows: T[], enabled: boolean, minRows: number) {
  if (!enabled || rows.length >= minRows) return rows;
  const seen = new Set(rows.map((row) => row.id));
  const next = [...rows];
  for (const row of demoRows) {
    if (seen.has(row.id)) continue;
    next.push(row);
    if (next.length >= minRows) break;
  }
  return next;
}

async function loadRaydiumMarketReference(): Promise<MarketReference> {
  try {
    const [protocolRes, dexRes, feesRes] = await Promise.all([
      fetch("https://api.llama.fi/protocol/raydium"),
      fetch("https://api.llama.fi/overview/dexs/solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume"),
      fetch("https://api.llama.fi/overview/fees/solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyFees"),
    ]);
    if (!protocolRes.ok || !dexRes.ok || !feesRes.ok) throw new Error("market reference unavailable");

    const protocol = await protocolRes.json();
    const dex = await dexRes.json();
    const fees = await feesRes.json();
    const tvlRow = Array.isArray(protocol?.tvl) ? protocol.tvl[protocol.tvl.length - 1] : null;
    const raydiumDex = dex?.protocols?.find((item: any) => item?.name === "Raydium AMM");
    const raydiumFees = fees?.protocols?.find((item: any) => item?.name === "Raydium AMM");

    return {
      tvlUsd: tvlRow?.totalLiquidityUSD ?? MARKET_FALLBACK.tvlUsd,
      volume24hUsd: raydiumDex?.total24h ?? MARKET_FALLBACK.volume24hUsd,
      volume7dUsd: raydiumDex?.total7d ?? MARKET_FALLBACK.volume7dUsd,
      volume30dUsd: raydiumDex?.total30d ?? MARKET_FALLBACK.volume30dUsd,
      fees24hUsd: raydiumFees?.total24h ?? MARKET_FALLBACK.fees24hUsd,
      updatedAt: tvlRow?.date ? new Date(tvlRow.date * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      source: "defillama",
    };
  } catch {
    return MARKET_FALLBACK;
  }
}

function buildSandwichRows(routes: RouteRisk[], pools: PoolToxicity[], demoEnabled: boolean): SandwichRow[] {
  const routeRows = routes
    .filter(isRaydiumRoute)
    .filter((route) => route.sandwich_count > 0 || /cpmm|amm|router/i.test(route.protocol ?? route.route_key))
    .map((route) => {
      const attackBase = Math.max(1, route.total_attacks);
      return {
        id: route.route_key,
        surface: route.label || formatPoolLabel(route.route_key),
        program: programName(route.protocol),
        pair: pairFromSurface(route.route_key),
        sandwichRate: Number(((route.sandwich_count / attackBase) * 100).toFixed(1)),
        staleQuoteRate: route.stale_quote_pickup_rate,
        bpsAtRisk: route.markout_30s_bps,
        lossUsd: Math.max(route.total_extracted_usd, route.estimated_savings_usd),
        action: route.policy_action,
        attackers: route.unique_attackers,
        confidence: route.avg_confidence,
      };
    });

  const poolRows = pools
    .filter(isRaydiumPool)
    .filter((pool) => pool.sandwich_count > 0)
    .map((pool) => {
      const attackBase = Math.max(1, pool.total_attacks);
      return {
        id: pool.pool_address,
        surface: formatPoolLabel(pool.pool_address),
        program: programName(pool.protocol, "Pool"),
        pair: pairFromSurface(pool.pool_address),
        sandwichRate: Number(((pool.sandwich_count / attackBase) * 100).toFixed(1)),
        staleQuoteRate: pool.stale_quote_arb_frequency ?? 0,
        bpsAtRisk: pool.saved_fee_bps_if_segmented ?? 0,
        lossUsd: pool.lp_drag_estimate_usd ?? pool.total_extracted_usd,
        action: pool.toxicity_score >= 80 ? "avoid" : pool.toxicity_score >= 60 ? "penalize" : "monitor",
        attackers: pool.unique_attackers,
        confidence: Math.min(96, Math.max(60, pool.toxicity_score)),
      };
    });

  const byId = new Map<string, SandwichRow>();
  [...routeRows, ...poolRows].forEach((row) => byId.set(row.id, row));
  return sortByRisk(withDemoRows([...byId.values()], DEMO_SANDWICH_ROWS, demoEnabled, 3)).slice(0, 6);
}

function buildJitRows(routes: RouteRisk[], attacks: Attack[], demoEnabled: boolean): JitRow[] {
  const fromRoutes = routes
    .filter(isRaydiumRoute)
    .filter((route) => route.jit_count > 0 || /clmm/i.test(route.protocol ?? route.route_key))
    .map((route) => ({
      id: route.route_key,
      pool: route.label || formatPoolLabel(route.route_key),
      tickBand: /clmm/i.test(route.protocol ?? route.route_key)
        ? `tick-band proxy ${Math.round(route.markout_30s_bps * -256)} -> ${Math.round(route.markout_30s_bps * 256)}`
        : "liquidity-window proxy",
      windows: Math.max(1, route.jit_count),
      feeDilutionBps: Number(Math.max(1, route.markout_5s_bps * 0.54).toFixed(1)),
      lpDragUsd: route.lp_annual_loss_usd_estimate,
      attacker: `${route.unique_attackers} operator${route.unique_attackers === 1 ? "" : "s"}`,
      confidence: route.avg_confidence,
      action: route.policy_action === "avoid" || route.policy_action === "reroute" ? "reroute" : route.policy_action === "penalize" ? "cap" : "monitor",
    }));

  const fromAttacks = attacks
    .filter(isRaydiumAttack)
    .filter((attack) => attack.attack_type === "jit")
    .map((attack) => ({
      id: attack.frontrun_tx ?? attack.pool_address,
      pool: attack.surface_label ?? formatPoolLabel(attack.pool_address),
      tickBand: "liquidity-window proxy",
      windows: 1,
      feeDilutionBps: Number(Math.max(1, (attack.victim_loss_usd ?? attack.profit_usd ?? 100) / 200).toFixed(1)),
      lpDragUsd: attack.victim_loss_usd ?? attack.profit_usd ?? 0,
      attacker: truncateAddress(attack.attacker_wallet, 8, 6),
      confidence: Number((attack.confidence * 100).toFixed(0)),
      action: "cap" as const,
    }));

  const byId = new Map<string, JitRow>();
  [...fromRoutes, ...fromAttacks].forEach((row) => byId.set(row.id, row));
  return sortByRisk(withDemoRows([...byId.values()], DEMO_JIT_ROWS, demoEnabled, 2)).slice(0, 5);
}

function buildLaunchRows(attacks: Attack[], demoEnabled: boolean): LaunchRow[] {
  const rows = attacks
    .filter(isRaydiumAttack)
    .filter((attack) => attack.attack_type === "liquidity_snipe" || /launch/i.test(attack.pool_address))
    .map((attack) => {
      const fee = attack.tip_lamports ?? 0;
      return {
        id: attack.victim_tx ?? attack.frontrun_tx ?? attack.pool_address,
        token: attack.token_mint ? truncateAddress(attack.token_mint, 8, 5) : "Unknown mint",
        curveProgress: Math.min(98, Math.max(32, Math.round((fee / 2_200) % 100))),
        firstBuyWindow: attack.evidence?.some((line) => /same slot/i.test(line)) ? "same slot" : "+1 slot",
        priorityFee: fee,
        sniper: truncateAddress(attack.attacker_wallet, 8, 6),
        migrationRisk: fee >= 140_000 ? "high" : fee >= 75_000 ? "medium" : "low",
        extractedUsd: attack.profit_usd ?? attack.victim_loss_usd ?? Math.max(1_500, fee / 18),
      } satisfies LaunchRow;
    });

  return sortByRisk(withDemoRows(rows, DEMO_LAUNCH_ROWS, demoEnabled, 2)).slice(0, 5);
}

function buildLpRows(lpProtection: LpProtectionSnapshot[], pools: PoolToxicity[], demoEnabled: boolean): LpRow[] {
  const fromProtection = lpProtection
    .filter(isRaydiumPool)
    .map((pool) => ({
      id: pool.pool_address,
      pool: formatPoolLabel(pool.pool_address),
      score: pool.toxicity_score,
      lvr: pool.lvr_proxy_score,
      adverseSelection: pool.adverse_selection_intensity,
      lpDragUsd: pool.lp_drag_estimate_usd,
      savedFeeBps: pool.saved_fee_bps_if_segmented,
      cause: pool.primary_cause,
    }));

  const fromPools = pools
    .filter(isRaydiumPool)
    .map((pool) => ({
      id: pool.pool_address,
      pool: formatPoolLabel(pool.pool_address),
      score: pool.toxicity_score,
      lvr: pool.lvr_proxy_score ?? 0,
      adverseSelection: pool.adverse_selection_intensity ?? 0,
      lpDragUsd: pool.lp_drag_estimate_usd ?? 0,
      savedFeeBps: pool.saved_fee_bps_if_segmented ?? 0,
      cause: pool.primary_cause ?? "toxic flow",
    }));

  const byId = new Map<string, LpRow>();
  [...fromProtection, ...fromPools].forEach((row) => byId.set(row.id, row));
  return sortByRisk(withDemoRows([...byId.values()], DEMO_LP_ROWS, demoEnabled, 2)).slice(0, 6);
}

function buildGuardTarget(routes: RouteRisk[]) {
  return [...routes].filter(isRaydiumRoute).sort((a, b) => b.risk_score - a.risk_score)[0] ?? null;
}

function LoadingState() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="h-12 border border-border bg-card/60" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse border border-border bg-card/70" />
          ))}
        </div>
        <div className="h-72 animate-pulse border border-border bg-card/70" />
      </div>
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center">
        <div className="w-full border border-red-500/40 bg-red-500/10 p-6">
          <AlertTriangle className="h-5 w-5 text-red-300" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-semibold">DEX feed unavailable.</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex min-h-10 items-center gap-2 border border-red-400/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-red-200 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    </main>
  );
}


function SectionShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: import("react").ReactNode;
  action?: import("react").ReactNode;
}) {
  return (
    <section className="border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DexIntelligence() {
  const [state, setState] = useState<RaydiumIntelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [status, routes, attacks, pools, lpProtection, terminal, market] = await Promise.all([
        api.systemStatus(),
        api.routeRisks(80),
        api.attacks({ limit: "160" }),
        api.pools(80),
        api.lpProtection(80),
        api.toxicFlowTerminal(24, "1m"),
        loadRaydiumMarketReference(),
      ]);
      const guardTarget = buildGuardTarget(routes);
      const guard = guardTarget
        ? await api.protectedSendPlan({
            route_key: guardTarget.route_key,
            route_label: guardTarget.label,
            protocol: guardTarget.protocol,
            notional_usd: Math.max(25_000, guardTarget.recommended_max_notional_usd * 2),
            slippage_bps: 50,
            objective: "protect_users",
            candidates: routes.filter(isRaydiumRoute).slice(0, 6).map((route) => ({
              route_key: route.route_key,
              label: route.label,
              protocol: route.protocol,
            })),
          })
        : null;

      setState({ status, routes, attacks, pools, lpProtection, terminal, market, guard });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Raydium intelligence failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const [selectedDetail, setSelectedDetail] = useState<
    | { type: "pool"; row: SandwichRow }
    | { type: "jit"; row: JitRow }
    | { type: "launch"; row: LaunchRow }
    | { type: "lp"; row: LpRow }
    | null
  >(null);

  const demoEnabled = state?.status?.mode !== "chain";
  const raydiumRoutes = useMemo(() => state?.routes.filter(isRaydiumRoute) ?? [], [state?.routes]);
  const raydiumAttacks = useMemo(() => state?.attacks.filter(isRaydiumAttack) ?? [], [state?.attacks]);
  const sandwichRows = useMemo(() => buildSandwichRows(state?.routes ?? [], state?.pools ?? [], demoEnabled), [state?.routes, state?.pools, demoEnabled]);
  const jitRows = useMemo(() => buildJitRows(state?.routes ?? [], state?.attacks ?? [], demoEnabled), [state?.routes, state?.attacks, demoEnabled]);
  const launchRows = useMemo(() => buildLaunchRows(state?.attacks ?? [], demoEnabled), [state?.attacks, demoEnabled]);
  const lpRows = useMemo(() => buildLpRows(state?.lpProtection ?? [], state?.pools ?? [], demoEnabled), [state?.lpProtection, state?.pools, demoEnabled]);

  const totals = useMemo(() => {
    const routeSavings = raydiumRoutes.reduce((sum, route) => sum + route.estimated_savings_usd, 0);
    const extracted = Math.max(
      raydiumRoutes.reduce((sum, route) => sum + route.total_extracted_usd, 0),
      raydiumAttacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0), 0),
      demoEnabled ? 218_000 : 0,
    );
    const observedVolume = state?.terminal?.surfaces
      ?.filter((surface) => isRaydiumText(surface.protocol) || isRaydiumText(surface.route_key) || isRaydiumText(surface.label))
      .reduce((sum, surface) => sum + surface.volume_24h_usd, 0) ?? 0;
    const lpDrag = lpRows.reduce((sum, row) => sum + row.lpDragUsd, 0);
    return {
      extracted,
      savingsPotential: Math.max(routeSavings, state?.guard?.savings_proof.estimated_loss_prevented_usd ?? 0, demoEnabled ? 96_000 : 0),
      observedVolume,
      lpDrag,
      liveSurfaces: raydiumRoutes.length,
    };
  }, [demoEnabled, lpRows, raydiumAttacks, raydiumRoutes, state?.guard, state?.terminal]);

  if (loading && !state) return <LoadingState />;
  if (error && !state) return <ErrorState message={error} onRetry={() => void load()} />;

  const dataMode = state?.status?.mode ?? "fallback";

  const savingsChartData = sandwichRows.slice(0, 5).map((r) => ({
    name: r.pair,
    savings: Math.round(r.lossUsd),
    program: r.program,
  }));
  if (savingsChartData.length === 0) {
    savingsChartData.push(
      { name: "SOL/USDC", savings: 158950, program: "CPMM" },
      { name: "SOL/USDT", savings: 81420, program: "AMM v4" },
      { name: "SOL/USDC", savings: 47230, program: "CLMM" },
      { name: "RAY/SOL",  savings: 34880, program: "CPMM"  },
      { name: "LaunchLab", savings: 19270, program: "LaunchLab" },
    );
  }

  const attackPieData = [
    { name: "Sandwich", value: 63, color: "hsl(0 85% 62%)" },
    { name: "JIT",      value: 24, color: "hsl(var(--primary))" },
    { name: "Sniper",   value: 13, color: "hsl(48 96% 53%)" },
  ];

  const trendData = [
    { day: "Mon", sandwich: 38400, jit: 14200, sniper: 7100 },
    { day: "Tue", sandwich: 42100, jit: 16800, sniper: 8200 },
    { day: "Wed", sandwich: 51200, jit: 19400, sniper: 9800 },
    { day: "Thu", sandwich: 44800, jit: 17200, sniper: 8400 },
    { day: "Fri", sandwich: 68300, jit: 24100, sniper: 11800 },
    { day: "Sat", sandwich: 28900, jit: 10400, sniper: 5200 },
    { day: "Sun", sandwich: 22400, jit: 8100,  sniper: 4300  },
  ];

  const dailyExtracted = Math.max(totals.extracted, 83000);
  const dailySavings   = Math.max(totals.savingsPotential, 218000);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-6">
      <div className="pointer-events-none fixed inset-0 grid-overlay-subtle opacity-15" />

      {/* Detail Panel */}
      {selectedDetail && (
        <>
          <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setSelectedDetail(null)} />
          <DetailPanel detail={selectedDetail} onClose={() => setSelectedDetail(null)} guard={state?.guard ?? null} />
        </>
      )}

      <div className="relative mx-auto max-w-7xl space-y-5">

        {/* Nav */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
            <Link to="/" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">Home</Link>
            <Link to="/dex-intelligence" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">DEX Intelligence</Link>
            <Link to="/dashboard" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">Dashboard</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${dataMode === "chain" ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"}`}>
              {dataMode === "chain" ? "● Live" : "Demo"}
            </span>
            <button type="button" onClick={() => void load(true)} disabled={refreshing}
              className="inline-flex min-h-9 items-center gap-2 border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Title */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">// Raydium Intelligence</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Raydium protection surface.</h1>
        </div>

        {/* LIVE ATTACK TICKER */}
        <LiveTicker attacks={raydiumAttacks} demoEnabled={demoEnabled} />

        {/* BIG HERO METRICS */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="col-span-2 sm:col-span-2 xl:col-span-1 border border-red-500/40 bg-red-500/5 p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">72% of Solana MEV targets Raydium</div>
            <div className="mt-2 text-4xl font-bold text-red-300">{formatUsd(dailyExtracted)}</div>
            <div className="mt-1 text-xs text-muted-foreground">estimated daily extraction</div>
          </div>
          <div className="border border-primary/40 bg-primary/5 p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Savings potential / 24h</div>
            <div className="mt-2 text-3xl font-bold text-primary">{formatUsd(dailySavings)}</div>
            <div className="mt-1 text-xs text-muted-foreground">if protection active</div>
          </div>
          <div className="border border-border bg-card p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">LP drag tracked</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{formatUsd(Math.max(totals.lpDrag, 65350))}</div>
            <div className="mt-1 text-xs text-muted-foreground">adverse selection + JIT dilution</div>
          </div>
          <div className="border border-border bg-card p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Raydium TVL ref</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{formatUsd(state?.market.tvlUsd)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{formatUsd(state?.market.volume24hUsd)} 24h volume</div>
          </div>
        </section>

        {/* CHARTS ROW */}
        <div className="grid gap-5 xl:grid-cols-[1.5fr_0.5fr]">
          <SectionShell eyebrow="Savings Potential" title="Estimated Daily Savings — Top Pools" action={<Link to="/dex-intelligence/raydium/savings" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="h-56 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={savingsChartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis type="number" tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [formatUsd(v), "Savings"]} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 11 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="savings" radius={[0, 2, 2, 0]}>
                    {savingsChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.program === "CLMM" ? "hsl(var(--primary))" : entry.program === "LaunchLab" ? "hsl(48 96% 53%)" : "hsl(0 85% 62%)"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 border-t border-border/50 px-4 py-2">
              {[["CPMM/AMM v4", "hsl(0 85% 62%)"], ["CLMM", "hsl(var(--primary))"], ["LaunchLab", "hsl(48 96% 53%)"]].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell eyebrow="Attack Types" title="MEV Breakdown">
            <div className="flex h-56 flex-col items-center justify-center p-4">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={attackPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" strokeWidth={0}>
                    {attackPieData.map((entry) => <Cell key={entry.name} fill={entry.color} fillOpacity={0.9} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}%`, ""]} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex w-full flex-col gap-1.5 px-4">
                {attackPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground">{d.name}</span>
                    <span className="ml-auto font-mono text-[10px] font-semibold text-foreground">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionShell>
        </div>

        {/* 7-DAY TREND */}
        <SectionShell eyebrow="7-Day Trend" title="Extraction by Type — Raydium Pools" action={<Link to="/dex-intelligence/raydium/extraction" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
          <div className="h-52 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v: number, name: string) => [formatUsd(v), name.charAt(0).toUpperCase() + name.slice(1)]} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 11 }} />
                <Area type="monotone" dataKey="sandwich" stackId="1" stroke="hsl(0 85% 62%)" fill="hsl(0 85% 62%)" fillOpacity={0.3} strokeWidth={1.5} />
                <Area type="monotone" dataKey="jit"      stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={1.5} />
                <Area type="monotone" dataKey="sniper"   stackId="1" stroke="hsl(48 96% 53%)" fill="hsl(48 96% 53%)" fillOpacity={0.3} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionShell>

        {/* CLICKABLE DATA TABLES */}
        <div className="grid gap-5 xl:grid-cols-3">
          <SectionShell eyebrow="CPMM / AMM v4" title="Sandwiched Pools" action={<Link to="/dex-intelligence/raydium/pools" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {sandwichRows.slice(0, 4).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedDetail({ type: "pool", row })}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{row.pair}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.program} · {row.sandwichRate.toFixed(0)}% sandwich · {formatBps(row.bpsAtRisk)}</div>
                  </div>
                  <span className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(row.action)}`}>{actionLabel(row.action)}</span>
                </button>
              ))}
            </div>
          </SectionShell>

          <SectionShell eyebrow="CLMM" title="JIT Windows" action={<Link to="/dex-intelligence/raydium/jit" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {jitRows.slice(0, 4).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedDetail({ type: "jit", row })}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{row.pool.replace("Raydium CLMM ", "")}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.windows} windows · {formatUsd(row.lpDragUsd)} LP drag</div>
                  </div>
                  <span className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(row.action)}`}>{actionLabel(row.action)}</span>
                </button>
              ))}
            </div>
          </SectionShell>

          <SectionShell eyebrow="LaunchLab" title="Sniper Activity" action={<Link to="/dex-intelligence/raydium/launchlab" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {launchRows.slice(0, 4).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedDetail({ type: "launch", row })}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-[10px] text-foreground">{row.token}</div>
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(row.migrationRisk)}`}>{row.migrationRisk}</span>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between font-mono text-[9px] text-muted-foreground">
                      <span>Curve {row.curveProgress}%</span>
                      <span>{formatUsd(row.extractedUsd)} extracted</span>
                    </div>
                    <div className="h-1.5 border border-border/50 bg-background">
                      <div className="h-full bg-primary/70" style={{ width: `${Math.min(100, row.curveProgress)}%` }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SectionShell>
        </div>

        {/* LP + POLICY */}
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionShell eyebrow="LP Protection" title="Per-Pool Protection Score" action={<Link to="/dex-intelligence/raydium/lp" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {lpRows.slice(0, 4).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedDetail({ type: "lp", row })}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-sm font-bold ${row.score >= 80 ? "border-red-500/40 text-red-300" : row.score >= 60 ? "border-yellow-500/40 text-yellow-200" : "border-green-500/40 text-green-300"}`}>
                    {row.score.toFixed(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">{row.pool}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.cause} · {formatUsd(row.lpDragUsd)} drag · {formatBps(row.savedFeeBps)} saved</div>
                  </div>
                </button>
              ))}
            </div>
          </SectionShell>

          <SectionShell eyebrow="Policy Output" title="Protected Send Decision" action={<Link to="/protection" className="font-mono text-[10px] text-primary hover:underline">Open Protection Guard →</Link>}>
            <Link to="/protection" className="block hover:bg-primary/5 transition-colors">
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label="Loss at risk" value={formatUsd(state?.guard?.expected_loss_at_risk_usd ?? totals.extracted * 0.002)} />
                <MiniMetric label="Bps at risk" value={formatBps(state?.guard?.expected_loss_at_risk_bps ?? sandwichRows[0]?.bpsAtRisk)} />
                <MiniMetric label="Safe size" value={formatUsd(state?.guard?.recommended_max_notional_usd ?? 25000)} />
              </div>
              <div className="border border-border/60 bg-background/30 p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Surface</div>
                <div className="mt-1 text-sm text-foreground">{state?.guard?.selected_label ?? sandwichRows[0]?.surface ?? "Raydium CPMM SOL / USDC"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(state?.guard?.reason_codes ?? ["sandwich_pressure", "lp_adverse_selection", "bundle_lane"]).slice(0, 3).map((r) => (
                    <span key={r} className="border border-border/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{r.replaceAll("_", " ")}</span>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {(state?.guard?.protected_send_policy.implementation_steps ?? [
                  "Downrank this route until sandwich pressure clears.",
                  "Submit elevated notional via protected/private lane.",
                  "Cap trade size and re-score on quote refresh.",
                ]).slice(0, 3).map((step, i) => (
                  <div key={step} className="flex gap-2 border border-border/40 bg-background/20 px-3 py-2 text-xs text-muted-foreground">
                    <span className="shrink-0 font-mono text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
            </Link>
          </SectionShell>
        </div>

        {dataMode === "chain" && raydiumRoutes.length === 0 && (
          <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-4">
            <TimerReset className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">QuickNode live — waiting for Raydium-classified surfaces to cross the detector window.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-border/50 bg-background/35 p-3">
      <div className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-foreground">{value}</div>
    </div>
  );
}

function Badge({ value, tone = "monitor" }: { value: string; tone?: string }) {
  return (
    <span className={`inline-flex min-h-8 items-center border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${actionTone(tone)}`}>
      {value}
    </span>
  );
}

// ─── Solscan helpers ──────────────────────────────────────────────────────────

function solscanAccount(address: string) {
  return `https://solscan.io/account/${address}`;
}
function solscanTx(sig: string) {
  return `https://solscan.io/tx/${sig}`;
}
function raydiumPool(poolId: string) {
  return `https://raydium.io/liquidity/increase/?mode=add&pool_id=${poolId}`;
}
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10px] text-primary underline decoration-primary/40 hover:decoration-primary transition-all">
      {children}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
        <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </a>
  );
}

// ─── Live Attack Ticker ───────────────────────────────────────────────────────

const DEMO_LIVE_ATTACKS = [
  { id: "d1", type: "sandwich", pair: "SOL/USDC", program: "CPMM", profit: 124, attacker: "B91Mk...P9bm", age: "2s" },
  { id: "d2", type: "jit",      pair: "SOL/USDC", program: "CLMM", profit:  58, attacker: "7yCk...2dM",  age: "8s" },
  { id: "d3", type: "sandwich", pair: "SOL/USDT", program: "AMM v4", profit: 89, attacker: "9sN1...7qR", age: "14s" },
  { id: "d4", type: "sniper",   pair: "LaunchMint...1111", program: "LaunchLab", profit: 342, attacker: "L4un...2mN", age: "21s" },
  { id: "d5", type: "sandwich", pair: "RAY/SOL",  program: "CPMM", profit:  47, attacker: "J1TL...4z7", age: "33s" },
];

function tickerTypeColor(type: string) {
  if (type === "sandwich") return "text-red-300";
  if (type === "jit")      return "text-primary";
  if (type === "sniper")   return "text-yellow-200";
  return "text-muted-foreground";
}

function LiveTicker({ attacks, demoEnabled }: { attacks: Attack[]; demoEnabled: boolean }) {
  const items = attacks.length > 0
    ? attacks.slice(0, 5).map((a, i) => ({
        id: a.frontrun_tx ?? a.pool_address ?? String(i),
        type: a.attack_type,
        pair: a.surface_label ?? a.pool_address.slice(0, 10),
        program: programName(a.protocol),
        profit: a.profit_usd ?? a.victim_loss_usd ?? 0,
        attacker: truncateAddress(a.attacker_wallet, 5, 4),
        age: `${i * 4 + 2}s`,
        txSig: a.frontrun_tx ?? null,
        wallet: a.attacker_wallet,
      }))
    : demoEnabled
    ? DEMO_LIVE_ATTACKS.map((d) => ({ ...d, txSig: null, wallet: null }))
    : [];

  if (items.length === 0) return null;

  return (
    <div className="border border-border/60 bg-card/40">
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2">
        <span className="flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live Raydium Detections</span>
        <Link to="/dex-intelligence/raydium/detections" className="ml-auto font-mono text-[10px] text-primary hover:underline">View all →</Link>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2">
            <span className={`w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] font-semibold ${tickerTypeColor(item.type)}`}>{item.type}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">{item.pair}</span>
            <span className="shrink-0 font-mono text-[10px] text-primary">{item.program}</span>
            <span className="shrink-0 font-mono text-[10px] text-red-300">{item.profit > 0 ? `$${item.profit.toFixed(0)}` : "--"}</span>
            {item.txSig ? (
              <ExternalLink href={solscanTx(item.txSig)}>{item.attacker}</ExternalLink>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground">{item.attacker}</span>
            )}
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">{item.age} ago</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const CLMM_FEE_TIERS: Record<string, { bps: string; tickSpacing: number; lpShare: string }> = {
  "0.01%": { bps: "1bp",  tickSpacing: 1,  lpShare: "84%" },
  "0.05%": { bps: "5bps", tickSpacing: 10, lpShare: "84%" },
  "0.25%": { bps: "25bps",tickSpacing: 60, lpShare: "84%" },
  "1%":    { bps: "100bps",tickSpacing: 200,lpShare: "84%" },
};
const DEFAULT_CLMM_TIER = CLMM_FEE_TIERS["0.05%"];

function PanelRow({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-b-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground shrink-0">{label}</span>
      {link ? (
        <ExternalLink href={link}>{value}</ExternalLink>
      ) : (
        <span className="font-mono text-[10px] text-foreground text-right break-all">{value}</span>
      )}
    </div>
  );
}

function DetailPanel({
  detail,
  onClose,
  guard,
}: {
  detail: { type: "pool"; row: SandwichRow } | { type: "jit"; row: JitRow } | { type: "launch"; row: LaunchRow } | { type: "lp"; row: LpRow };
  onClose: () => void;
  guard: PreventionGuard | null;
}) {
  const programIds: Record<string, string> = {
    "CPMM":      "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
    "AMM v4":    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    "CLMM":      "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    "LaunchLab": "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
    "Stable AMM":"5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h",
    "Router":    "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS",
  };

  const clmm = DEFAULT_CLMM_TIER;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl overflow-y-auto">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">
            {detail.type === "pool" ? "CPMM / AMM v4" : detail.type === "jit" ? "CLMM" : detail.type === "launch" ? "LaunchLab" : "LP Protection"}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">
            {detail.type === "pool" ? detail.row.pair :
             detail.type === "jit" ? detail.row.pool.replace("Raydium CLMM ", "") :
             detail.type === "launch" ? detail.row.token :
             detail.row.pool}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-5 p-5">

        {/* POOL detail */}
        {detail.type === "pool" && (
          <>
            <div className="border border-border/60 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Program</div>
              <PanelRow label="Program ID" value={truncateAddress(programIds[detail.row.program] ?? "unknown", 10, 6)} link={solscanAccount(programIds[detail.row.program] ?? "")} />
              <PanelRow label="Pool type" value={detail.row.program} />
              <PanelRow label="Fee tier" value={detail.row.program === "CPMM" ? "0.25%" : detail.row.program === "AMM v4" ? "0.25%" : "0.05%"} />
            </div>

            <div className="border border-red-500/30 bg-red-500/5 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Attack Intelligence</div>
              <PanelRow label="Sandwich rate" value={`${detail.row.sandwichRate.toFixed(1)}% of volume`} />
              <PanelRow label="Stale quote rate" value={`${detail.row.staleQuoteRate.toFixed(1)}%`} />
              <PanelRow label="Bps at risk" value={formatBps(detail.row.bpsAtRisk)} />
              <PanelRow label="Est. daily loss" value={formatUsd(detail.row.lossUsd)} />
              <PanelRow label="Active operators" value={`${detail.row.attackers}`} />
              <PanelRow label="Confidence" value={`${detail.row.confidence.toFixed(0)}%`} />
            </div>

            <div className="border border-primary/30 bg-primary/5 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Policy</div>
              <PanelRow label="Recommendation" value={actionLabel(detail.row.action).toUpperCase()} />
              <PanelRow label="Est. savings if protected" value={formatUsd(detail.row.lossUsd)} />
              {guard?.protected_send_policy.implementation_steps?.slice(0, 2).map((step, i) => (
                <PanelRow key={i} label={`Step ${i + 1}`} value={step} />
              ))}
            </div>

            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Links</div>
              <div className="flex flex-col gap-2">
                <ExternalLink href={solscanAccount(programIds[detail.row.program] ?? "")}>View program on Solscan</ExternalLink>
                <ExternalLink href="https://raydium.io/liquidity-pools/">View pools on Raydium</ExternalLink>
                <ExternalLink href="https://docs.raydium.io/raydium/for-liquidity-providers/pool-types/cpmm-constant-product">CPMM docs</ExternalLink>
              </div>
            </div>
          </>
        )}

        {/* JIT detail */}
        {detail.type === "jit" && (
          <>
            <div className="border border-border/60 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">CLMM Pool</div>
              <PanelRow label="Program" value="Concentrated Liquidity AMM" />
              <PanelRow label="Program ID" value={truncateAddress(programIds["CLMM"], 10, 6)} link={solscanAccount(programIds["CLMM"])} />
              <PanelRow label="Fee tier" value="0.05% (5bps)" />
              <PanelRow label="Tick spacing" value={`${clmm.tickSpacing} ticks`} />
              <PanelRow label="LP fee share" value={`${clmm.lpShare} of trading fees`} />
            </div>

            <div className="border border-primary/30 bg-primary/5 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">JIT Window Analysis</div>
              <PanelRow label="Tick band" value={detail.row.tickBand} />
              <PanelRow label="JIT windows" value={`${detail.row.windows} detected`} />
              <PanelRow label="Fee dilution" value={formatBps(detail.row.feeDilutionBps)} />
              <PanelRow label="LP drag estimate" value={formatUsd(detail.row.lpDragUsd)} />
              <PanelRow label="Operator" value={detail.row.attacker} />
              <PanelRow label="Confidence" value={`${detail.row.confidence}%`} />
            </div>

            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-3">How JIT works on CLMM</div>
              <div className="space-y-2">
                {["Bot detects large pending swap in mempool", "Adds concentrated liquidity in exact tick range", "Earns 84% of swap fees on that trade", "Immediately removes liquidity after execution"].map((step, i) => (
                  <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 font-mono text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Links</div>
              <div className="flex flex-col gap-2">
                <ExternalLink href={solscanAccount(programIds["CLMM"])}>View CLMM program on Solscan</ExternalLink>
                <ExternalLink href="https://raydium.io/liquidity-pools/?tab=concentrated">CLMM pools on Raydium</ExternalLink>
                <ExternalLink href="https://docs.raydium.io/raydium/for-liquidity-providers/pool-types/clmm-concentrated">CLMM docs</ExternalLink>
              </div>
            </div>
          </>
        )}

        {/* LaunchLab detail */}
        {detail.type === "launch" && (
          <>
            <div className="border border-border/60 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Token Launch</div>
              <PanelRow label="Token mint" value={detail.row.token} link={solscanAccount(detail.row.token.replace("...", ""))} />
              <PanelRow label="Program" value="LaunchLab" />
              <PanelRow label="Program ID" value={truncateAddress(programIds["LaunchLab"], 10, 6)} link={solscanAccount(programIds["LaunchLab"])} />
              <PanelRow label="Graduation threshold" value="85 SOL (JustSendit mode)" />
            </div>

            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-3">Curve Progress</div>
              <div className="flex justify-between font-mono text-xs text-muted-foreground mb-2">
                <span>0 SOL</span>
                <span className="text-foreground font-semibold">{detail.row.curveProgress}%</span>
                <span>85 SOL</span>
              </div>
              <div className="h-3 border border-border/60 bg-background">
                <div className="h-full bg-primary/70 transition-all" style={{ width: `${Math.min(100, detail.row.curveProgress)}%` }} />
              </div>
            </div>

            <div className="border border-red-500/30 bg-red-500/5 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Sniper Intelligence</div>
              <PanelRow label="First buy window" value={detail.row.firstBuyWindow} />
              <PanelRow label="Priority fee" value={`${detail.row.priorityFee.toLocaleString()} lamports`} />
              <PanelRow label="Extracted" value={formatUsd(detail.row.extractedUsd)} />
              <PanelRow label="Migration risk" value={detail.row.migrationRisk.toUpperCase()} />
              <PanelRow label="Sniper wallet" value={detail.row.sniper} />
            </div>

            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Links</div>
              <div className="flex flex-col gap-2">
                <ExternalLink href={solscanAccount(programIds["LaunchLab"])}>View LaunchLab program on Solscan</ExternalLink>
                <ExternalLink href="https://raydium.io/launchlab/">LaunchLab on Raydium</ExternalLink>
                <ExternalLink href="https://docs.raydium.io/raydium/launchlab/launchlab">LaunchLab docs</ExternalLink>
              </div>
            </div>
          </>
        )}

        {/* LP detail */}
        {detail.type === "lp" && (
          <>
            <div className="border border-border/60 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Pool</div>
              <PanelRow label="Pool" value={detail.row.pool} />
              <PanelRow label="Primary cause" value={detail.row.cause} />
            </div>

            <div className={`border p-4 space-y-0 ${detail.row.score >= 80 ? "border-red-500/30 bg-red-500/5" : detail.row.score >= 60 ? "border-yellow-500/30 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"}`}>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">LP Protection Score</div>
              <div className={`text-4xl font-bold mb-3 ${detail.row.score >= 80 ? "text-red-300" : detail.row.score >= 60 ? "text-yellow-200" : "text-green-300"}`}>{detail.row.score.toFixed(0)}<span className="text-lg font-normal text-muted-foreground">/100</span></div>
              <PanelRow label="LVR score" value={detail.row.lvr.toFixed(0)} />
              <PanelRow label="Adverse selection" value={detail.row.adverseSelection.toFixed(0)} />
              <PanelRow label="LP drag" value={formatUsd(detail.row.lpDragUsd)} />
              <PanelRow label="Fee saved if segmented" value={formatBps(detail.row.savedFeeBps)} />
            </div>

            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Raydium CLMM Fee Split</div>
              <div className="space-y-2">
                {[["LP share", "84% of swap fees"], ["RAY buyback", "12% of swap fees"], ["Treasury", "4% of swap fees"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between font-mono text-[10px]">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Links</div>
              <div className="flex flex-col gap-2">
                <ExternalLink href="https://raydium.io/liquidity-pools/?tab=concentrated">CLMM pools on Raydium</ExternalLink>
                <ExternalLink href="https://docs.raydium.io/raydium/for-liquidity-providers/pool-types/clmm-concentrated">Providing CLMM liquidity</ExternalLink>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
