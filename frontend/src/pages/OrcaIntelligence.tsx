import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Copy as CopyIcon, ExternalLink as ExternalLinkIcon, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-border/50 bg-background/35 p-3">
      <div className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-foreground">{value}</div>
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

export default function OrcaIntelligence({ section = "overview" }: { section?: OrcaSection }) {
  const { data, loading, refreshing, error, reload } = useOrcaData();
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteRisk | null>(null);
  const [selectedLp, setSelectedLp] = useState<LpProtectionSnapshot | null>(null);
  const [attackDetails, setAttackDetails] = useState<Record<number, AttackDetail>>({});
  const [attackDetailLoading, setAttackDetailLoading] = useState(false);
  const [attackDetailError, setAttackDetailError] = useState<string | null>(null);

  const routes = useMemo(() => data?.routes.filter(isOrcaRoute) ?? [], [data?.routes]);
  const attacks = useMemo(() => data?.attacks.filter(isOrcaAttack) ?? [], [data?.attacks]);
  const pools = useMemo(() => data?.pools.filter(isOrcaPool) ?? [], [data?.pools]);
  const lpRows = useMemo(() => data?.lp.filter(isOrcaPool) ?? [], [data?.lp]);
  const isLiveChain = data?.status?.mode === "chain" && data.source === "chain";
  const isDemo = data?.source === "demo";
  const dataMode = isLiveChain ? "chain" : isDemo ? "demo" : "fallback";

  const totals = useMemo(() => {
    const extracted = Math.max(
      routes.reduce((sum, route) => sum + route.total_extracted_usd, 0),
      attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? attack.victim_loss_usd ?? 0), 0),
    );
    const savings = Math.max(
      routes.reduce((sum, route) => sum + route.estimated_savings_usd, 0),
      data?.guard?.savings_proof.estimated_loss_prevented_usd ?? 0,
    );
    const lpDrag = lpRows.reduce((sum, row) => sum + row.lp_drag_estimate_usd, 0);
    return { extracted, savings, lpDrag, liveSurfaces: routes.length };
  }, [attacks, data?.guard, lpRows, routes]);

  const savingsChart = routes
    .filter((route) => route.estimated_savings_usd > 0)
    .sort((a, b) => b.estimated_savings_usd - a.estimated_savings_usd)
    .slice(0, 5)
    .map((route) => ({
      name: pairFromSurface(route.route_key),
      savings: Math.round(route.estimated_savings_usd),
      action: route.policy_action,
    }));

  const trendData = attacks
    .map((attack) => ({
      time: new Date(attack.block_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      jit: attack.attack_type === "jit" ? attack.profit_usd ?? attack.victim_loss_usd ?? 0 : 0,
      stale: attack.attack_type === "arbitrage" || attack.attack_type === "backrun" ? attack.profit_usd ?? attack.victim_loss_usd ?? 0 : 0,
      sandwich: attack.attack_type === "sandwich" ? attack.profit_usd ?? attack.victim_loss_usd ?? 0 : 0,
    }))
    .reverse();

  const selectedSections = section === "overview"
    ? ["whirlpools", "jit", "adaptive", "lp", "detections", "savings", "extraction"]
    : [section];

  const openAttack = useCallback((attack: Attack) => {
    setSelectedRoute(null);
    setSelectedLp(null);
    setSelectedAttack(attack);
  }, []);

  const openRoute = useCallback((route: RouteRisk) => {
    setSelectedAttack(null);
    setSelectedLp(null);
    setSelectedRoute(route);
  }, []);

  const openLp = useCallback((row: LpProtectionSnapshot) => {
    setSelectedAttack(null);
    setSelectedRoute(null);
    setSelectedLp(row);
  }, []);

  useEffect(() => {
    if (!selectedAttack) {
      setAttackDetailLoading(false);
      setAttackDetailError(null);
      return;
    }

    if (attackDetails[selectedAttack.id]) {
      setAttackDetailLoading(false);
      setAttackDetailError(null);
      return;
    }

    setAttackDetailLoading(true);
    setAttackDetailError(null);
    api.attackDetail(selectedAttack.id)
      .then((detail) => setAttackDetails((prev) => ({ ...prev, [detail.id]: detail })))
      .catch((err) => {
        if (data?.source === "demo") {
          setAttackDetails((prev) => ({ ...prev, [selectedAttack.id]: selectedAttack as AttackDetail }));
          return;
        }
        setAttackDetailError(err instanceof Error ? err.message : "Failed to load attack details");
      })
      .finally(() => setAttackDetailLoading(false));
  }, [attackDetails, data?.source, selectedAttack]);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-6">
      <div className="pointer-events-none fixed inset-0 grid-overlay-subtle opacity-15" />
      {selectedAttack && (
        <AttackDrawer
          attack={selectedAttack}
          detail={attackDetails[selectedAttack.id] ?? null}
          loading={attackDetailLoading}
          error={attackDetailError}
          onClose={() => setSelectedAttack(null)}
        />
      )}
      {selectedRoute && <RouteDrawer route={selectedRoute} onClose={() => setSelectedRoute(null)} />}
      {selectedLp && <LpDrawer row={selectedLp} onClose={() => setSelectedLp(null)} />}

      <div className="relative mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
            <Link to="/" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Home</Link>
            <Link to="/dex-intelligence" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">DEX Intelligence</Link>
            <Link to="/dex-intelligence/raydium" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Raydium</Link>
            <Link to="/dashboard" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Dashboard</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${dataMode === "chain" ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"}`}>
              {dataMode === "chain" ? "Live chain" : dataMode === "demo" ? "Local demo" : "Waiting for chain"}
            </span>
            <button type="button" onClick={reload} disabled={refreshing}
              className="inline-flex min-h-10 items-center gap-2 border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <div className="flex items-center gap-4">
          <OrcaLogo size={38} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Orca Intelligence</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Whirlpool protection surface.</h1>
          </div>
        </div>

        {!isLiveChain && (
          <div className="flex items-center gap-3 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-yellow-200">
              {isDemo
                ? "Local Orca demo scenario. Live chain data replaces this automatically when the API returns Orca rows."
                : "Waiting for chain feed. Orca rows stay empty until the API returns live data."}
            </p>
          </div>
        )}

        <LiveTicker attacks={attacks} onAttackClick={openAttack} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="border border-red-500/40 bg-red-500/5 p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Observed Orca extraction</div>
            <div className="mt-2 text-4xl font-bold text-red-300">{fmtUsd(totals.extracted)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{routes.length} surfaces scored</div>
          </div>
          <div className="border border-primary/40 bg-primary/5 p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Savings potential / 24h</div>
            <div className="mt-2 text-3xl font-bold text-primary">{fmtUsd(totals.savings)}</div>
            <div className="mt-1 text-xs text-muted-foreground">route caps + tick-aware reroute</div>
          </div>
          <div className="border border-border bg-card p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Whirlpool LP drag</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{fmtUsd(totals.lpDrag)}</div>
            <div className="mt-1 text-xs text-muted-foreground">JIT dilution + LVR proxy</div>
          </div>
          <div className="border border-border bg-card p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Orca TVL ref</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{fmtUsd(data?.market.tvlUsd)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{fmtUsd(data?.market.volume24hUsd)} 24h volume</div>
          </div>
        </section>

        {selectedSections.includes("savings") && (
          <SectionShell eyebrow="Savings" title="Estimated Savings — Top Orca Surfaces">
            <div className="h-56 p-4">
              {savingsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={savingsChart} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis type="number" tickFormatter={(v) => formatAxisCurrency(Number(v))} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={84} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [fmtUsd(v), "Savings"]} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="savings" radius={[0, 2, 2, 0]}>
                      {savingsChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.action === "avoid" ? "hsl(0 85% 62%)" : "hsl(var(--primary))"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyInline message="No Orca savings rows are available yet." />}
            </div>
          </SectionShell>
        )}

        {selectedSections.includes("extraction") && (
          <SectionShell eyebrow="Observed Trend" title="Extraction By Orca Flow Type">
            <div className="h-52 p-4">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis dataKey="time" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatAxisCurrency(Number(v))} tick={TICK_STYLE} axisLine={false} tickLine={false} width={46} />
                    <Tooltip formatter={(v: number, name: string) => [fmtUsd(v), name]} contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="jit" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="stale" stackId="1" stroke="hsl(210 80% 65%)" fill="hsl(210 80% 65%)" fillOpacity={0.3} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="sandwich" stackId="1" stroke="hsl(0 85% 62%)" fill="hsl(0 85% 62%)" fillOpacity={0.3} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyInline message="No Orca extraction timeline is available yet." />}
            </div>
          </SectionShell>
        )}

        {selectedSections.includes("whirlpools") && renderWhirlpoolsSection(routes, pools, openRoute)}
        {selectedSections.includes("jit") && renderJitSection(routes, attacks, openAttack)}
        {selectedSections.includes("adaptive") && renderAdaptiveSection(routes, openRoute)}
        {selectedSections.includes("lp") && renderLpSection(lpRows, openLp)}

        {selectedSections.includes("detections") && (
          <SectionShell eyebrow="Live Feed" title="Orca MEV Detections">
            <DetectionFeed attacks={attacks} onAttackClick={openAttack} />
          </SectionShell>
        )}

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
      </div>
    </main>
  );
}
