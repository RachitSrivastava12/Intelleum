import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Check, Copy as CopyIcon, ExternalLink as ExternalLinkIcon, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  API_BASE,
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
  getDemoOrcaAttacks,
  getDemoOrcaLpProtection,
  getDemoOrcaPools,
  getDemoOrcaRoutes,
} from "@/lib/demoData";
import {
  ORCA_API_ENDPOINTS,
  ORCA_CONFIGS,
  ORCA_PROGRAMS,
  ORCA_RESEARCH_NOTES,
  fmtBps,
  fmtLamports,
  fmtUsd,
  isOrcaText,
  orcaProgramId,
  orcaProgramLabel,
} from "@/lib/orca";
import { formatPoolLabel, formatRelativeTime, truncateAddress } from "@/lib/utils";

export type OrcaSection =
  | "overview"
  | "whirlpools"
  | "jit"
  | "adaptive"
  | "lp"
  | "detections"
  | "savings"
  | "extraction";

type MarketReference = {
  tvlUsd: number | null;
  volume24hUsd: number | null;
  fees24hUsd: number | null;
  revenue24hUsd: number | null;
  updatedAt: string;
  source: "orca" | "unavailable";
};

type OrcaData = {
  status: SystemStatus | null;
  routes: RouteRisk[];
  attacks: Attack[];
  pools: PoolToxicity[];
  lp: LpProtectionSnapshot[];
  terminal: ToxicFlowTerminal | null;
  guard: PreventionGuard | null;
  market: MarketReference;
  source: "chain" | "demo";
};

const EMPTY_MARKET: MarketReference = {
  tvlUsd: null,
  volume24hUsd: null,
  fees24hUsd: null,
  revenue24hUsd: null,
  updatedAt: new Date(0).toISOString(),
  source: "unavailable",
};

const ENABLE_LOCAL_ORCA_DEMO = import.meta.env.VITE_ENABLE_ORCA_DEMO === "true";
const ORCA_FEED_CAP = 300;

const TOOLTIP_STYLE = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 0,
  fontFamily: "JetBrains Mono",
  fontSize: 11,
};
const TICK_STYLE = { fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" };

function isOrcaRoute(route: RouteRisk) {
  return isOrcaText(route.protocol) || isOrcaText(route.route_key) || isOrcaText(route.label);
}

function isOrcaAttack(attack: Attack) {
  return isOrcaText(attack.protocol) || isOrcaText(attack.pool_address) || isOrcaText(attack.surface_label);
}

function isOrcaPool(pool: PoolToxicity | LpProtectionSnapshot) {
  return isOrcaText(pool.protocol) || isOrcaText(pool.pool_address);
}

function actionTone(action: string) {
  if (action === "avoid" || action === "block" || action === "high") return "border-red-500/45 bg-red-500/10 text-red-300";
  if (action === "reroute" || action === "penalize" || action === "cap" || action === "medium") return "border-yellow-500/45 bg-yellow-500/10 text-yellow-200";
  if (action === "allow" || action === "low") return "border-green-500/40 bg-green-500/10 text-green-300";
  return "border-primary/35 bg-primary/10 text-primary";
}

function actionLabel(action: string) {
  if (action === "avoid" || action === "block") return "Block";
  if (action === "penalize") return "Cap size";
  if (action === "reroute") return "Reroute";
  return action.split("_").join(" ");
}

function pairFromSurface(surface: string) {
  const pair = surface.split(":").pop();
  if (!pair?.includes("->")) return "Whirlpool";
  return pair
    .split("->")
    .map((mint) => {
      if (mint.startsWith("So111")) return "SOL";
      if (mint.startsWith("EPjF")) return "USDC";
      if (mint.startsWith("Es9v")) return "USDT";
      if (mint.startsWith("mSoL")) return "mSOL";
      if (mint.startsWith("J1to")) return "JITO";
      if (mint.startsWith("orca")) return "ORCA";
      return truncateAddress(mint, 4, 4);
    })
    .join(" / ");
}

function formatAxisCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  if (abs > 0) return `$${value.toFixed(abs >= 100 ? 0 : 1)}`;
  return "$0";
}

function solscanAccount(address: string) {
  return `https://solscan.io/account/${address}`;
}

function solscanTx(sig: string) {
  return `https://solscan.io/tx/${sig}`;
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

function explorerAccountLink(value?: string | null) {
  if (!value || value.length < 32 || value.length > 44 || !BASE58_RE.test(value)) return undefined;
  return solscanAccount(value);
}

function explorerTxLink(value?: string | null) {
  if (!value || value.length < 64 || value.length > 90 || !BASE58_RE.test(value)) return undefined;
  return solscanTx(value);
}

function displayKey(value: string, head = 10, tail = 6) {
  return value.length > head + tail + 3 ? truncateAddress(value, head, tail) : value;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-8 items-center gap-1 px-1 font-mono text-[10px] text-primary underline decoration-primary/40 transition-all hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      <ExternalLinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1300);
        });
      }}
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied" : "Copy value"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-border/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function buildDemoStatus(base?: SystemStatus | null): SystemStatus {
  const attacks = getDemoOrcaAttacks();
  const routes = getDemoOrcaRoutes();
  const previous = base ?? demoSystemStatus;

  return {
    ...previous,
    mode: "fallback",
    started: true,
    syncing: false,
    attacksDetected: attacks.length,
    lastError: "Local Orca demo scenario. Chain feed is offline.",
    recentMetrics: {
      ...previous.recentMetrics,
      candidateRows: routes.reduce((sum, route) => sum + route.total_attacks, 0),
      detectedAttacks: attacks.length,
      parsedTransactions: Math.max(previous.recentMetrics.parsedTransactions, 132),
      parsedSwaps: Math.max(previous.recentMetrics.parsedSwaps, 74),
      rawSlotTxs: Math.max(previous.recentMetrics.rawSlotTxs, 360),
      sandwichCandidates: attacks.filter((attack) => attack.attack_type === "sandwich").length,
      arbitrageCandidates: attacks.filter((attack) => attack.attack_type === "arbitrage").length,
      jitCandidates: attacks.filter((attack) => attack.attack_type === "jit").length,
      backrunCandidates: attacks.filter((attack) => attack.attack_type === "backrun").length,
      suspiciousCandidates: attacks.length,
    },
    recentAttackPreview: attacks.slice(0, 8).map((attack) => ({
      attack_type: attack.attack_type,
      detector: attack.detector ?? "orca_local_demo",
      confidence: attack.confidence,
      slot: attack.slot,
    })),
  };
}

function buildDemoData(previous?: OrcaData | null, status?: SystemStatus | null): OrcaData {
  return {
    status: buildDemoStatus(status),
    routes: getDemoOrcaRoutes(),
    attacks: getDemoOrcaAttacks(),
    pools: getDemoOrcaPools(),
    lp: getDemoOrcaLpProtection(),
    terminal: previous?.terminal ?? null,
    guard: previous?.guard ?? null,
    market: previous?.market ?? EMPTY_MARKET,
    source: "demo",
  };
}

function shouldUseDemo(
  status: SystemStatus,
  routes: RouteRisk[],
  attacks: Attack[],
  pools: PoolToxicity[],
  lp: LpProtectionSnapshot[],
) {
  if (!ENABLE_LOCAL_ORCA_DEMO) return false;
  if (status.mode !== "chain") return true;
  return !(routes.some(isOrcaRoute) || attacks.some(isOrcaAttack) || pools.some(isOrcaPool) || lp.some(isOrcaPool));
}

let marketCache: { data: MarketReference; expires: number } | null = null;

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

function numberFromString(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadMarketReference(): Promise<MarketReference> {
  const nowMs = Date.now();
  if (marketCache && nowMs < marketCache.expires) return marketCache.data;

  try {
    const protocol = await fetchJsonWithTimeout(ORCA_API_ENDPOINTS.PROTOCOL);
    const row = protocol?.data ?? {};
    const data: MarketReference = {
      tvlUsd: numberFromString(row.tvl),
      volume24hUsd: numberFromString(row.volume24hUsdc),
      fees24hUsd: numberFromString(row.fees24hUsdc),
      revenue24hUsd: numberFromString(row.revenue24hUsdc),
      updatedAt: new Date().toISOString().slice(0, 10),
      source: "orca",
    };
    marketCache = { data, expires: nowMs + 10 * 60_000 };
    return data;
  } catch {
    if (marketCache) return marketCache.data;
    return EMPTY_MARKET;
  }
}

function buildGuardTarget(routes: RouteRisk[]) {
  return [...routes].filter(isOrcaRoute).sort((a, b) => b.risk_score - a.risk_score)[0] ?? null;
}

function isLiveData(data: OrcaData | null) {
  return data?.source === "chain" && data.status?.mode === "chain";
}

function isDemoData(data: OrcaData | null) {
  return data?.source === "demo";
}

function hasOrcaData(data: OrcaData | null) {
  return data?.source === "chain" || data?.source === "demo";
}

function sourceLabel(data: OrcaData | null) {
  if (isLiveData(data)) return "Chain";
  if (isDemoData(data)) return "Local demo";
  return "--";
}

function sourceDetail(data: OrcaData | null) {
  if (isLiveData(data)) return "QuickNode live";
  if (isDemoData(data)) return "local Orca demo";
  return "waiting for chain";
}

function sourceRowsText(data: OrcaData | null) {
  return isDemoData(data) ? "from local demo rows" : "from current API rows";
}

function liveOrcaRoutes(data: OrcaData | null) {
  return hasOrcaData(data) ? data!.routes.filter(isOrcaRoute) : [];
}

function liveOrcaAttacks(data: OrcaData | null) {
  return hasOrcaData(data) ? dedupeAttacks(data!.attacks.filter(isOrcaAttack)) : [];
}

function liveOrcaLp(data: OrcaData | null) {
  return hasOrcaData(data) ? data!.lp.filter(isOrcaPool) : [];
}

function liveOrcaPools(data: OrcaData | null) {
  return hasOrcaData(data) ? data!.pools.filter(isOrcaPool) : [];
}

function surfaceName(route: RouteRisk) {
  const pair = pairFromSurface(route.route_key);
  if (pair !== "Whirlpool") return pair;
  return route.label?.split("•").pop()?.trim() || route.label || pair;
}

function programIdForProtocol(protocol?: string | null) {
  return orcaProgramId(protocol) ?? ORCA_PROGRAMS.WHIRLPOOL;
}

function typeTextClass(type: string) {
  if (type === "sandwich") return "text-red-300";
  if (type === "jit") return "text-primary";
  if (type === "backrun") return "text-orange-300";
  if (type === "arbitrage") return "text-blue-300";
  if (type === "liquidation") return "text-purple-300";
  return "text-muted-foreground";
}

function detectionKey(attack: Attack) {
  if (attack.attack_type === "sandwich" || attack.attack_type === "jit") {
    return [
      attack.attack_type,
      attack.attacker_wallet,
      attack.pool_address,
      attack.frontrun_tx ?? "",
      attack.backrun_tx ?? "",
    ].join(":");
  }
  return [
    attack.attack_type,
    attack.attacker_wallet,
    attack.pool_address,
    attack.backrun_tx ?? attack.victim_tx ?? `${attack.slot}`,
  ].join(":");
}

function dedupeAttacks(attacks: Attack[]) {
  return attacks.reduce<Attack[]>((acc, attack) => {
    const key = detectionKey(attack);
    const existingIndex = acc.findIndex((item) => detectionKey(item) === key);
    if (existingIndex === -1) return [...acc, attack];

    const existing = acc[existingIndex];
    const existingScore = (existing.confidence ?? 0) * 1000 + (existing.victim_loss_usd ?? 0) * 2 + (existing.profit_usd ?? 0);
    const nextScore = (attack.confidence ?? 0) * 1000 + (attack.victim_loss_usd ?? 0) * 2 + (attack.profit_usd ?? 0);
    if (nextScore > existingScore) {
      const next = [...acc];
      next[existingIndex] = attack;
      return next;
    }
    return acc;
  }, []);
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.95) return "HIGH";
  if (confidence >= 0.85) return "STRONG";
  if (confidence >= 0.75) return "MED";
  return "LOW";
}

function hasBundleSignal(attack: Attack) {
  return attack.execution_lane === "jito-aligned" || (attack.bundle_likelihood ?? 0) >= 0.75;
}

function profitLabel(attack: Attack) {
  if (attack.attack_type === "jit") return "LP Capture";
  if (attack.attack_type === "liquidation") return "Liquidator Gain";
  return "Searcher PnL";
}

function harmLabel(attack: Attack) {
  if (attack.attack_type === "jit") return "User Impact";
  if (attack.attack_type === "liquidation") return "Borrower Loss";
  return "User Harm";
}

function detectionSummary(attack: Attack) {
  if (attack.attack_type === "jit") return "Short-lived Whirlpool liquidity entered around a target swap, captured fee flow, then exited after the window cleared.";
  if (attack.attack_type === "sandwich") return "Victim execution was bracketed by hostile Orca route activity.";
  if (attack.attack_type === "backrun") return "Post-swap repricing was harvested on an Orca surface after victim flow moved the route.";
  if (attack.attack_type === "arbitrage") return "Stale quote or tick-array state created an Orca arbitrage window.";
  if (attack.attack_type === "liquidation") return "Liquidation-like flow crossed Orca liquidity and created adverse-selection risk.";
  return "Orca route activity matched an extraction pattern in the live feed.";
}

function orcaMechanic(attack: Attack) {
  if (attack.attack_type === "jit") return "Whirlpool positions earn fees only while their tick range is active, so short-lived liquidity can capture flow without carrying normal LP inventory risk.";
  if (attack.attack_type === "arbitrage" || attack.attack_type === "backrun") return "Whirlpool swaps traverse tick arrays and can be sensitive to stale state reads, adaptive fee movement, and active tick transitions.";
  if (attack.attack_type === "sandwich") return "Legacy Orca and Whirlpool routes can expose users to price movement around their swap when public orderflow is large or stale.";
  return "Orca protection reads program, route, tick, and fee state before deciding whether to cap, reroute, or block.";
}

const SECTION_META: Record<OrcaSection, { eyebrow: string; title: string }> = {
  overview:   { eyebrow: "Orca Intelligence", title: "Whirlpool protection surface" },
  whirlpools: { eyebrow: "Whirlpools",         title: "Tick-Range Risk Surfaces" },
  jit:        { eyebrow: "JIT Liquidity",      title: "Add / Swap / Remove Windows" },
  adaptive:   { eyebrow: "Adaptive Fees",      title: "State Reads That Save Money" },
  lp:         { eyebrow: "LP Protection",      title: "Whirlpool LP Drag Scores" },
  detections: { eyebrow: "Live Feed",          title: "Orca MEV Detections" },
  savings:    { eyebrow: "Savings",            title: "Estimated Savings" },
  extraction: { eyebrow: "Observed Trend",     title: "Extraction Timeline" },
};

function SectionShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  action?: React.ReactNode;
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

function EmptyInline({ message }: { message: string }) {
  return <div className="px-4 py-6 text-sm text-muted-foreground">{message}</div>;
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-border/60 bg-background/50 p-6 text-sm text-muted-foreground">
      {message}
    </div>
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-mono text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate font-mono text-xs font-bold ${tone ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="border border-border/60 bg-background/35 px-2 py-1 font-mono text-muted-foreground">
      {label} · <span className="text-foreground">{value}</span>
    </span>
  );
}

function DetailLine({ label, value, href, copy }: { label: string; value: string; href?: string; copy?: string }) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {href ? <ExternalLink href={href}>{value}</ExternalLink> : <span className="break-all font-mono text-[11px] text-foreground">{value}</span>}
        {copy && <CopyButton text={copy} />}
      </div>
    </div>
  );
}

function OrcaLogo({ size = 36 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center border border-primary/40 bg-primary/10 font-mono text-xs font-bold text-primary">
        O
      </div>
    );
  }
  return (
    <img
      src="https://www.google.com/s2/favicons?domain=orca.so&sz=64"
      alt="Orca"
      width={size}
      height={size}
      className="object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function PageShell({
  section,
  data,
  refreshing,
  onRefresh,
  children,
}: {
  section: OrcaSection;
  data: OrcaData | null;
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  const { eyebrow, title } = SECTION_META[section];
  const mode = isLiveData(data) ? "chain" : isDemoData(data) ? "demo" : "fallback";

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-6">
      <div className="pointer-events-none fixed inset-0 grid-overlay-subtle opacity-10" />
      <div className="relative mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
            <Link to="/" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Home</Link>
            <Link to="/dex-intelligence" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">DEX Intelligence</Link>
            <Link to="/dex-intelligence/raydium" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Raydium</Link>
            <Link to="/dex-intelligence/orca" className="border border-primary/40 bg-primary/5 px-3 py-2 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{title}</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${mode === "chain" ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"}`}>
              {mode === "chain" ? "Live chain" : mode === "demo" ? "Local demo" : "Waiting for chain"}
            </span>
            <button type="button" onClick={onRefresh} disabled={refreshing}
              className="inline-flex min-h-10 items-center gap-2 border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <div className="flex items-center gap-4">
          <OrcaLogo size={36} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
            <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}

function useOrcaData() {
  const [data, setData] = useState<OrcaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergeAttacks = useCallback((existing: Attack[], incoming: Attack[]) => {
    if (incoming.length === 0) return existing;
    const byId = new Map<number, Attack>();
    for (const attack of incoming) byId.set(attack.id, attack);
    for (const attack of existing) if (!byId.has(attack.id)) byId.set(attack.id, attack);
    return [...byId.values()]
      .sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime())
      .slice(0, ORCA_FEED_CAP);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const status = await api.systemStatus();
      const [routes, attacks, pools, lp] = await Promise.all([
        api.routeRisks(30),
        api.attacks({ protocol: "orca", limit: "100" }),
        api.pools(30),
        api.lpProtection(30),
      ]);

      api.toxicFlowTerminal(8, "1m")
        .then((terminal) => setData((prev) => prev ? { ...prev, terminal } : prev))
        .catch(() => {});

      setData((prev) => {
        if (shouldUseDemo(status, routes, attacks, pools, lp) && !prev) return buildDemoData(prev, status);
        if (prev?.source === "demo" && attacks.length === 0) return prev;
        const mergedAttacks = prev?.source === "chain" ? mergeAttacks(prev.attacks, attacks) : attacks;
        return {
          status,
          routes,
          attacks: mergedAttacks,
          pools,
          lp,
          terminal: prev?.terminal ?? null,
          guard: prev?.guard ?? null,
          market: prev?.market ?? EMPTY_MARKET,
          source: "chain",
        };
      });
    } catch (err) {
      if (ENABLE_LOCAL_ORCA_DEMO) {
        setData((prev) => prev ?? buildDemoData(prev));
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load Orca intelligence");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mergeAttacks]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/attacks/stream`);
    es.onmessage = (event) => {
      try {
        const attack = JSON.parse(event.data) as Attack;
        if (!isOrcaAttack(attack)) return;
        if (attack.detector === "suspicious_orderflow_candidate") return;
        setData((prev) => {
          if (!prev || prev.source !== "chain") return prev;
          if (prev.attacks.some((item) => item.id === attack.id)) return prev;
          return { ...prev, attacks: mergeAttacks(prev.attacks, [attack]) };
        });
      } catch {
        // EventSource reconnects; ignore malformed messages.
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [mergeAttacks]);

  useEffect(() => {
    loadMarketReference()
      .then((market) => setData((prev) => prev ? { ...prev, market } : prev))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const routes = data?.routes.filter(isOrcaRoute) ?? [];
    if (routes.length === 0 || data?.guard) return;
    const target = buildGuardTarget(routes);
    if (!target) return;
    api.protectedSendPlan({
      route_key: target.route_key,
      route_label: target.label,
      protocol: target.protocol,
      notional_usd: Math.max(25_000, target.recommended_max_notional_usd * 2),
      slippage_bps: 45,
      objective: "protect_lp",
      candidates: routes.slice(0, 6).map((route) => ({
        route_key: route.route_key,
        label: route.label,
        protocol: route.protocol,
      })),
    })
      .then((guard) => setData((prev) => prev ? { ...prev, guard } : prev))
      .catch(() => {});
  }, [data?.guard, data?.routes]);

  return { data, loading, refreshing, error, reload: () => void load(true) };
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="h-12 border border-border bg-card/60" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
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
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center">
        <div className="w-full border border-red-500/40 bg-red-500/10 p-6">
          <AlertTriangle className="h-5 w-5 text-red-300" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-semibold">Orca feed unavailable.</h1>
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

function DetectionFeed({ attacks, onAttackClick }: { attacks: Attack[]; onAttackClick: (attack: Attack) => void }) {
  const items = attacks.slice(0, 7);
  if (items.length === 0) return <EmptyInline message="No Orca detections in the current feed window." />;

  return (
    <div className="divide-y divide-border/40">
      {items.map((attack) => (
        <button
          key={attack.id}
          type="button"
          onClick={() => onAttackClick(attack)}
          className="grid w-full gap-3 px-4 py-3 text-left text-xs transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary md:grid-cols-[110px_1fr_90px_100px_90px] md:items-center"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">{attack.attack_type.replace("_", " ")}</div>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{attack.surface_label ?? formatPoolLabel(attack.pool_address)}</div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{attack.evidence?.[0] ?? attack.detector ?? "orca detector"}</div>
          </div>
          <div className="font-mono text-red-300">{fmtUsd(attack.profit_usd ?? attack.victim_loss_usd)}</div>
          <div className="font-mono text-muted-foreground">{truncateAddress(attack.attacker_wallet, 5, 4)}</div>
          <div className="font-mono text-[10px] text-muted-foreground/70">{formatRelativeTime(attack.block_time)}</div>
        </button>
      ))}
    </div>
  );
}

function LiveTicker({ attacks, onAttackClick }: { attacks: Attack[]; onAttackClick: (attack: Attack) => void }) {
  const items = attacks.slice(0, 6);

  if (items.length === 0) {
    return (
      <div className="border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        No Orca detections available in the current feed window. Live Orca detections append here as soon as the chain stream classifies them.
      </div>
    );
  }

  return (
    <div className="border border-border/60 bg-card/40">
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2">
        <span className="flex h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live Orca Detections</span>
        <Link to="/dex-intelligence/orca/detections" className="ml-auto font-mono text-[10px] text-primary hover:underline">View all</Link>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((attack) => (
          <button
            key={`${attack.id}-${attack.frontrun_tx ?? attack.pool_address}`}
            type="button"
            onClick={() => onAttackClick(attack)}
            className="grid w-full gap-3 px-4 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary md:grid-cols-[90px_1fr_92px_90px_82px] md:items-center"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-primary">{attack.attack_type.replace("_", " ")}</span>
            <span className="min-w-0 truncate font-mono text-[10px] text-foreground">{attack.surface_label ?? formatPoolLabel(attack.pool_address)}</span>
            <span className="shrink-0 font-mono text-[10px] text-red-300">{fmtUsd(attack.profit_usd ?? attack.victim_loss_usd)}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{truncateAddress(attack.attacker_wallet, 5, 4)}</span>
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">{formatRelativeTime(attack.block_time)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function renderWhirlpoolsSection(routes: RouteRisk[], pools: PoolToxicity[], onRouteClick: (route: RouteRisk) => void) {
  const rows = routes.filter(isOrcaRoute);
  const poolMap = new Map(pools.filter(isOrcaPool).map((pool) => [pool.pool_address, pool]));

  return (
    <SectionShell eyebrow="Whirlpools" title="Tick-Range Risk By Surface">
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-border/50">
              <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Surface / Pair</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">JIT</th>
                <th className="px-4 py-3 font-medium">Stale Quote</th>
                <th className="px-4 py-3 font-medium">Markout</th>
                <th className="px-4 py-3 font-medium">LP Drag</th>
                <th className="px-4 py-3 font-medium">Policy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((route) => {
                const pool = poolMap.get(route.route_key);
                const programId = orcaProgramId(route.protocol) ?? ORCA_PROGRAMS.WHIRLPOOL;
                return (
                  <tr
                    key={route.route_key}
                    className="border-b border-border/30 transition-colors last:border-0 hover:bg-primary/5"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => onRouteClick(route)}
                          className="min-h-10 min-w-0 flex-1 text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="font-mono text-xs font-semibold text-foreground">{pairFromSurface(route.route_key)}</div>
                          <div className="mt-0.5 max-w-[240px] truncate font-mono text-[9px] text-muted-foreground">{route.label}</div>
                          <div className="mt-1 max-w-[240px] truncate font-mono text-[9px] text-muted-foreground/70">{displayKey(route.route_key, 8, 6)}</div>
                        </button>
                        <CopyButton text={route.route_key} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[10px] text-primary">{orcaProgramLabel(route.protocol)}</div>
                      <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                        <span>{truncateAddress(programId, 5, 4)}</span>
                        <CopyButton text={programId} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{route.jit_count}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{route.stale_quote_pickup_rate.toFixed(0)}%</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{fmtBps(route.markout_30s_bps)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{fmtUsd(pool?.lp_drag_estimate_usd ?? route.lp_annual_loss_usd_estimate)}</td>
                    <td className="px-4 py-3"><span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(route.policy_action)}`}>{actionLabel(route.policy_action)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyInline message="No Orca Whirlpool surfaces are available from the live API yet." />
      )}
    </SectionShell>
  );
}

function renderJitSection(routes: RouteRisk[], attacks: Attack[], onAttackClick: (attack: Attack) => void) {
  const rows = routes.filter(isOrcaRoute).filter((route) => route.jit_count > 0);
  const jitAttacks = attacks.filter(isOrcaAttack).filter((attack) => attack.attack_type === "jit");

  return (
    <SectionShell eyebrow="JIT Liquidity" title="Add / Swap / Remove Windows">
      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="h-56">
          {rows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={120} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [v, "JIT windows"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="jit_count" fill="hsl(var(--primary))" fillOpacity={0.85} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyInline message="No Orca JIT rows are available from the current window." />}
        </div>
        <div className="divide-y divide-border/40 border border-border/50">
          {jitAttacks.length > 0 ? jitAttacks.slice(0, 4).map((attack) => (
            <button
              key={attack.id}
              type="button"
              onClick={() => onAttackClick(attack)}
              className="block w-full px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-xs font-medium text-foreground">{attack.surface_label ?? formatPoolLabel(attack.pool_address)}</div>
                <span className="font-mono text-[10px] text-primary">{Math.round(attack.confidence * 100)}%</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">{attack.evidence?.[1] ?? "active tick range fee capture"}</div>
              <div className="mt-2 flex gap-3 font-mono text-[10px] text-muted-foreground">
                <span>{fmtUsd(attack.profit_usd)} profit</span>
                <span>{fmtLamports(attack.tip_lamports)}</span>
              </div>
            </button>
          )) : <EmptyInline message="No JIT attack cards are present yet." />}
        </div>
      </div>
    </SectionShell>
  );
}

function renderAdaptiveSection(routes: RouteRisk[], onRouteClick: (route: RouteRisk) => void) {
  const rows = routes.filter(isOrcaRoute).sort((a, b) => b.stale_quote_pickup_rate - a.stale_quote_pickup_rate).slice(0, 5);

  return (
    <SectionShell eyebrow="Adaptive Fee / Tick Arrays" title="State Reads That Save Money">
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-3">
          {ORCA_RESEARCH_NOTES.map((note) => (
            <a key={note.id} href={note.href} target="_blank" rel="noopener noreferrer" className="block border border-border/60 bg-background/35 p-3 transition-colors hover:border-primary/40">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">{note.source}</div>
              <div className="mt-1 text-sm font-medium text-foreground">{note.title}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{note.guardrail}</div>
            </a>
          ))}
        </div>
        <div className="divide-y divide-border/40 border border-border/50">
          {rows.map((route) => (
            <button
              key={route.route_key}
              type="button"
              onClick={() => onRouteClick(route)}
              className="block w-full px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-xs font-medium text-foreground">{route.label}</div>
                <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(route.policy_action)}`}>{actionLabel(route.policy_action)}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <MiniMetric label="Stale quote" value={`${route.stale_quote_pickup_rate.toFixed(0)}%`} />
                <MiniMetric label="Freshness" value={`${route.quote_freshness_ms.toFixed(0)}ms`} />
                <MiniMetric label="Bps saved" value={fmtBps(route.estimated_savings_bps)} />
              </div>
            </button>
          ))}
          {rows.length === 0 && <EmptyInline message="No adaptive-fee or tick-array risk rows yet." />}
        </div>
      </div>
    </SectionShell>
  );
}

function renderLpSection(lpRows: LpProtectionSnapshot[], onLpClick: (row: LpProtectionSnapshot) => void) {
  const rows = lpRows.filter(isOrcaPool).sort((a, b) => b.lp_drag_estimate_usd - a.lp_drag_estimate_usd);

  return (
    <SectionShell eyebrow="LP Protection" title="Whirlpool LP Drag And Fee Dilution">
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.length > 0 ? rows.map((row) => (
          <button
            key={row.pool_address}
            type="button"
            onClick={() => onLpClick(row)}
            className={`border p-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${row.toxicity_score >= 80 ? "border-red-500/35 bg-red-500/5" : row.toxicity_score >= 60 ? "border-yellow-500/35 bg-yellow-500/5" : "border-border bg-background/25"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{formatPoolLabel(row.pool_address)}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.primary_cause}</div>
              </div>
              <div className="font-mono text-xl font-bold text-foreground">{row.toxicity_score.toFixed(0)}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric label="LP drag" value={fmtUsd(row.lp_drag_estimate_usd)} />
              <MiniMetric label="Saved" value={fmtBps(row.saved_fee_bps_if_segmented)} />
              <MiniMetric label="LVR" value={row.lvr_proxy_score.toFixed(0)} />
              <MiniMetric label="Toxic/benign" value={`${row.toxic_to_benign_volume_ratio.toFixed(2)}x`} />
            </div>
          </button>
        )) : <EmptyInline message="No Orca LP protection rows are present yet." />}
      </div>
    </SectionShell>
  );
}

function PanelRow({
  label,
  value,
  link,
  copyValue,
}: {
  label: string;
  value: string;
  link?: string;
  copyValue?: string | null;
}) {
  const canCopy = !!copyValue && copyValue !== "--";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-b-0">
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        {link ? (
          <ExternalLink href={link}>{value}</ExternalLink>
        ) : (
          <span className="break-all font-mono text-[10px] text-foreground">{value}</span>
        )}
        {canCopy && <CopyButton text={copyValue!} />}
      </span>
    </div>
  );
}

function DrawerShell({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close detail panel"
        className="fixed inset-0 z-40 cursor-default bg-background/60 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h2 className="mt-0.5 truncate text-base font-semibold text-foreground">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Close
          </button>
        </div>
        <div className="flex-1 space-y-5 p-5">{children}</div>
      </aside>
    </>
  );
}

function AttackDrawer({
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
  const surfaceLabel = attack.surface_label ?? formatPoolLabel(attack.pool_address);
  return (
    <DrawerShell
      eyebrow="Orca detection"
      title={`${attack.attack_type.replace("_", " ").toUpperCase()} - ${surfaceLabel}`}
      onClose={onClose}
    >
      <div className="space-y-0 border border-border/60 p-4">
        <PanelRow label="Surface key" value={displayKey(attack.pool_address)} link={explorerAccountLink(attack.pool_address)} copyValue={attack.pool_address} />
        <PanelRow label="Protocol" value={attack.protocol ?? "orca"} />
        <PanelRow label="Attacker" value={displayKey(attack.attacker_wallet)} link={explorerAccountLink(attack.attacker_wallet)} copyValue={explorerAccountLink(attack.attacker_wallet) ? attack.attacker_wallet : null} />
        {attack.victim_wallet && <PanelRow label="Victim" value={displayKey(attack.victim_wallet)} link={explorerAccountLink(attack.victim_wallet)} copyValue={explorerAccountLink(attack.victim_wallet) ? attack.victim_wallet : null} />}
        <PanelRow label="Validator" value={displayKey(attack.validator)} link={explorerAccountLink(attack.validator)} copyValue={explorerAccountLink(attack.validator) ? attack.validator : null} />
        <PanelRow label="Confidence" value={`${Math.round((attack.confidence ?? 0) * 100)}%`} />
        <PanelRow label="Model" value={attack.detector ?? "unknown"} />
        <PanelRow label="Lane" value={attack.execution_lane ?? "standard"} />
        <PanelRow label="Bundle" value={attack.bundle_likelihood == null ? "--" : `${Math.round(attack.bundle_likelihood * 100)}%`} />
        <PanelRow label="Block time" value={new Date(attack.block_time).toLocaleString()} />
        {attack.profit_usd != null && <PanelRow label="Profit" value={fmtUsd(attack.profit_usd)} />}
        {attack.victim_loss_usd != null && <PanelRow label="Victim harm" value={fmtUsd(attack.victim_loss_usd)} />}
      </div>

      <div className="space-y-3 border border-border/60 p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Transaction links</div>
        <div className="flex flex-col gap-2">
          {attack.frontrun_tx && <PanelRow label="Frontrun tx" value={displayKey(attack.frontrun_tx, 8, 6)} link={explorerTxLink(attack.frontrun_tx)} copyValue={attack.frontrun_tx} />}
          {attack.victim_tx && <PanelRow label="Victim tx" value={displayKey(attack.victim_tx, 8, 6)} link={explorerTxLink(attack.victim_tx)} copyValue={attack.victim_tx} />}
          {attack.backrun_tx && <PanelRow label="Backrun tx" value={displayKey(attack.backrun_tx, 8, 6)} link={explorerTxLink(attack.backrun_tx)} copyValue={attack.backrun_tx} />}
          {!attack.frontrun_tx && !attack.victim_tx && !attack.backrun_tx && (
            <div className="text-sm text-muted-foreground">No transaction signatures are attached to this detection yet.</div>
          )}
        </div>
      </div>

      <div className="space-y-3 border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Evidence trail</span>
          {loading && <span className="font-mono text-[9px] text-primary">Loading</span>}
        </div>
        {error ? (
          <div className="text-sm text-red-300">{error}</div>
        ) : displayEvidence.length > 0 ? (
          <div className="space-y-2 text-[10px] text-foreground">
            {displayEvidence.map((item) => (
              <div key={item} className="border border-border/70 px-2 py-2">{item}</div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No evidence details are available for this detection.</div>
        )}
      </div>
    </DrawerShell>
  );
}

function RouteDrawer({ route, onClose }: { route: RouteRisk; onClose: () => void }) {
  const programId = orcaProgramId(route.protocol) ?? ORCA_PROGRAMS.WHIRLPOOL;
  const isWhirlpoolProgram = programId === ORCA_PROGRAMS.WHIRLPOOL;
  return (
    <DrawerShell eyebrow="Orca surface" title={route.label} onClose={onClose}>
      <div className="space-y-0 border border-border/60 p-4">
        <PanelRow label="Surface key" value={displayKey(route.route_key)} link={explorerAccountLink(route.route_key)} copyValue={route.route_key} />
        <PanelRow label="Protocol" value={route.protocol ?? "orca"} />
        <PanelRow label="Program" value={orcaProgramLabel(route.protocol)} />
        <PanelRow label="Program ID" value={truncateAddress(programId, 10, 6)} link={solscanAccount(programId)} copyValue={programId} />
        {isWhirlpoolProgram && (
          <>
            <PanelRow
              label="Whirlpool config"
              value={truncateAddress(ORCA_CONFIGS.MAINNET_WHIRLPOOLS_CONFIG, 10, 6)}
              link={solscanAccount(ORCA_CONFIGS.MAINNET_WHIRLPOOLS_CONFIG)}
              copyValue={ORCA_CONFIGS.MAINNET_WHIRLPOOLS_CONFIG}
            />
            <PanelRow
              label="Config extension"
              value={truncateAddress(ORCA_CONFIGS.MAINNET_CONFIG_EXTENSION, 10, 6)}
              link={solscanAccount(ORCA_CONFIGS.MAINNET_CONFIG_EXTENSION)}
              copyValue={ORCA_CONFIGS.MAINNET_CONFIG_EXTENSION}
            />
          </>
        )}
        <PanelRow label="Pair" value={pairFromSurface(route.route_key)} />
        <PanelRow label="Policy" value={actionLabel(route.policy_action).toUpperCase()} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Risk" value={route.risk_score.toFixed(0)} />
        <MiniMetric label="Toxicity" value={`${route.toxicity_probability.toFixed(0)}%`} />
        <MiniMetric label="JIT windows" value={String(route.jit_count)} />
        <MiniMetric label="Stale quote" value={`${route.stale_quote_pickup_rate.toFixed(0)}%`} />
        <MiniMetric label="30s markout" value={fmtBps(route.markout_30s_bps)} />
        <MiniMetric label="Savings" value={fmtUsd(route.estimated_savings_usd)} />
      </div>

      <div className="space-y-3 border border-primary/30 bg-primary/5 p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Reason codes</div>
        <div className="flex flex-wrap gap-1.5">
          {route.reason_codes.map((code) => (
            <span key={code} className="border border-border/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              {code.split("_").join(" ")}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border border-border/60 p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Orca guardrails</div>
        {[
          "Refresh Whirlpool fee, tick-array, and adaptive-fee state before routing.",
          "Cap notional when JIT windows or stale quote pickup pressure rises.",
          "Prefer cleaner same-pair venues when policy is reroute or avoid.",
        ].map((step, index) => (
          <div key={step} className="flex gap-2 text-xs text-muted-foreground">
            <span className="shrink-0 font-mono text-primary">{String(index + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </DrawerShell>
  );
}

function LpDrawer({ row, onClose }: { row: LpProtectionSnapshot; onClose: () => void }) {
  return (
    <DrawerShell eyebrow="Orca LP protection" title={formatPoolLabel(row.pool_address)} onClose={onClose}>
      <div className={`border p-4 ${row.toxicity_score >= 80 ? "border-red-500/30 bg-red-500/5" : row.toxicity_score >= 60 ? "border-yellow-500/30 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"}`}>
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Protection score</div>
        <div className="mt-2 text-4xl font-bold text-foreground">{row.toxicity_score.toFixed(0)}<span className="text-lg font-normal text-muted-foreground">/100</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="LP drag" value={fmtUsd(row.lp_drag_estimate_usd)} />
        <MiniMetric label="Saved bps" value={fmtBps(row.saved_fee_bps_if_segmented)} />
        <MiniMetric label="LVR proxy" value={row.lvr_proxy_score.toFixed(0)} />
        <MiniMetric label="Adverse selection" value={row.adverse_selection_intensity.toFixed(0)} />
        <MiniMetric label="Stale arb" value={`${row.stale_quote_arb_frequency.toFixed(0)}%`} />
        <MiniMetric label="Quote stress" value={row.quote_freshness_stress.toFixed(0)} />
      </div>

      <div className="space-y-0 border border-border/60 p-4">
        <PanelRow label="Surface key" value={displayKey(row.pool_address)} link={explorerAccountLink(row.pool_address)} copyValue={row.pool_address} />
        <PanelRow label="Protocol" value={row.protocol ?? "orca"} />
        <PanelRow label="Primary cause" value={row.primary_cause} />
        <PanelRow label="Toxic/benign" value={`${row.toxic_to_benign_volume_ratio.toFixed(2)}x`} />
      </div>
    </DrawerShell>
  );
}

function SectionOverview({ data }: { data: OrcaData | null }) {
  const navigate = useNavigate();
  const routes = liveOrcaRoutes(data);
  const attacks = liveOrcaAttacks(data);
  const lpRows = liveOrcaLp(data);
  const extracted = Math.max(
    routes.reduce((sum, route) => sum + route.total_extracted_usd, 0),
    attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? attack.victim_loss_usd ?? 0), 0),
  );
  const savings = Math.max(
    routes.reduce((sum, route) => sum + route.estimated_savings_usd, 0),
    data?.guard?.savings_proof.estimated_loss_prevented_usd ?? 0,
  );
  const lpDrag = lpRows.reduce((sum, row) => sum + row.lp_drag_estimate_usd, 0);

  const cards = [
    { to: "/dex-intelligence/orca/whirlpools", title: "Whirlpools", value: `${routes.length}`, desc: "tick-range surfaces ranked by extraction risk" },
    { to: "/dex-intelligence/orca/detections", title: "Live Detections", value: `${attacks.length}`, desc: "append-only Orca detection feed" },
    { to: "/dex-intelligence/orca/savings", title: "Savings", value: fmtUsd(savings), desc: "route caps and tick-aware reroute value" },
    { to: "/dex-intelligence/orca/lp", title: "LP Drag", value: fmtUsd(lpDrag), desc: "JIT dilution and adverse-selection proxy" },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-red-500/40 bg-red-500/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Observed Orca extraction</div>
          <div className="mt-2 text-4xl font-bold text-red-300">{fmtUsd(extracted)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{sourceRowsText(data)}</div>
        </div>
        <div className="border border-primary/40 bg-primary/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Savings potential / 24h</div>
          <div className="mt-2 text-3xl font-bold text-primary">{fmtUsd(savings)}</div>
          <div className="mt-1 text-xs text-muted-foreground">caps + reroute decisions</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Whirlpool LP drag</div>
          <div className="mt-2 text-3xl font-bold text-foreground">{fmtUsd(lpDrag)}</div>
          <div className="mt-1 text-xs text-muted-foreground">JIT dilution + LVR proxy</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Orca TVL ref</div>
          <div className="mt-2 text-3xl font-bold text-foreground">{fmtUsd(data?.market.tvlUsd)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{fmtUsd(data?.market.volume24hUsd)} 24h volume</div>
        </div>
      </div>

      <LiveTicker attacks={attacks} onAttackClick={() => navigate("/dex-intelligence/orca/detections")} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.to} to={card.to} className="block border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">{card.title}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{card.value}</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.desc}</p>
          </Link>
        ))}
      </div>

      <SectionShell eyebrow="Policy Output" title="Protected Send Decision" action={<Link to="/protection" className="font-mono text-[10px] text-primary hover:underline">Open Guard</Link>}>
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid grid-cols-3 gap-2">
            <MiniMetric label="Loss at risk" value={fmtUsd(data?.guard?.expected_loss_at_risk_usd)} />
            <MiniMetric label="Bps at risk" value={fmtBps(data?.guard?.expected_loss_at_risk_bps ?? routes[0]?.markout_30s_bps)} />
            <MiniMetric label="Safe size" value={fmtUsd(data?.guard?.recommended_max_notional_usd)} />
          </div>
          <div className="border border-border/60 bg-background/30 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Surface</div>
            </div>
            <div className="mt-1 text-sm text-foreground">{data?.guard?.selected_label ?? routes[0]?.label ?? "No Orca route selected yet"}</div>
            <div className="mt-3 space-y-1.5">
              {(data?.guard?.protected_send_policy.implementation_steps ?? [
                "Refresh Whirlpool fee, tick-array, and adaptive-fee state before submit.",
                "Cap size or reroute if JIT and stale quote pressure are elevated.",
                "Emit Orca reason codes into execution analytics.",
              ]).slice(0, 3).map((step, index) => (
                <div key={step} className="flex gap-2 border border-border/40 bg-background/20 px-3 py-2 text-xs text-muted-foreground">
                  <span className="shrink-0 font-mono text-primary">{String(index + 1).padStart(2, "0")}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>
    </>
  );
}

function SectionWhirlpools({ data }: { data: OrcaData | null }) {
  const routes = liveOrcaRoutes(data);
  const pools = liveOrcaPools(data);
  const poolMap = new Map(pools.map((pool) => [pool.pool_address, pool]));
  const rows = routes.map((route) => {
    const pool = poolMap.get(route.route_key);
    const programId = programIdForProtocol(route.protocol);
    return {
      id: route.route_key,
      surface: surfaceName(route),
      label: route.label,
      routeKey: route.route_key,
      program: orcaProgramLabel(route.protocol),
      programId,
      jit: route.jit_count,
      stalePct: Math.round(route.stale_quote_pickup_rate),
      bpsAtRisk: route.markout_30s_bps,
      loss: route.total_extracted_usd,
      lpDrag: pool?.lp_drag_estimate_usd ?? route.lp_annual_loss_usd_estimate,
      attackers: route.unique_attackers,
      toxicity: route.toxicity_probability,
      action: route.policy_action,
    };
  }).sort((a, b) => b.loss - a.loss || b.toxicity - a.toxicity);

  const totalLoss = rows.reduce((sum, row) => sum + row.loss, 0);
  const avgBps = rows.length > 0 ? rows.reduce((sum, row) => sum + row.bpsAtRisk, 0) / rows.length : null;
  const topAttackers = useMemo(() => {
    const byWallet = new Map<string, { wallet: string; attacks: number; extracted: number; types: Set<string> }>();
    for (const attack of liveOrcaAttacks(data)) {
      const current = byWallet.get(attack.attacker_wallet) ?? { wallet: attack.attacker_wallet, attacks: 0, extracted: 0, types: new Set<string>() };
      current.attacks += 1;
      current.extracted += (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0);
      current.types.add(attack.attack_type);
      byWallet.set(attack.attacker_wallet, current);
    }
    return [...byWallet.values()].sort((a, b) => b.extracted - a.extracted || b.attacks - a.attacks).slice(0, 5);
  }, [data]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Surfaces Monitored", `${rows.length}`, "Whirlpool + legacy Orca"],
          ["Observed Loss", fmtUsd(totalLoss), sourceRowsText(data)],
          ["Avg Bps at Risk", avgBps == null ? "--" : fmtBps(avgBps), "per swap"],
          ["Active Operators", `${rows.reduce((sum, row) => sum + row.attackers, 0)}`, "unique wallets"],
        ].map(([label, value, sub]) => (
          <div key={label} className="border border-border bg-card p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Toxicity by Surface</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Which Orca routes are most exposed</h2>
        </div>
        <div className="h-48 p-4">
          {rows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={TICK_STYLE} axisLine={false} tickLine={false} domain={[0, 100]} />
                <YAxis type="category" dataKey="surface" width={86} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(0)}%`, "Toxicity"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="toxicity" fill="hsl(var(--primary))" fillOpacity={0.85} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Orca Whirlpool route rows are available from the live API yet." />}
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All Monitored Surfaces</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">{rows.length} Orca surfaces ranked by extraction risk</h2>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{sourceDetail(data)}</span>
        </div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left">
              <thead className="border-b border-border/50">
                <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Surface / Route</th>
                  <th className="px-4 py-3 font-medium">Program</th>
                  <th className="px-4 py-3 font-medium">JIT</th>
                  <th className="px-4 py-3 font-medium">Stale Quote</th>
                  <th className="px-4 py-3 font-medium">Bps Risk</th>
                  <th className="px-4 py-3 font-medium">Est. Daily Loss</th>
                  <th className="px-4 py-3 font-medium">LP Drag</th>
                  <th className="px-4 py-3 font-medium">Policy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 transition-colors last:border-0 hover:bg-primary/5">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-foreground">{row.surface}</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="max-w-[180px] truncate font-mono text-[9px] text-muted-foreground">{row.routeKey}</span>
                        <CopyButton text={row.routeKey} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[10px] text-primary">{row.program}</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <ExternalLink href={solscanAccount(row.programId)}>{truncateAddress(row.programId, 5, 4)}</ExternalLink>
                        <CopyButton text={row.programId} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{row.jit}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.stalePct}%</td>
                    <td className="px-4 py-3 font-mono text-xs text-yellow-200">{fmtBps(row.bpsAtRisk)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-red-300">{fmtUsd(row.loss)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{fmtUsd(row.lpDrag)}</td>
                    <td className="px-4 py-3"><span className={`border px-2 py-0.5 font-mono text-[9px] uppercase ${actionTone(row.action)}`}>{actionLabel(row.action)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyPanel message="No Orca route risk rows yet. This stays empty until the API returns chain-classified Orca surfaces." />}
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Top Operators</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Wallets responsible for Orca extraction</h2>
        </div>
        <div className="divide-y divide-border/40">
          {topAttackers.length > 0 ? topAttackers.map((wallet, index) => (
            <div key={wallet.wallet} className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border font-mono text-xs text-muted-foreground">{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <ExternalLink href={solscanAccount(wallet.wallet)}>{truncateAddress(wallet.wallet, 8, 5)}</ExternalLink>
                  <CopyButton text={wallet.wallet} />
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{[...wallet.types].join(", ")}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs font-semibold text-red-300">{fmtUsd(wallet.extracted)}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{wallet.attacks} attacks</div>
              </div>
            </div>
          )) : <EmptyPanel message="No Orca attacker wallets are present in the current live detection window." />}
        </div>
      </div>
    </>
  );
}

function SectionJit({ data }: { data: OrcaData | null }) {
  const routes = liveOrcaRoutes(data);
  const attacks = liveOrcaAttacks(data).filter((attack) => attack.attack_type === "jit");
  const rows = routes.filter((route) => route.jit_count > 0 || orcaProgramLabel(route.protocol) === "Whirlpool").map((route) => ({
    id: route.route_key,
    surface: surfaceName(route),
    routeKey: route.route_key,
    windows: route.jit_count,
    dilutionBps: route.markout_5s_bps,
    lpDrag: route.lp_annual_loss_usd_estimate,
    attacker: `${route.unique_attackers} operators`,
    action: route.policy_action,
  })).sort((a, b) => b.windows - a.windows || b.lpDrag - a.lpDrag);
  const whirlpoolId = ORCA_PROGRAMS.WHIRLPOOL;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Whirlpool Program</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-foreground">{truncateAddress(whirlpoolId, 8, 6)}</span>
            <CopyButton text={whirlpoolId} />
          </div>
          <div className="mt-1.5"><ExternalLink href={solscanAccount(whirlpoolId)}>View on Solscan</ExternalLink></div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">JIT Windows</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{rows.reduce((sum, row) => sum + row.windows, 0)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">live feed</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total LP Drag</div>
          <div className="mt-2 text-2xl font-bold text-red-300">{fmtUsd(rows.reduce((sum, row) => sum + row.lpDrag, 0))}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">fee dilution + LVR</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Whirlpool Config</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-primary">{truncateAddress(ORCA_CONFIGS.MAINNET_WHIRLPOOLS_CONFIG, 8, 6)}</span>
            <CopyButton text={ORCA_CONFIGS.MAINNET_WHIRLPOOLS_CONFIG} />
          </div>
          <div className="mt-1.5"><ExternalLink href={solscanAccount(ORCA_CONFIGS.MAINNET_WHIRLPOOLS_CONFIG)}>View config</ExternalLink></div>
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Fee Dilution by Surface</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">LP drag from JIT windows</h2>
        </div>
        <div className="h-44 p-4">
          {rows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tickFormatter={(v) => formatAxisCurrency(Number(v))} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="surface" width={86} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [fmtUsd(v), "LP Drag"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="lpDrag" fill="hsl(var(--primary))" fillOpacity={0.85} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Orca JIT rows are available from the live API yet." />}
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All JIT Windows</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">{rows.length} Orca surfaces with JIT activity</h2>
        </div>
        <div className="divide-y divide-border/40">
          {rows.length === 0 && <EmptyPanel message="No JIT activity is present in the current Orca API window." />}
          {rows.map((row) => (
            <div key={row.id} className="grid gap-4 px-4 py-4 md:grid-cols-[1.5fr_1fr_1fr_0.5fr]">
              <div>
                <div className="font-mono text-sm font-semibold text-foreground">{row.surface}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="max-w-[220px] truncate font-mono text-[10px] text-muted-foreground">{row.routeKey}</span>
                  <CopyButton text={row.routeKey} />
                </div>
                <div className="mt-1"><ExternalLink href={solscanAccount(whirlpoolId)}>Whirlpool program</ExternalLink></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MiniMetric label="JIT Windows" value={String(row.windows)} />
                <MiniMetric label="Fee Dilution" value={fmtBps(row.dilutionBps)} />
              </div>
              <div>
                <div className="font-mono text-[9px] text-muted-foreground">LP Drag</div>
                <div className="mt-1 font-mono text-lg font-bold text-red-300">{fmtUsd(row.lpDrag)}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.attacker}</div>
              </div>
              <div className="flex items-center">
                <span className={`border px-2 py-1 font-mono text-[9px] uppercase ${actionTone(row.action)}`}>{actionLabel(row.action)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Recent JIT Detections</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Short-lived liquidity events from the feed</h2>
        </div>
        <div className="divide-y divide-border/40">
          {attacks.length > 0 ? attacks.slice(0, 8).map((attack) => (
            <div key={attack.id} className="grid gap-4 px-4 py-3 md:grid-cols-[1.5fr_1fr_1fr]">
              <div>
                <div className="font-mono text-sm font-semibold text-foreground">{attack.surface_label ?? formatPoolLabel(attack.pool_address)}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">{attack.evidence?.[0] ?? attack.detector ?? "orca jit"}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-muted-foreground">LP Capture</div>
                <div className="mt-1 font-mono text-sm font-bold text-primary">{fmtUsd(attack.profit_usd ?? attack.victim_loss_usd)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink href={solscanAccount(attack.attacker_wallet)}>{truncateAddress(attack.attacker_wallet, 8, 5)}</ExternalLink>
                <CopyButton text={attack.attacker_wallet} />
              </div>
            </div>
          )) : <EmptyPanel message="No JIT detection cards are present yet." />}
        </div>
      </div>
    </>
  );
}

function SectionAdaptive({ data }: { data: OrcaData | null }) {
  const rows = liveOrcaRoutes(data).sort((a, b) => b.stale_quote_pickup_rate - a.stale_quote_pickup_rate);
  const extensionId = ORCA_CONFIGS.MAINNET_CONFIG_EXTENSION;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Config Extension</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-foreground">{truncateAddress(extensionId, 8, 6)}</span>
            <CopyButton text={extensionId} />
          </div>
          <div className="mt-1.5"><ExternalLink href={solscanAccount(extensionId)}>View on Solscan</ExternalLink></div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">State Rows</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{rows.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{sourceRowsText(data)}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Avg Freshness</div>
          <div className="mt-2 text-2xl font-bold text-primary">{rows.length ? `${(rows.reduce((s, r) => s + r.quote_freshness_ms, 0) / rows.length).toFixed(0)}ms` : "--"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">quote state age</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Avg Bps Saved</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{rows.length ? fmtBps(rows.reduce((s, r) => s + r.estimated_savings_bps, 0) / rows.length) : "--"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">tick-aware protection</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-3">
          {ORCA_RESEARCH_NOTES.map((note) => (
            <a key={note.id} href={note.href} target="_blank" rel="noopener noreferrer" className="block border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">{note.source}</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{note.title}</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{note.guardrail}</p>
            </a>
          ))}
        </div>

        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Adaptive / Tick-Array Risk</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Rows where state reads change execution cost</h2>
          </div>
          {rows.length > 0 ? (
            <div className="divide-y divide-border/40">
              {rows.slice(0, 8).map((route) => (
                <div key={route.route_key} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-semibold text-foreground">{surfaceName(route)}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="max-w-[240px] truncate font-mono text-[10px] text-muted-foreground">{route.route_key}</span>
                        <CopyButton text={route.route_key} />
                      </div>
                    </div>
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(route.policy_action)}`}>{actionLabel(route.policy_action)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MiniMetric label="Stale quote" value={`${route.stale_quote_pickup_rate.toFixed(0)}%`} />
                    <MiniMetric label="Freshness" value={`${route.quote_freshness_ms.toFixed(0)}ms`} />
                    <MiniMetric label="Bps saved" value={fmtBps(route.estimated_savings_bps)} />
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyPanel message="No adaptive-fee or tick-array rows are present in the current Orca API window." />}
        </div>
      </div>
    </>
  );
}

function SectionLP({ data }: { data: OrcaData | null }) {
  const rows = liveOrcaLp(data).map((row) => ({
    id: row.pool_address,
    pool: row.pool_address,
    score: Math.round(row.toxicity_score),
    lvr: Math.round(row.lvr_proxy_score ?? 0),
    adv: Math.round(row.adverse_selection_intensity ?? 0),
    drag: row.lp_drag_estimate_usd ?? 0,
    saved: row.saved_fee_bps_if_segmented ?? 0,
    cause: row.primary_cause ?? "toxic flow",
  })).sort((a, b) => b.score - a.score || b.drag - a.drag);

  const scoreData = [
    { range: "80-100", count: rows.filter((row) => row.score >= 80).length, color: "hsl(0 85% 62%)" },
    { range: "60-79", count: rows.filter((row) => row.score >= 60 && row.score < 80).length, color: "hsl(48 96% 53%)" },
    { range: "0-59", count: rows.filter((row) => row.score < 60).length, color: "hsl(var(--primary))" },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="col-span-2 border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total LP Drag</div>
          <div className="mt-2 text-3xl font-bold text-red-300">{fmtUsd(rows.reduce((sum, row) => sum + row.drag, 0))}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">adverse selection + JIT fee dilution</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Surfaces</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{rows.length}</div>
        </div>
        <div className="border border-red-500/30 bg-red-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">High Risk</div>
          <div className="mt-2 text-2xl font-bold text-red-300">{rows.filter((row) => row.score >= 80).length}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Fee Saved / Surface</div>
          <div className="mt-2 text-2xl font-bold text-primary">{rows.length ? fmtBps(rows.reduce((sum, row) => sum + row.saved, 0) / rows.length) : "--"}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Data Source</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{sourceLabel(data)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{isDemoData(data) ? "local demo rows" : "live API rows only"}</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Risk Distribution</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Score breakdown</h2>
          </div>
          <div className="h-44 p-4">
            {rows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={scoreData} dataKey="count" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                    {scoreData.map((row) => <Cell key={row.range} fill={row.color} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} surfaces`, ""]} contentStyle={TOOLTIP_STYLE} />
                  <Legend formatter={(value) => <span className="font-mono text-[10px] text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyPanel message="No LP protection score distribution is available from live Orca rows yet." />}
          </div>
          <div className="space-y-1.5 border-t border-border/50 p-3">
            {scoreData.map((row) => (
              <div key={row.range} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                  <span className="font-mono text-[10px] text-muted-foreground">Score {row.range}</span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-foreground">{row.count} surfaces</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All LP Protection Scores</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Ranked by extraction risk</h2>
          </div>
          <div className="divide-y divide-border/40">
            {rows.length === 0 && <EmptyPanel message="No Orca LP protection rows are present in the current API window." />}
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-4 px-4 py-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center border font-mono text-sm font-bold ${row.score >= 80 ? "border-red-500/40 text-red-300" : row.score >= 60 ? "border-yellow-500/40 text-yellow-200" : "border-green-500/40 text-green-300"}`}>
                  {row.score}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground">{displayKey(row.pool, 10, 6)}</span>
                    <CopyButton text={row.pool} />
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{row.cause} · LVR {row.lvr} · Adverse sel. {row.adv}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs font-semibold text-red-300">{fmtUsd(row.drag)}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">{fmtBps(row.saved)} saved</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

type DetectionFilter =
  | "all"
  | "sandwich"
  | "backrun"
  | "arbitrage"
  | "jit"
  | "liquidation";

const FILTER_LABELS: Record<DetectionFilter, string> = {
  all: "All",
  sandwich: "Sandwich",
  backrun: "Backrun",
  arbitrage: "Arbitrage",
  jit: "JIT",
  liquidation: "Liquidation",
};

const DETECTION_FILTERS = Object.keys(FILTER_LABELS) as DetectionFilter[];

const TX_LABELS: Record<string, { frontrun?: string; victim?: string; backrun?: string }> = {
  sandwich: { frontrun: "Frontrun tx", victim: "Victim tx", backrun: "Backrun tx" },
  jit: { frontrun: "LP add", victim: "Victim swap", backrun: "LP remove" },
  backrun: { victim: "Victim tx", backrun: "Backrun tx" },
  arbitrage: { frontrun: "Entry leg", victim: "Exit leg" },
  liquidation: { victim: "Liquidation tx" },
};

function SectionDetections({ data }: { data: OrcaData | null }) {
  const [filter, setFilter] = useState<DetectionFilter>("all");
  const [selectedAttackId, setSelectedAttackId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, AttackDetail>>({});
  const [detailErrorById, setDetailErrorById] = useState<Record<number, string>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);

  const liveAttacks = useMemo(() => liveOrcaAttacks(data)
    .sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime()), [data]);
  const demoMode = isDemoData(data);

  const loadDetail = useCallback(async (attack: Attack) => {
    const attackId = attack.id;
    setLoadingDetailId(attackId);
    setDetailErrorById((prev) => {
      const next = { ...prev };
      delete next[attackId];
      return next;
    });
    if (demoMode) {
      setDetailById((prev) => ({ ...prev, [attackId]: attack as AttackDetail }));
      setLoadingDetailId(null);
      return;
    }
    try {
      const detail = await api.attackDetail(attackId);
      setDetailById((prev) => ({ ...prev, [attackId]: detail }));
    } catch (err) {
      setDetailErrorById((prev) => ({
        ...prev,
        [attackId]: err instanceof Error ? err.message : "Failed to load detail",
      }));
    } finally {
      setLoadingDetailId((current) => (current === attackId ? null : current));
    }
  }, [demoMode]);

  useEffect(() => {
    if (!selectedAttackId || detailById[selectedAttackId] || loadingDetailId === selectedAttackId) return;
    const selectedAttack = liveAttacks.find((attack) => attack.id === selectedAttackId);
    if (selectedAttack) void loadDetail(selectedAttack);
  }, [detailById, liveAttacks, loadDetail, loadingDetailId, selectedAttackId]);

  const counts = useMemo(() => {
    const next: Record<DetectionFilter, number> = { all: liveAttacks.length, sandwich: 0, backrun: 0, arbitrage: 0, jit: 0, liquidation: 0 };
    for (const attack of liveAttacks) if (attack.attack_type in next) next[attack.attack_type as DetectionFilter] += 1;
    return next;
  }, [liveAttacks]);

  const filtered = filter === "all" ? liveAttacks : liveAttacks.filter((attack) => attack.attack_type === filter);
  const totalProfit = liveAttacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0);
  const totalVictimLoss = liveAttacks.reduce((sum, attack) => sum + (attack.victim_loss_usd ?? 0), 0);
  const bundleSignals = liveAttacks.filter(hasBundleSignal).length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total Detections</div>
          <div className="mt-2 text-3xl font-bold text-foreground">{liveAttacks.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">live feed</div>
        </div>
        <div className="border border-red-500/30 bg-red-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Searcher Profit</div>
          <div className="mt-2 text-3xl font-bold text-red-300">{fmtUsd(totalProfit)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">net gain by attackers</div>
        </div>
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Victim Loss</div>
          <div className="mt-2 text-3xl font-bold text-yellow-200">{fmtUsd(totalVictimLoss)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">harm to users</div>
        </div>
        <div className="border border-primary/30 bg-primary/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Bundle Signals</div>
          <div className="mt-2 text-2xl font-bold text-primary">{bundleSignals}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">from lane or likelihood fields</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DETECTION_FILTERS.map((item) => {
          const count = counts[item];
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`min-h-10 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === item ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
            >
              <span className={filter !== item && count > 0 ? typeTextClass(item) : ""}>{FILTER_LABELS[item]}</span>
              {item !== "all" && <span className="ml-1 opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5">
          <span className="flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Live Orca MEV Detections</p>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{sourceDetail(data)}</span>
        </div>
        {filtered.length > 0 ? (
          <div className="space-y-2 p-3">
            {filtered.map((attack) => (
              <OrcaDetectionCard
                key={attack.id}
                attack={attack}
                detail={detailById[attack.id] ?? null}
                expanded={selectedAttackId === attack.id}
                loading={loadingDetailId === attack.id}
                error={detailErrorById[attack.id] ?? null}
                onToggle={() => setSelectedAttackId((current) => (current === attack.id ? null : attack.id))}
                onRetry={() => void loadDetail(attack)}
              />
            ))}
          </div>
        ) : (
          <EmptyPanel message={hasOrcaData(data) ? `No ${filter === "all" ? "Orca" : filter} detections in the current window.` : "Waiting for live chain data. Detections appear here once the feed connects."} />
        )}
      </div>
    </>
  );
}

function OrcaDetectionCard({
  attack,
  detail,
  expanded,
  loading,
  error,
  onToggle,
  onRetry,
}: {
  attack: Attack;
  detail: AttackDetail | null;
  expanded: boolean;
  loading: boolean;
  error: string | null;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const evidence = detail?.evidence ?? attack.evidence ?? [];
  const bundleSignal = hasBundleSignal(attack);
  const confidence = Math.round((attack.confidence ?? 0) * 100);
  const detailId = `orca-detection-${attack.id}`;

  return (
    <article className={`border p-3 transition-colors ${attack.attack_type === "jit" ? "border-primary/35 bg-primary/5" : attack.attack_type === "sandwich" ? "border-red-500/35 bg-red-500/5" : "border-border bg-background/25"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 font-mono text-xs font-bold uppercase ${actionTone(attack.attack_type === "jit" ? "allow" : "avoid")}`}>
              {attack.attack_type.replace("_", " ")}
            </span>
            {bundleSignal && <span className="border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-orange-300">Bundle signal</span>}
            {attack.entity_label && <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase text-primary">{attack.entity_label}</span>}
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {orcaProgramLabel(attack.protocol)} · {attack.surface_precision ?? "inferred"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">ATTACKER</span>
              {explorerAccountLink(attack.attacker_wallet)
                ? <ExternalLink href={solscanAccount(attack.attacker_wallet)}>{truncateAddress(attack.attacker_wallet, 6, 4)}</ExternalLink>
                : <span className="font-mono text-xs text-foreground">{displayKey(attack.attacker_wallet, 6, 4)}</span>}
              {explorerAccountLink(attack.attacker_wallet) && <CopyButton text={attack.attacker_wallet} />}
            </div>
            {attack.victim_wallet && (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-muted-foreground">VICTIM</span>
                {explorerAccountLink(attack.victim_wallet)
                  ? <ExternalLink href={solscanAccount(attack.victim_wallet)}>{truncateAddress(attack.victim_wallet, 6, 4)}</ExternalLink>
                  : <span className="font-mono text-xs text-foreground">{displayKey(attack.victim_wallet, 6, 4)}</span>}
                {explorerAccountLink(attack.victim_wallet) && <CopyButton text={attack.victim_wallet} />}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground">{attack.surface_label ?? formatPoolLabel(attack.pool_address)}</h3>
            <CopyButton text={attack.pool_address} />
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detectionSummary(attack)}</p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 text-right sm:grid-cols-5 lg:min-w-[620px]">
          <Metric label="Model" value={attack.detector ?? "unknown"} />
          <Metric label="Confidence" value={`${confidenceLabel(attack.confidence)} · ${confidence}%`} tone={confidence >= 85 ? "text-red-300" : "text-yellow-200"} />
          <Metric label={profitLabel(attack)} value={fmtUsd(attack.profit_usd)} tone={typeTextClass(attack.attack_type)} />
          <Metric label={harmLabel(attack)} value={fmtUsd(attack.victim_loss_usd)} tone="text-yellow-200" />
          <Metric label="Time" value={formatRelativeTime(attack.block_time)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em]">
        <Chip label="lane" value={attack.execution_lane ?? "standard"} />
        <Chip label="basis" value={attack.detection_basis ?? "heuristic"} />
        {attack.bundle_likelihood != null && <Chip label="bundle" value={`${(attack.bundle_likelihood * 100).toFixed(0)}%`} />}
        {attack.tip_lamports != null && <Chip label="tip" value={fmtLamports(attack.tip_lamports)} />}
      </div>

      {!!evidence.length && !expanded && (
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {evidence.slice(0, 3).map((item) => <span key={item} className="border border-border/80 px-2 py-1">{item}</span>)}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        {attack.frontrun_tx && <ExternalLink href={solscanTx(attack.frontrun_tx)}>{TX_LABELS[attack.attack_type]?.frontrun ?? "Frontrun tx"}</ExternalLink>}
        {attack.victim_tx && <ExternalLink href={solscanTx(attack.victim_tx)}>{TX_LABELS[attack.attack_type]?.victim ?? "Victim tx"}</ExternalLink>}
        {attack.backrun_tx && <ExternalLink href={solscanTx(attack.backrun_tx)}>{TX_LABELS[attack.attack_type]?.backrun ?? "Backrun tx"}</ExternalLink>}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={onToggle}
          className="ml-auto inline-flex min-h-10 items-center border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? "Collapse" : "Expand evidence"}
        </button>
      </div>

      {expanded && (
        <div id={detailId} className="mt-3 grid gap-3 border-t border-border/80 pt-3 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="border border-border/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Confidence Model</span>
                <span className={`font-mono text-sm font-bold ${confidence >= 85 ? "text-red-300" : confidence >= 65 ? "text-yellow-200" : "text-muted-foreground"}`}>{confidence}%</span>
              </div>
              <div className="h-1.5 border border-border/50 bg-background/60">
                <div
                  className={`h-full transition-[width] ${confidence >= 85 ? "bg-red-400" : confidence >= 65 ? "bg-yellow-400" : "bg-primary"}`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <div className="mt-3 space-y-1.5">
                {[
                  ["Orca protocol match", true],
                  ["Surface key present", !!attack.pool_address],
                  ["Tx evidence present", !!(attack.frontrun_tx || attack.victim_tx || attack.backrun_tx)],
                  ["Bundle or lane signal", bundleSignal],
                ].map(([label, present]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${present ? "bg-green-400" : "bg-border"}`} />
                    <span className={`font-mono text-[10px] ${present ? "text-foreground" : "text-muted-foreground/60"}`}>{label as string}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Evidence trail</span>
                {loading && <span className="animate-pulse font-mono text-[9px] text-primary">Loading...</span>}
              </div>
              {error ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-red-300">{error}</p>
                  <button type="button" onClick={onRetry} className="min-h-10 border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                    Retry detail
                  </button>
                </div>
              ) : evidence.length > 0 ? (
                <div className="mt-3 space-y-2 text-[11px] text-foreground">
                  {evidence.map((item) => <div key={item} className="border border-border/70 px-2 py-2">{item}</div>)}
                </div>
              ) : loading ? (
                <div className="mt-3 space-y-2">
                  <div className="h-8 animate-pulse bg-muted/40" />
                  <div className="h-8 animate-pulse bg-muted/30" />
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted-foreground">No evidence trail returned yet.</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="border border-border/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Event detail</div>
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <DetailLine label="Surface" value={attack.surface_label ?? formatPoolLabel(attack.pool_address)} copy={attack.pool_address} />
                <DetailLine label="Program" value={orcaProgramLabel(attack.protocol)} />
                <DetailLine label="Block time" value={new Date(attack.block_time).toLocaleString()} />
                <DetailLine label="Validator" value={displayKey(attack.validator, 10, 6)} href={explorerAccountLink(attack.validator)} copy={explorerAccountLink(attack.validator) ? attack.validator : undefined} />
                {attack.token_mint && <DetailLine label="Token mint" value={displayKey(attack.token_mint, 10, 6)} href={explorerAccountLink(attack.token_mint)} copy={explorerAccountLink(attack.token_mint) ? attack.token_mint : undefined} />}
                <DetailLine label="Surface precision" value={attack.surface_precision ?? "inferred"} />
              </div>
            </div>

            <div className="border border-primary/25 bg-primary/5 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">Orca mechanics</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{orcaMechanic(attack)}</p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function SectionSavings({ data }: { data: OrcaData | null }) {
  const chartData = useMemo(() => liveOrcaRoutes(data)
    .filter((route) => route.estimated_savings_usd > 0)
    .map((route) => ({
      name: surfaceName(route),
      routeKey: route.route_key,
      savings: Math.round(route.estimated_savings_usd),
      program: orcaProgramLabel(route.protocol),
      programId: programIdForProtocol(route.protocol),
      action: route.policy_action,
    }))
    .sort((a, b) => b.savings - a.savings), [data]);

  const totalSavings = chartData.reduce((sum, row) => sum + row.savings, 0);
  const byProgram = chartData.reduce((acc, row) => {
    acc[row.program] = (acc[row.program] ?? 0) + row.savings;
    return acc;
  }, {} as Record<string, number>);
  const lpDrag = liveOrcaLp(data).reduce((sum, row) => sum + (row.lp_drag_estimate_usd ?? 0), 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="col-span-2 border border-primary/40 bg-primary/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Observed Savings Potential</div>
          <div className="mt-2 text-5xl font-bold text-primary">{fmtUsd(totalSavings)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{sourceRowsText(data)}</div>
        </div>
        {Object.entries(byProgram).slice(0, 3).map(([program, savings]) => (
          <div key={program} className="border border-border bg-card p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{program}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{fmtUsd(savings)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">savings potential</div>
          </div>
        ))}
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Savings by Surface</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Estimated savings from {isDemoData(data) ? "local demo" : "live route"} rows</h2>
        </div>
        <div className="h-64 p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tickFormatter={(v) => formatAxisCurrency(Number(v))} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ ...TICK_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [fmtUsd(v), "Savings"]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "hsl(var(--foreground))" }} />
                <Bar dataKey="savings" radius={[0, 2, 2, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.routeKey} fill={entry.action === "avoid" ? "hsl(0 85% 62%)" : entry.action === "penalize" ? "hsl(48 96% 53%)" : "hsl(var(--primary))"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Orca savings rows are available from the live API yet." />}
        </div>
        <div className="flex flex-wrap gap-5 border-t border-border/50 px-4 py-2.5">
          {[["Reroute", "hsl(var(--primary))"], ["Cap size", "hsl(48 96% 53%)"], ["Block", "hsl(0 85% 62%)"]].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Route Breakdown</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">All routes — savings + identifiers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border/50">
                <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Surface</th>
                  <th className="px-4 py-2.5 font-medium">Program</th>
                  <th className="px-4 py-2.5 font-medium">Route Key</th>
                  <th className="px-4 py-2.5 text-right font-medium">Savings</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.routeKey} className="border-b border-border/30 transition-colors last:border-0 hover:bg-primary/5">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{row.name}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[10px] text-primary">{row.program}</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <ExternalLink href={solscanAccount(row.programId)}>{truncateAddress(row.programId, 5, 4)}</ExternalLink>
                        <CopyButton text={row.programId} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-[220px] truncate font-mono text-[10px] text-muted-foreground">{row.routeKey}</span>
                        <CopyButton text={row.routeKey} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-primary">{fmtUsd(row.savings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "Routes", value: `${chartData.length}`, desc: "Orca routes with savings estimates returned by the API", color: "border-red-500/30 bg-red-500/5" },
          { title: "For LPs", value: fmtUsd(lpDrag), desc: "LP drag currently returned by live LP protection rows", color: "border-primary/30 bg-primary/5" },
          { title: "Data Source", value: sourceLabel(data), desc: isDemoData(data) ? "local demo scenario for offline UI work" : "live Orca rows returned by the API", color: "border-yellow-500/30 bg-yellow-500/5" },
        ].map((card) => (
          <div key={card.title} className={`border p-5 ${card.color}`}>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{card.title}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{card.value}</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}

const EXTRACTION_TYPES = [
  { key: "jit", label: "JIT", color: "hsl(var(--primary))" },
  { key: "sandwich", label: "Sandwich", color: "hsl(0 85% 62%)" },
  { key: "backrun", label: "Backrun", color: "hsl(24 95% 58%)" },
  { key: "arbitrage", label: "Arb", color: "hsl(210 80% 60%)" },
  { key: "liquidation", label: "Liquidation", color: "hsl(280 70% 60%)" },
] as const;

type ExtractionKey = typeof EXTRACTION_TYPES[number]["key"];
type TrendRow = { ts: number; day: string } & Record<ExtractionKey, number>;

function rowTotal(row: TrendRow) {
  return EXTRACTION_TYPES.reduce((sum, { key }) => sum + row[key], 0);
}

function SectionExtraction({ data }: { data: OrcaData | null }) {
  const attacks = useMemo(() => liveOrcaAttacks(data), [data]);
  const trendData = useMemo(() => attacks
    .map((attack): TrendRow => {
      const value = (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0);
      const ts = new Date(attack.block_time).getTime();
      const type = attack.attack_type as ExtractionKey;
      return {
        ts,
        day: Number.isFinite(ts) ? new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--",
        jit: type === "jit" ? value : 0,
        sandwich: type === "sandwich" ? value : 0,
        backrun: type === "backrun" ? value : 0,
        arbitrage: type === "arbitrage" ? value : 0,
        liquidation: type === "liquidation" ? value : 0,
      };
    })
    .filter((row) => Number.isFinite(row.ts) && rowTotal(row) > 0)
    .sort((a, b) => a.ts - b.ts), [attacks]);

  const observedTotal = trendData.reduce((sum, row) => sum + rowTotal(row), 0);
  const peakBucket = trendData.length > 0 ? trendData.reduce((max, row) => rowTotal(row) > rowTotal(max) ? row : max, trendData[0]) : null;
  const byProgram = useMemo(() => {
    const totals = new Map<string, number>();
    for (const attack of attacks) {
      const program = orcaProgramLabel(attack.protocol);
      totals.set(program, (totals.get(program) ?? 0) + (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0));
    }
    const fills = ["hsl(var(--primary))", "hsl(0 85% 62%)", "hsl(48 96% 53%)", "hsl(150 70% 45%)"];
    return [...totals.entries()]
      .map(([name, value], index) => ({ name, value, fill: fills[index % fills.length] }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [attacks]);
  const byProgramTotal = byProgram.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="col-span-2 border border-red-500/40 bg-red-500/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Observed Orca extraction</div>
          <div className="mt-2 text-5xl font-bold text-red-300">{fmtUsd(observedTotal)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isDemoData(data) ? "from local demo detections" : "from current live detections"}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Peak Observation</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{peakBucket?.day ?? "--"}</div>
          <div className="mt-0.5 font-mono text-xs text-red-300">{peakBucket ? fmtUsd(rowTotal(peakBucket)) : "--"}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Detections</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{attacks.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{isDemoData(data) ? "local demo window" : "current API window"}</div>
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Observed Extraction Timeline</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">By attack type — detection time</h2>
        </div>
        <div className="h-72 p-4">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="day" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatAxisCurrency(Number(v))} tick={TICK_STYLE} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: number, name: string) => [fmtUsd(v), EXTRACTION_TYPES.find((type) => type.key === name)?.label ?? name]} contentStyle={TOOLTIP_STYLE} />
                {EXTRACTION_TYPES.map(({ key, color }) => (
                  <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Orca extraction timeline is available yet. The graph only renders live API detections." />}
        </div>
        <div className="flex flex-wrap gap-4 border-t border-border/50 px-4 py-2.5">
          {EXTRACTION_TYPES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">By Program</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Extraction breakdown by Orca surface</h2>
          </div>
          <div className="h-64 p-4">
            {byProgram.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byProgram} dataKey="value" cx="50%" cy="50%" outerRadius={90} strokeWidth={0}>
                    {byProgram.map((row) => <Cell key={row.name} fill={row.fill} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [fmtUsd(v), ""]} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyPanel message="No Orca program breakdown is available from live detections yet." />}
          </div>
          <div className="space-y-2 border-t border-border/50 p-3">
            {byProgram.map((row) => (
              <div key={row.name} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: row.fill }} />
                <span className="flex-1 font-mono text-[10px] text-muted-foreground">{row.name}</span>
                <span className="font-mono text-[10px] font-semibold text-foreground">{fmtUsd(row.value)}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{byProgramTotal > 0 ? Math.round(row.value / byProgramTotal * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Bucket Breakdown</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Extraction per type per slot window</h2>
          </div>
          {trendData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border/50">
                  <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-3 py-2.5 text-left font-medium">Time</th>
                    {EXTRACTION_TYPES.map(({ key, label, color }) => (
                      <th key={key} className="px-3 py-2.5 text-right font-medium" style={{ color }}>{label}</th>
                    ))}
                    <th className="px-3 py-2.5 text-right font-medium text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {trendData.map((row) => {
                    const total = rowTotal(row);
                    const isPeak = peakBucket != null && row.day === peakBucket.day;
                    return (
                      <tr key={`${row.ts}-${row.day}`} className={`border-b border-border/30 transition-colors last:border-0 ${isPeak ? "bg-red-500/5" : "hover:bg-primary/5"}`}>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.day}{isPeak && <span className="ml-1 font-mono text-[9px] text-red-300">peak</span>}
                        </td>
                        {EXTRACTION_TYPES.map(({ key }) => (
                          <td key={key} className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                            {row[key] > 0 ? fmtUsd(row[key]) : "--"}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-foreground">{fmtUsd(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyPanel message="No extraction rows are present in the current live detection window." />}
        </div>
      </div>
    </>
  );
}

export default function OrcaIntelligence({ section = "overview" }: { section?: OrcaSection }) {
  const { data, loading, refreshing, error, reload } = useOrcaData();

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <PageShell section={section} data={data} refreshing={refreshing} onRefresh={reload}>
      {error && (
        <div className="border border-red-500/35 bg-red-500/10 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-300">Orca API request failed</div>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 min-h-10 border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Retry
          </button>
        </div>
      )}
      {isDemoData(data) && (
        <div className="border border-yellow-500/35 bg-yellow-500/10 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-200">Local Orca demo scenario</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Backend chain rows are unavailable or empty, so this page is showing a seeded Orca protection scenario for local testing.
            Live API rows replace it automatically once Orca surfaces arrive.
          </p>
        </div>
      )}
      {section === "overview" && <SectionOverview data={data} />}
      {section === "whirlpools" && <SectionWhirlpools data={data} />}
      {section === "jit" && <SectionJit data={data} />}
      {section === "adaptive" && <SectionAdaptive data={data} />}
      {section === "lp" && <SectionLP data={data} />}
      {section === "detections" && <SectionDetections data={data} />}
      {section === "savings" && <SectionSavings data={data} />}
      {section === "extraction" && <SectionExtraction data={data} />}
    </PageShell>
  );
}
