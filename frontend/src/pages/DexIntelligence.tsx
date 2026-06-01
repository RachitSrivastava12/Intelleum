import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  RefreshCw,
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
  AttackDetail,
  LpProtectionSnapshot,
  PoolToxicity,
  PreventionGuard,
  RouteRisk,
  SystemStatus,
  ToxicFlowTerminal,
} from "@/lib/api";
import {
  demoSystemStatus,
  getDemoRaydiumAttacks,
  getDemoRaydiumLpProtection,
  getDemoRaydiumPools,
  getDemoRaydiumRoutes,
} from "@/lib/demoData";
import { formatPoolLabel, formatRelativeTime, truncateAddress } from "@/lib/utils";

type MarketReference = {
  tvlUsd: number | null;
  volume24hUsd: number | null;
  volume7dUsd: number | null;
  volume30dUsd: number | null;
  fees24hUsd: number | null;
  updatedAt: string;
  source: "defillama" | "unavailable";
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
  curveProgress: number | null;
  firstBuyWindow: string | null;
  priorityFee: number;
  sniper: string;
  migrationRisk: "low" | "medium" | "high" | null;
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

const EMPTY_MARKET_REFERENCE: MarketReference = {
  tvlUsd: null,
  volume24hUsd: null,
  volume7dUsd: null,
  volume30dUsd: null,
  fees24hUsd: null,
  updatedAt: new Date(0).toISOString(),
  source: "unavailable",
};

const ENABLE_LOCAL_RAYDIUM_DEMO =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_RAYDIUM_DEMO === "true";

function buildRaydiumDemoStatus(base?: SystemStatus | null): SystemStatus {
  const attacks = getDemoRaydiumAttacks();
  const routes = getDemoRaydiumRoutes();
  const previous = base ?? demoSystemStatus;

  return {
    ...previous,
    mode: "fallback",
    started: true,
    syncing: false,
    attacksDetected: attacks.length,
    lastError: "Local Raydium demo scenario. Chain feed is offline.",
    recentMetrics: {
      ...previous.recentMetrics,
      candidateRows: routes.reduce((sum, route) => sum + route.total_attacks, 0),
      detectedAttacks: attacks.length,
      parsedTransactions: Math.max(previous.recentMetrics.parsedTransactions, 148),
      parsedSwaps: Math.max(previous.recentMetrics.parsedSwaps, 86),
      rawSlotTxs: Math.max(previous.recentMetrics.rawSlotTxs, 420),
      sandwichCandidates: attacks.filter((attack) => attack.attack_type === "sandwich").length,
      arbitrageCandidates: attacks.filter((attack) => attack.attack_type === "arbitrage").length,
      jitCandidates: attacks.filter((attack) => attack.attack_type === "jit").length,
      liquiditySnipeCandidates: attacks.filter((attack) => attack.attack_type === "liquidity_snipe").length,
      liquidityDrainCandidates: attacks.filter((attack) => attack.attack_type === "liquidity_drain").length,
      backrunCandidates: routes.reduce((sum, route) => sum + route.backrun_count, 0),
      suspiciousCandidates: attacks.length,
    },
    recentAttackPreview: attacks.slice(0, 8).map((attack) => ({
      attack_type: attack.attack_type,
      detector: attack.detector ?? "raydium_local_demo",
      confidence: attack.confidence,
      slot: attack.slot,
    })),
  };
}

function buildRaydiumDemoState(previous?: RaydiumIntelState | null, status?: SystemStatus | null): RaydiumIntelState {
  return {
    status: buildRaydiumDemoStatus(status),
    routes: getDemoRaydiumRoutes(),
    attacks: getDemoRaydiumAttacks(),
    pools: getDemoRaydiumPools(),
    lpProtection: getDemoRaydiumLpProtection(),
    terminal: previous?.terminal ?? null,
    market: previous?.market ?? EMPTY_MARKET_REFERENCE,
    guard: previous?.guard ?? null,
  };
}

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

function hasRaydiumSurface(
  routes: RouteRisk[],
  attacks: Attack[],
  pools: PoolToxicity[],
  lpProtection: LpProtectionSnapshot[],
) {
  return (
    routes.some(isRaydiumRoute) ||
    attacks.some(isRaydiumAttack) ||
    pools.some(isRaydiumPool) ||
    lpProtection.some(isRaydiumPool)
  );
}

function shouldUseLocalRaydiumDemo(
  status: SystemStatus,
  routes: RouteRisk[],
  attacks: Attack[],
  pools: PoolToxicity[],
  lpProtection: LpProtectionSnapshot[],
) {
  return (
    ENABLE_LOCAL_RAYDIUM_DEMO &&
    (status.mode !== "chain" || !hasRaydiumSurface(routes, attacks, pools, lpProtection))
  );
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
  return action.split("_").join(" ");
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

function sortByRisk<T extends { id: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aRisk = Number((a as any).lossUsd ?? (a as any).lpDragUsd ?? (a as any).score ?? (a as any).bpsAtRisk ?? 0);
    const bRisk = Number((b as any).lossUsd ?? (b as any).lpDragUsd ?? (b as any).score ?? (b as any).bpsAtRisk ?? 0);
    return bRisk - aRisk;
  });
}

let raydiumMarketReferenceCache: { data: MarketReference; expires: number } | null = null;

async function fetchJsonWithTimeout(url: string, timeoutMs = 2_500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadRaydiumMarketReference(): Promise<MarketReference> {
  const now = Date.now();
  if (raydiumMarketReferenceCache && now < raydiumMarketReferenceCache.expires) {
    return raydiumMarketReferenceCache.data;
  }

  try {
    const [protocol, dex, fees] = await Promise.all([
      fetchJsonWithTimeout("https://api.llama.fi/protocol/raydium"),
      fetchJsonWithTimeout("https://api.llama.fi/overview/dexs/solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume"),
      fetchJsonWithTimeout("https://api.llama.fi/overview/fees/solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyFees"),
    ]);
    const tvlRow = Array.isArray(protocol?.tvl) ? protocol.tvl[protocol.tvl.length - 1] : null;
    const raydiumDex = dex?.protocols?.find((item: any) => item?.name === "Raydium AMM");
    const raydiumFees = fees?.protocols?.find((item: any) => item?.name === "Raydium AMM");

    const data: MarketReference = {
      tvlUsd: tvlRow?.totalLiquidityUSD ?? null,
      volume24hUsd: raydiumDex?.total24h ?? null,
      volume7dUsd: raydiumDex?.total7d ?? null,
      volume30dUsd: raydiumDex?.total30d ?? null,
      fees24hUsd: raydiumFees?.total24h ?? null,
      updatedAt: tvlRow?.date ? new Date(tvlRow.date * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      source: "defillama",
    };
    raydiumMarketReferenceCache = { data, expires: now + 10 * 60_000 };
    return data;
  } catch {
    if (raydiumMarketReferenceCache) return raydiumMarketReferenceCache.data;
    return EMPTY_MARKET_REFERENCE;
  }
}

function buildSandwichRows(routes: RouteRisk[], pools: PoolToxicity[]): SandwichRow[] {
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
      const action: SandwichRow["action"] = pool.toxicity_score >= 80 ? "avoid" : pool.toxicity_score >= 60 ? "penalize" : "monitor";
      return {
        id: pool.pool_address,
        surface: formatPoolLabel(pool.pool_address),
        program: programName(pool.protocol, "Pool"),
        pair: pairFromSurface(pool.pool_address),
        sandwichRate: Number(((pool.sandwich_count / attackBase) * 100).toFixed(1)),
        staleQuoteRate: pool.stale_quote_arb_frequency ?? 0,
        bpsAtRisk: pool.saved_fee_bps_if_segmented ?? 0,
        lossUsd: pool.lp_drag_estimate_usd ?? pool.total_extracted_usd,
        action,
        attackers: pool.unique_attackers,
        confidence: Math.min(96, Math.max(60, pool.toxicity_score)),
      };
    });

  const byId = new Map<string, SandwichRow>();
  [...routeRows, ...poolRows].forEach((row) => byId.set(row.id, row));
  return sortByRisk([...byId.values()]).slice(0, 6);
}

function buildJitRows(routes: RouteRisk[], attacks: Attack[]): JitRow[] {
  const fromRoutes = routes
    .filter(isRaydiumRoute)
    .filter((route) => route.jit_count > 0 || /clmm/i.test(route.protocol ?? route.route_key))
    .map((route) => {
      const action: JitRow["action"] = route.policy_action === "avoid" || route.policy_action === "reroute"
        ? "reroute"
        : route.policy_action === "penalize"
          ? "cap"
          : "monitor";
      return {
        id: route.route_key,
        pool: route.label || formatPoolLabel(route.route_key),
        tickBand: formatBps(route.markout_30s_bps),
        windows: Math.max(1, route.jit_count),
        feeDilutionBps: route.markout_5s_bps,
        lpDragUsd: route.lp_annual_loss_usd_estimate,
        attacker: `${route.unique_attackers} operator${route.unique_attackers === 1 ? "" : "s"}`,
        confidence: route.avg_confidence,
        action,
      };
    });

  const fromAttacks = attacks
    .filter(isRaydiumAttack)
    .filter((attack) => attack.attack_type === "jit")
    .map((attack) => ({
      id: attack.frontrun_tx ?? attack.pool_address,
      pool: attack.surface_label ?? formatPoolLabel(attack.pool_address),
      tickBand: "single detection",
      windows: 1,
      feeDilutionBps: 0,
      lpDragUsd: attack.victim_loss_usd ?? attack.profit_usd ?? 0,
      attacker: truncateAddress(attack.attacker_wallet, 8, 6),
      confidence: Number((attack.confidence * 100).toFixed(0)),
      action: "cap" as const,
    }));

  const byId = new Map<string, JitRow>();
  [...fromRoutes, ...fromAttacks].forEach((row) => byId.set(row.id, row));
  return sortByRisk([...byId.values()]).slice(0, 5);
}

function buildLaunchRows(attacks: Attack[]): LaunchRow[] {
  const rows = attacks
    .filter(isRaydiumAttack)
    .filter((attack) => attack.attack_type === "liquidity_snipe" || /launch/i.test(attack.pool_address))
    .map((attack) => {
      const fee = attack.tip_lamports ?? 0;
      return {
        id: attack.victim_tx ?? attack.frontrun_tx ?? attack.pool_address,
        token: attack.token_mint ? truncateAddress(attack.token_mint, 8, 5) : "Unknown mint",
        curveProgress: null,
        firstBuyWindow: attack.evidence?.some((line) => /same slot/i.test(line)) ? "same slot" : null,
        priorityFee: fee,
        sniper: truncateAddress(attack.attacker_wallet, 8, 6),
        migrationRisk: null,
        extractedUsd: attack.profit_usd ?? attack.victim_loss_usd ?? 0,
      } satisfies LaunchRow;
    });

  return sortByRisk(rows).slice(0, 5);
}

function buildLpRows(lpProtection: LpProtectionSnapshot[], pools: PoolToxicity[]): LpRow[] {
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
  return sortByRisk([...byId.values()]).slice(0, 6);
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
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [attackDetails, setAttackDetails] = useState<Record<number, AttackDetail>>({});
  const [attackDetailError, setAttackDetailError] = useState<string | null>(null);
  const [attackDetailLoading, setAttackDetailLoading] = useState(false);

  // Critical path: only the data needed to render the page immediately.
  // Market reference (3 DefiLlama fetches) and guard plan (sequential POST) are
  // loaded in background after first paint so they don't block the UI.
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // Load status first — it's fast and unblocks the page skeleton
      const status = await api.systemStatus();
      // Then load the rest; toxicFlowTerminal is slow so run it independently
      const [routes, attacks, pools, lpProtection] = await Promise.all([
        api.routeRisks(20),
        api.attacks({ limit: "20" }),
        api.pools(20),
        api.lpProtection(20),
      ]);
      // Terminal loads in background — don't let it block the main page
      api.toxicFlowTerminal(8, "1m").then((terminal) =>
        setState((prev) => prev ? { ...prev, terminal } : prev)
      ).catch(() => {});

      setState((prev) => ({
        ...(shouldUseLocalRaydiumDemo(status, routes, attacks, pools, lpProtection)
          ? buildRaydiumDemoState(prev, status)
          : {
              status,
              routes,
              attacks,
              pools,
              lpProtection,
              market: prev?.market ?? EMPTY_MARKET_REFERENCE,
              guard: prev?.guard ?? null,
            }),
        terminal: prev?.terminal ?? null,
      }));
    } catch (err) {
      if (ENABLE_LOCAL_RAYDIUM_DEMO) {
        setState((prev) => buildRaydiumDemoState(prev));
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Raydium intelligence failed");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load market reference in background — doesn't block the page
  useEffect(() => {
    loadRaydiumMarketReference().then((market) =>
      setState((prev) => prev ? { ...prev, market } : prev)
    ).catch(() => {});
  }, []);

  // Load guard plan in background after routes are ready
  useEffect(() => {
    const routes = state?.routes;
    if (!routes || routes.length === 0) return;
    const guardTarget = buildGuardTarget(routes);
    if (!guardTarget) return;
    api.protectedSendPlan({
      route_key: guardTarget.route_key,
      route_label: guardTarget.label,
      protocol: guardTarget.protocol,
      notional_usd: Math.max(25_000, guardTarget.recommended_max_notional_usd * 2),
      slippage_bps: 50,
      objective: "protect_users",
      candidates: routes.filter(isRaydiumRoute).slice(0, 6).map((r) => ({
        route_key: r.route_key,
        label: r.label,
        protocol: r.protocol,
      })),
    }).then((guard) =>
      setState((prev) => prev ? { ...prev, guard } : prev)
    ).catch(() => {});
  }, [state?.routes]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!selectedAttack) {
      setAttackDetailError(null);
      setAttackDetailLoading(false);
      return;
    }

    if (attackDetails[selectedAttack.id]) {
      setAttackDetailError(null);
      setAttackDetailLoading(false);
      return;
    }

    setAttackDetailLoading(true);
    setAttackDetailError(null);
    api.attackDetail(selectedAttack.id)
      .then((detail) => {
        setAttackDetails((prev) => ({ ...prev, [detail.id]: detail }));
      })
      .catch((err) => {
        if (ENABLE_LOCAL_RAYDIUM_DEMO && state?.status?.mode !== "chain") {
          setAttackDetails((prev) => ({ ...prev, [selectedAttack.id]: selectedAttack as AttackDetail }));
          return;
        }
        setAttackDetailError(err instanceof Error ? err.message : "Failed to load attack details");
      })
      .finally(() => setAttackDetailLoading(false));
  }, [selectedAttack, attackDetails, state?.status?.mode]);

  const [selectedDetail, setSelectedDetail] = useState<
    | { type: "pool"; row: SandwichRow }
    | { type: "jit"; row: JitRow }
    | { type: "launch"; row: LaunchRow }
    | { type: "lp"; row: LpRow }
    | null
  >(null);

  const isLiveChain = state?.status?.mode === "chain";
  const isLocalDemo = !!state && !isLiveChain && ENABLE_LOCAL_RAYDIUM_DEMO;
  const dataMode = state?.status?.mode ?? "fallback";
  const sourceText = isLocalDemo ? "local demo scenario" : "current API detections";
  const routeSource = useMemo(
    () => ((isLiveChain || isLocalDemo) ? state?.routes ?? [] : []),
    [isLiveChain, isLocalDemo, state?.routes],
  );
  const attackSource = useMemo(
    () => ((isLiveChain || isLocalDemo) ? state?.attacks ?? [] : []),
    [isLiveChain, isLocalDemo, state?.attacks],
  );
  const poolSource = useMemo(
    () => ((isLiveChain || isLocalDemo) ? state?.pools ?? [] : []),
    [isLiveChain, isLocalDemo, state?.pools],
  );
  const lpProtectionSource = useMemo(
    () => ((isLiveChain || isLocalDemo) ? state?.lpProtection ?? [] : []),
    [isLiveChain, isLocalDemo, state?.lpProtection],
  );
  const raydiumRoutes = useMemo(() => routeSource.filter(isRaydiumRoute), [routeSource]);
  const raydiumAttacks = useMemo(() => attackSource.filter(isRaydiumAttack), [attackSource]);
  const sandwichRows = useMemo(() => buildSandwichRows(routeSource, poolSource), [routeSource, poolSource]);
  const jitRows = useMemo(() => buildJitRows(routeSource, attackSource), [routeSource, attackSource]);
  const launchRows = useMemo(() => buildLaunchRows(attackSource), [attackSource]);
  const lpRows = useMemo(() => buildLpRows(lpProtectionSource, poolSource), [lpProtectionSource, poolSource]);

  const totals = useMemo(() => {
    const routeSavings = raydiumRoutes.reduce((sum, route) => sum + route.estimated_savings_usd, 0);
    // Use profit_usd per attack (the searcher's net gain). Victim loss is a separate metric and
    // adding both would double-count the same event. Fall back to victim_loss only when profit_usd
    // is absent (e.g. liquidity_snipe attacks where profit is realized later).
    const attackExtracted = raydiumAttacks.reduce((sum, attack) => {
      const value = attack.profit_usd != null
        ? attack.profit_usd
        : (attack.victim_loss_usd ?? 0);
      return sum + value;
    }, 0);
    const extracted = Math.max(
      raydiumRoutes.reduce((sum, route) => sum + route.total_extracted_usd, 0),
      attackExtracted,
      0,
    );
    const observedVolume = state?.terminal?.surfaces
      ?.filter((surface) => isRaydiumText(surface.protocol) || isRaydiumText(surface.route_key) || isRaydiumText(surface.label))
      .reduce((sum, surface) => sum + surface.volume_24h_usd, 0) ?? 0;
    const lpDrag = lpRows.reduce((sum, row) => sum + row.lpDragUsd, 0);
    return {
      extracted,
      savingsPotential: Math.max(routeSavings, state?.guard?.savings_proof.estimated_loss_prevented_usd ?? 0),
      observedVolume,
      lpDrag,
      liveSurfaces: raydiumRoutes.length,
    };
  }, [lpRows, raydiumAttacks, raydiumRoutes, state?.guard, state?.terminal]);

  const trendData = useMemo(() => {
    if (!isLiveChain && raydiumAttacks.length === 0) return [];
    const surfaces = state?.terminal?.surfaces ?? [];
    const raydiumSurfaces = surfaces.filter(
      (s) => isRaydiumText(s.protocol) || isRaydiumText(s.route_key) || isRaydiumText(s.label),
    );
    const allCandles = raydiumSurfaces.flatMap((surface) => surface.candles?.map((candle) => ({ ...candle, surface })) ?? []);
    const validCandles = allCandles
      .map((candle) => ({ ...candle, ts: new Date(candle.timestamp).getTime() }))
      .filter((candle) => Number.isFinite(candle.ts))
      .sort((a, b) => a.ts - b.ts);

    if (validCandles.length > 0) {
      const bucketCount = Math.min(12, Math.max(1, validCandles.length));
      const startMs = validCandles[0].ts;
      const endMs = validCandles[validCandles.length - 1].ts;
      const spanMs = Math.max(1, endMs - startMs);
      const bucketMs = Math.max(1, spanMs / bucketCount);
      const seedMap = new Map<number, { sandwich: number; jit: number; sniper: number; other: number }>();

      for (const candle of validCandles) {
        const idx = Math.max(0, Math.min(bucketCount - 1, Math.floor((candle.ts - startMs) / bucketMs)));
        const prev = seedMap.get(idx) ?? { sandwich: 0, jit: 0, sniper: 0, other: 0 };
        const eventType = candle.event_type ?? null;
        const value = candle.loss_at_risk_usd ?? 0;

        if (eventType === "sandwich") prev.sandwich += value;
        else if (eventType === "jit") prev.jit += value;
        else if (eventType === "liquidity_snipe" || eventType === "liquidity_drain") prev.sniper += value;
        else prev.other += value;

        seedMap.set(idx, prev);
      }

      return Array.from({ length: bucketCount }, (_, i) => {
        const bucketStart = startMs + i * bucketMs;
        const label = new Date(bucketStart).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const b = seedMap.get(i) ?? { sandwich: 0, jit: 0, sniper: 0, other: 0 };
        return { day: label, sandwich: b.sandwich, jit: b.jit, sniper: b.sniper, other: b.other };
      }).filter((bucket) => bucket.sandwich + bucket.jit + bucket.sniper + bucket.other > 0);
    }

    return raydiumAttacks
      .map((attack) => {
        const ts = new Date(attack.block_time).getTime();
        // Use profit only — don't add victim_loss (same event, different perspective)
        const value = attack.profit_usd != null ? attack.profit_usd : (attack.victim_loss_usd ?? 0);
        const kind = attack.attack_type === "jit" ? "jit"
          : attack.attack_type === "sandwich" ? "sandwich"
          : (attack.attack_type === "liquidity_snipe" || attack.attack_type === "liquidity_drain") ? "sniper"
          : "other";
        return { ts, value, kind };
      })
      .filter((attack) => Number.isFinite(attack.ts) && attack.value > 0)
      .sort((a, b) => a.ts - b.ts)
      .map((attack) => ({
        day: new Date(attack.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        sandwich: attack.kind === "sandwich" ? attack.value : 0,
        jit: attack.kind === "jit" ? attack.value : 0,
        sniper: attack.kind === "sniper" ? attack.value : 0,
        other: attack.kind === "other" ? attack.value : 0,
      }));
  }, [isLiveChain, raydiumAttacks, state?.terminal]);

  const trendWindowLabel = trendData.length > 0 ? "Observed Window" : "Live Window";

  const savingsChartData = sandwichRows.slice(0, 5).map((r) => ({
    name: r.pair,
    savings: Math.round(r.lossUsd),
    program: r.program,
  }));

  const attackTypeCounts = useMemo(() => {
    const counts = { sandwich: 0, jit: 0, backrun: 0, arbitrage: 0, sniper: 0, liquidation: 0 };
    raydiumAttacks.forEach((attack) => {
      if (attack.attack_type === "sandwich") counts.sandwich += 1;
      else if (attack.attack_type === "jit") counts.jit += 1;
      else if (attack.attack_type === "backrun") counts.backrun += 1;
      else if (attack.attack_type === "arbitrage") counts.arbitrage += 1;
      else if (attack.attack_type === "liquidity_snipe" || attack.attack_type === "liquidity_drain") counts.sniper += 1;
      else if (attack.attack_type === "liquidation") counts.liquidation += 1;
    });
    return counts;
  }, [raydiumAttacks]);

  const attackPieData = useMemo(() => {
    const entries = [
      { name: "Sandwich",   value: attackTypeCounts.sandwich,   color: "hsl(0 85% 62%)" },
      { name: "JIT",        value: attackTypeCounts.jit,        color: "hsl(var(--primary))" },
      { name: "Backrun",    value: attackTypeCounts.backrun,     color: "hsl(28 90% 60%)" },
      { name: "Arb",        value: attackTypeCounts.arbitrage,   color: "hsl(210 80% 65%)" },
      { name: "Sniper",     value: attackTypeCounts.sniper,      color: "hsl(48 96% 53%)" },
      { name: "Liquidation",value: attackTypeCounts.liquidation, color: "hsl(270 70% 60%)" },
    ].filter((e) => e.value > 0);
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    if (total === 0) return [];
    return entries.map((e) => ({ ...e, value: Math.round((e.value / total) * 100) }));
  }, [attackTypeCounts]);

  const dailyExtracted = totals.extracted;
  const dailySavings = totals.savingsPotential;
  const hasSavingsData = savingsChartData.length > 0;
  const hasTrendData = trendData.length > 0;
  const hasAttackPieData = attackPieData.length > 0;
  const attackDetail = selectedAttack ? attackDetails[selectedAttack.id] : null;

  if (loading && !state) return <LoadingState />;
  if (error && !state) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-6">
      <div className="pointer-events-none fixed inset-0 grid-overlay-subtle opacity-15" />

      {/* Detail Panel */}
      {selectedDetail && (
        <>
          <button
            type="button"
            aria-label="Close detail panel"
            className="fixed inset-0 z-40 cursor-default bg-background/60 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setSelectedDetail(null)}
          />
          <DetailPanel detail={selectedDetail} onClose={() => setSelectedDetail(null)} guard={state?.guard ?? null} />
        </>
      )}

      {selectedAttack && (
        <>
          <button
            type="button"
            aria-label="Close attack detail"
            className="fixed inset-0 z-40 cursor-default bg-background/60 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setSelectedAttack(null)}
          />
          <AttackDetailPanel
            attack={selectedAttack}
            detail={attackDetail}
            loading={attackDetailLoading}
            error={attackDetailError}
            onClose={() => setSelectedAttack(null)}
          />
        </>
      )}

      <div className="relative mx-auto max-w-7xl space-y-5">

        {/* Nav */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
            <Link to="/" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Home</Link>
            <Link to="/dex-intelligence" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">DEX Intelligence</Link>
            <Link to="/dashboard" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Dashboard</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${dataMode === "chain" ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"}`}>
              {dataMode === "chain" ? "Live chain" : isLocalDemo ? "Local demo" : "Waiting for chain"}
            </span>
            <button type="button" onClick={() => void load(true)} disabled={refreshing}
              className="inline-flex min-h-10 items-center gap-2 border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Title */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Raydium Intelligence</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Raydium protection surface.</h1>
        </div>

        {/* Live-data notice */}
        {!isLiveChain && (
          <div className="flex items-center gap-3 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-yellow-200">
              {isLocalDemo
                ? "Local Raydium demo scenario. Live chain data replaces this automatically when the API returns Raydium rows."
                : "Waiting for chain feed. Raydium rows stay empty until the API returns live data."}
            </p>
          </div>
        )}

        {/* LIVE ATTACK TICKER */}
        <LiveTicker attacks={raydiumAttacks} onAttackClick={setSelectedAttack} />

        {/* BIG HERO METRICS */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="col-span-2 sm:col-span-2 xl:col-span-1 border border-red-500/40 bg-red-500/5 p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Observed Raydium extraction</div>
            <div className="mt-2 text-4xl font-bold text-red-300">{formatUsd(dailyExtracted)}</div>
            <div className="mt-1 text-xs text-muted-foreground">from {sourceText}</div>
          </div>
          <div className="border border-primary/40 bg-primary/5 p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Savings potential / 24h</div>
            <div className="mt-2 text-3xl font-bold text-primary">{formatUsd(dailySavings)}</div>
            <div className="mt-1 text-xs text-muted-foreground">if protection active</div>
          </div>
          <div className="border border-border bg-card p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">LP drag tracked</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{formatUsd(totals.lpDrag)}</div>
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
          <SectionShell eyebrow="Savings Potential" title="Estimated Savings — Top Pools" action={<Link to="/dex-intelligence/raydium/savings" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="h-56 p-4">
              {hasSavingsData ? (
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
              ) : (
                <div className="flex h-full items-center justify-center rounded border border-dashed border-border/50 bg-background/80 text-sm text-muted-foreground">
                  Raydium sandwich risk is still warming up. Live savings appear once enough protocol surface is tracked.
                </div>
              )}
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
              {hasAttackPieData ? (
                <>
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
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded border border-dashed border-border/50 bg-background/80 text-sm text-muted-foreground">
                  No Raydium attack breakdown available yet. Wait for the live feed to accumulate classified detections.
                </div>
              )}
            </div>
          </SectionShell>
        </div>

        {/* OBSERVED TREND */}
        <SectionShell eyebrow={trendWindowLabel} title="Extraction by Type — Raydium Pools" action={<Link to="/dex-intelligence/raydium/extraction" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>

          <div className="h-52 p-4">
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v: number, name: string) => [formatUsd(v), name.charAt(0).toUpperCase() + name.slice(1)]} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 11 }} />
                  <Area type="monotone" dataKey="sandwich" stackId="1" stroke="hsl(0 85% 62%)" fill="hsl(0 85% 62%)" fillOpacity={0.3} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="jit"      stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="sniper"   stackId="1" stroke="hsl(48 96% 53%)" fill="hsl(48 96% 53%)" fillOpacity={0.3} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="other"    stackId="1" stroke="hsl(28 90% 60%)" fill="hsl(28 90% 60%)" fillOpacity={0.3} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded border border-dashed border-border/50 bg-background/80 text-sm text-muted-foreground">
                No Raydium extraction trend available yet. Waiting for the live toxic flow terminal to ingest Raydium surfaces.
              </div>
            )}
          </div>
        </SectionShell>

        {/* CLICKABLE DATA TABLES */}
        <div className="grid gap-5 xl:grid-cols-3">
          <SectionShell eyebrow="CPMM / AMM v4" title="Sandwiched Pools" action={<Link to="/dex-intelligence/raydium/pools" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {sandwichRows.length > 0 ? sandwichRows.slice(0, 4).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedDetail({ type: "pool", row })}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{row.pair}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.program} · {row.sandwichRate.toFixed(0)}% sandwich · {formatBps(row.bpsAtRisk)}</div>
                  </div>
                  <span className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(row.action)}`}>{actionLabel(row.action)}</span>
                </button>
              )) : <EmptyInline message="No Raydium sandwich pools in the current API window." />}
            </div>
          </SectionShell>

          <SectionShell eyebrow="CLMM" title="JIT Windows" action={<Link to="/dex-intelligence/raydium/jit" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {jitRows.length > 0 ? jitRows.slice(0, 4).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedDetail({ type: "jit", row })}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{row.pool.replace("Raydium CLMM ", "")}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.windows} windows · {formatUsd(row.lpDragUsd)} LP drag</div>
                  </div>
                  <span className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(row.action)}`}>{actionLabel(row.action)}</span>
                </button>
              )) : <EmptyInline message="No Raydium JIT windows in the current API window." />}
            </div>
          </SectionShell>

          <SectionShell eyebrow="LaunchLab" title="Sniper Activity" action={<Link to="/dex-intelligence/raydium/launchlab" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {launchRows.length > 0 ? launchRows.slice(0, 4).map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedDetail({ type: "launch", row })}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-[10px] text-foreground">{row.token}</div>
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(row.migrationRisk ?? "monitor")}`}>{row.migrationRisk ?? "unknown"}</span>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between font-mono text-[9px] text-muted-foreground">
                      <span>Curve {row.curveProgress == null ? "--" : `${row.curveProgress}%`}</span>
                      <span>{formatUsd(row.extractedUsd)} extracted</span>
                    </div>
                    {row.curveProgress != null && (
                      <div className="h-1.5 border border-border/50 bg-background">
                        <div className="h-full bg-primary/70" style={{ width: `${Math.min(100, row.curveProgress)}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              )) : <EmptyInline message="No LaunchLab sniper detections in the current API window." />}
            </div>
          </SectionShell>
        </div>

        {/* LP + POLICY */}
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionShell eyebrow="LP Protection" title="Per-Pool Protection Score" action={<Link to="/dex-intelligence/raydium/lp" className="font-mono text-[10px] text-primary hover:underline">View full →</Link>}>
            <div className="divide-y divide-border/40">
              {lpRows.length > 0 ? lpRows.slice(0, 4).map((row) => (
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
              )) : <EmptyInline message="No Raydium LP protection rows in the current API window." />}
            </div>
          </SectionShell>

          <SectionShell eyebrow="Policy Output" title="Protected Send Decision" action={<Link to="/protection" className="font-mono text-[10px] text-primary hover:underline">Open Protection Guard →</Link>}>
            <Link to="/protection" className="block hover:bg-primary/5 transition-colors">
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label="Loss at risk" value={formatUsd(state?.guard?.expected_loss_at_risk_usd)} />
                <MiniMetric label="Bps at risk" value={formatBps(state?.guard?.expected_loss_at_risk_bps ?? sandwichRows[0]?.bpsAtRisk)} />
                <MiniMetric label="Safe size" value={formatUsd(state?.guard?.recommended_max_notional_usd)} />
              </div>
              <div className="border border-border/60 bg-background/30 p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Surface</div>
                <div className="mt-1 text-sm text-foreground">{state?.guard?.selected_label ?? sandwichRows[0]?.surface ?? "No protected-send route selected yet"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(state?.guard?.reason_codes ?? []).slice(0, 3).map((r) => (
                    <span key={r} className="border border-border/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{r.split("_").join(" ")}</span>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {(state?.guard?.protected_send_policy.implementation_steps ?? []).slice(0, 3).map((step, i) => (
                  <div key={step} className="flex gap-2 border border-border/40 bg-background/20 px-3 py-2 text-xs text-muted-foreground">
                    <span className="shrink-0 font-mono text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <span>{step}</span>
                  </div>
                ))}
                {!state?.guard && <EmptyInline message="No protected-send decision yet. The guard will populate after live Raydium routes appear." />}
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

function EmptyInline({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Solscan helpers ──────────────────────────────────────────────────────────

function solscanAccount(address: string) {
  return `https://solscan.io/account/${address}`;
}
function solscanTx(sig: string) {
  return `https://solscan.io/tx/${sig}`;
}
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10px] text-primary underline decoration-primary/40 transition-all hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {children}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
        <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </a>
  );
}

// ─── Live Attack Ticker ───────────────────────────────────────────────────────

function tickerTypeColor(type: string) {
  if (type === "sandwich") return "text-red-300";
  if (type === "jit")      return "text-primary";
  if (type === "sniper")   return "text-yellow-200";
  return "text-muted-foreground";
}

type LiveTickerItem = {
  attack?: Attack;
  id: string;
  type: string;
  pair: string;
  program: string;
  profit: number;
  attacker: string;
  age: string;
  txSig: string | null;
  wallet: string | null;
};

function LiveTicker({ attacks, onAttackClick }: { attacks: Attack[]; onAttackClick?: (attack: Attack) => void }) {
  const items: LiveTickerItem[] = attacks.length > 0
    ? attacks.slice(0, 5).map((a, i) => ({
        attack: a,
        id: a.frontrun_tx ?? a.pool_address ?? String(i),
        type: a.attack_type,
        pair: a.surface_label ?? a.pool_address.slice(0, 10),
        program: programName(a.protocol),
        profit: a.profit_usd ?? a.victim_loss_usd ?? 0,
        attacker: truncateAddress(a.attacker_wallet, 5, 4),
        age: a.block_time ? formatRelativeTime(a.block_time) : `${i * 4 + 2}s`,
        txSig: a.frontrun_tx ?? null,
        wallet: a.attacker_wallet,
      }))
    : [];

  if (items.length === 0) {
    return (
      <div className="border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        No Raydium detections available in the current feed window. Live Raydium detection will appear here when the chain stream identifies suspicious flow.
      </div>
    );
  }

  return (
    <div className="border border-border/60 bg-card/40">
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2">
        <span className="flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live Raydium Detections</span>
        <Link to="/dex-intelligence/raydium/detections" className="ml-auto font-mono text-[10px] text-primary hover:underline">View all →</Link>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => item.attack && onAttackClick?.(item.attack)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <span className={`w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] font-semibold ${tickerTypeColor(item.type)}`}>{item.type}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">{item.pair}</span>
            <span className="shrink-0 font-mono text-[10px] text-primary">{item.program}</span>
            <span className="shrink-0 font-mono text-[10px] text-red-300">{item.profit > 0 ? `$${item.profit.toFixed(0)}` : "--"}</span>
            {item.txSig ? (
              <ExternalLink href={solscanTx(item.txSig)}>{item.attacker}</ExternalLink>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground">{item.attacker}</span>
            )}
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">{item.age}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

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
        <button type="button" onClick={onClose} className="border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
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
              <PanelRow label="Observed loss" value={formatUsd(detail.row.lossUsd)} />
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
                {["Bot detects a large pending swap", "Adds concentrated liquidity around the execution range", "Captures fees while the temporary liquidity is active", "Removes liquidity after execution"].map((step, i) => (
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
            </div>

            {detail.row.curveProgress != null && (
              <div className="border border-border/60 p-4">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-3">Curve Progress</div>
                <div className="flex justify-between font-mono text-xs text-muted-foreground mb-2">
                  <span>0 SOL</span>
                  <span className="text-foreground font-semibold">{detail.row.curveProgress}%</span>
                  <span>target</span>
                </div>
                <div className="h-3 border border-border/60 bg-background">
                  <div className="h-full bg-primary/70 transition-all" style={{ width: `${Math.min(100, detail.row.curveProgress)}%` }} />
                </div>
              </div>
            )}

            <div className="border border-red-500/30 bg-red-500/5 p-4 space-y-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Sniper Intelligence</div>
              <PanelRow label="First buy window" value={detail.row.firstBuyWindow ?? "--"} />
              <PanelRow label="Priority fee" value={`${detail.row.priorityFee.toLocaleString()} lamports`} />
              <PanelRow label="Extracted" value={formatUsd(detail.row.extractedUsd)} />
              <PanelRow label="Migration risk" value={detail.row.migrationRisk?.toUpperCase() ?? "--"} />
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

function AttackDetailPanel({
  attack,
  detail,
  loading,
  error,
  onClose,
}: {
  attack: Attack;
  detail: AttackDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const displayEvidence = detail?.evidence ?? attack.evidence ?? [];

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Attack detail</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">{attack.attack_type.toUpperCase()} · {attack.surface_label ?? formatPoolLabel(attack.pool_address)}</h2>
        </div>
        <button type="button" onClick={onClose} className="border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-5 p-5">
        <div className="border border-border/60 p-4 space-y-3">
          <PanelRow label="Attacker wallet" value={attack.attacker_wallet} link={solscanAccount(attack.attacker_wallet)} />
          {attack.victim_wallet && <PanelRow label="Victim wallet" value={attack.victim_wallet} link={solscanAccount(attack.victim_wallet)} />}
          <PanelRow label="Validator" value={attack.validator} link={solscanAccount(attack.validator)} />
          <PanelRow label="Confidence" value={`${Math.round((attack.confidence ?? 0) * 100)}%`} />
          <PanelRow label="Model" value={attack.detector ?? "unknown"} />
          <PanelRow label="Surface" value={attack.surface_label ?? formatPoolLabel(attack.pool_address)} />
          <PanelRow label="Surface precision" value={attack.surface_precision ?? "inferred"} />
          <PanelRow label="Execution lane" value={attack.execution_lane ?? "standard"} />
          <PanelRow label="Detection basis" value={attack.detection_basis ?? "heuristic"} />
          <PanelRow label="Block time" value={new Date(attack.block_time).toLocaleString()} />
          {attack.profit_usd != null && <PanelRow label="Searcher profit" value={formatUsd(attack.profit_usd)} />}
          {attack.victim_loss_usd != null && <PanelRow label="Victim harm" value={formatUsd(attack.victim_loss_usd)} />}
        </div>

        <div className="border border-border/60 p-4 space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Transaction links</div>
          <div className="space-y-2 text-[10px]">
            {attack.frontrun_tx && <ExternalLink href={solscanTx(attack.frontrun_tx)}>Frontrun tx</ExternalLink>}
            {attack.victim_tx && <ExternalLink href={solscanTx(attack.victim_tx)}>Victim tx</ExternalLink>}
            {attack.backrun_tx && <ExternalLink href={solscanTx(attack.backrun_tx)}>Backrun tx</ExternalLink>}
          </div>
        </div>

        <div className="border border-border/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Evidence trail</span>
            {loading && <span className="font-mono text-[9px] text-primary">Loading…</span>}
          </div>
          {error ? (
            <div className="text-sm text-red-300">{error}</div>
          ) : displayEvidence.length > 0 ? (
            <div className="space-y-2 text-[10px] text-foreground">
              {displayEvidence.map((item) => (
                <div key={item} className="border border-border/70 px-2 py-2">
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No evidence details are available for this detection.</div>
          )}
        </div>
      </div>
    </div>
  );
}
