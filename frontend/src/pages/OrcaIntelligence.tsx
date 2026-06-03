import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
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
  Attack,
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

const ENABLE_LOCAL_ORCA_DEMO =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_ORCA_DEMO === "true";

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
        return {
          status,
          routes,
          attacks,
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
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

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

function DetectionFeed({ attacks }: { attacks: Attack[] }) {
  const items = attacks.slice(0, 7);
  if (items.length === 0) return <EmptyInline message="No Orca detections in the current feed window." />;

  return (
    <div className="divide-y divide-border/40">
      {items.map((attack) => (
        <div key={attack.id} className="grid gap-3 px-4 py-3 text-xs md:grid-cols-[110px_1fr_90px_100px_90px] md:items-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">{attack.attack_type.replace("_", " ")}</div>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{attack.surface_label ?? formatPoolLabel(attack.pool_address)}</div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{attack.evidence?.[0] ?? attack.detector ?? "orca detector"}</div>
          </div>
          <div className="font-mono text-red-300">{fmtUsd(attack.profit_usd ?? attack.victim_loss_usd)}</div>
          <div className="font-mono text-muted-foreground">{truncateAddress(attack.attacker_wallet, 5, 4)}</div>
          <div className="font-mono text-[10px] text-muted-foreground/70">{formatRelativeTime(attack.block_time)}</div>
        </div>
      ))}
    </div>
  );
}

function renderWhirlpoolsSection(routes: RouteRisk[], pools: PoolToxicity[]) {
  const rows = routes.filter(isOrcaRoute);
  const poolMap = new Map(pools.filter(isOrcaPool).map((pool) => [pool.pool_address, pool]));

  return (
    <SectionShell eyebrow="Whirlpools" title="Tick-Range Risk By Pool">
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-border/50">
              <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Pool / Pair</th>
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
                return (
                  <tr key={route.route_key} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-foreground">{pairFromSurface(route.route_key)}</div>
                      <div className="mt-0.5 max-w-[240px] truncate font-mono text-[9px] text-muted-foreground">{route.label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[10px] text-primary">{orcaProgramLabel(route.protocol)}</div>
                      <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{truncateAddress(orcaProgramId(route.protocol) ?? ORCA_PROGRAMS.WHIRLPOOL, 5, 4)}</div>
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

function renderJitSection(routes: RouteRisk[], attacks: Attack[]) {
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
            <div key={attack.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-xs font-medium text-foreground">{attack.surface_label ?? formatPoolLabel(attack.pool_address)}</div>
                <span className="font-mono text-[10px] text-primary">{Math.round(attack.confidence * 100)}%</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">{attack.evidence?.[1] ?? "active tick range fee capture"}</div>
              <div className="mt-2 flex gap-3 font-mono text-[10px] text-muted-foreground">
                <span>{fmtUsd(attack.profit_usd)} profit</span>
                <span>{fmtLamports(attack.tip_lamports)}</span>
              </div>
            </div>
          )) : <EmptyInline message="No JIT attack cards are present yet." />}
        </div>
      </div>
    </SectionShell>
  );
}

function renderAdaptiveSection(routes: RouteRisk[]) {
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
            <div key={route.route_key} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-xs font-medium text-foreground">{route.label}</div>
                <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${actionTone(route.policy_action)}`}>{actionLabel(route.policy_action)}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <MiniMetric label="Stale quote" value={`${route.stale_quote_pickup_rate.toFixed(0)}%`} />
                <MiniMetric label="Freshness" value={`${route.quote_freshness_ms.toFixed(0)}ms`} />
                <MiniMetric label="Bps saved" value={fmtBps(route.estimated_savings_bps)} />
              </div>
            </div>
          ))}
          {rows.length === 0 && <EmptyInline message="No adaptive-fee or tick-array risk rows yet." />}
        </div>
      </div>
    </SectionShell>
  );
}

function renderLpSection(lpRows: LpProtectionSnapshot[]) {
  const rows = lpRows.filter(isOrcaPool).sort((a, b) => b.lp_drag_estimate_usd - a.lp_drag_estimate_usd);

  return (
    <SectionShell eyebrow="LP Protection" title="Whirlpool LP Drag And Fee Dilution">
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.length > 0 ? rows.map((row) => (
          <div key={row.pool_address} className={`border p-4 ${row.toxicity_score >= 80 ? "border-red-500/35 bg-red-500/5" : row.toxicity_score >= 60 ? "border-yellow-500/35 bg-yellow-500/5" : "border-border bg-background/25"}`}>
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
          </div>
        )) : <EmptyInline message="No Orca LP protection rows are present yet." />}
      </div>
    </SectionShell>
  );
}

export default function OrcaIntelligence({ section = "overview" }: { section?: OrcaSection }) {
  const { data, loading, refreshing, error, reload } = useOrcaData();

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

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-5 text-foreground md:px-6">
      <div className="pointer-events-none fixed inset-0 grid-overlay-subtle opacity-15" />
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
          <SectionShell eyebrow="Savings" title="Estimated Savings — Top Orca Pools">
            <div className="h-56 p-4">
              {savingsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={savingsChart} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis type="number" tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={TICK_STYLE} axisLine={false} tickLine={false} />
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
                    <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={TICK_STYLE} axisLine={false} tickLine={false} width={40} />
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

        {selectedSections.includes("whirlpools") && renderWhirlpoolsSection(routes, pools)}
        {selectedSections.includes("jit") && renderJitSection(routes, attacks)}
        {selectedSections.includes("adaptive") && renderAdaptiveSection(routes)}
        {selectedSections.includes("lp") && renderLpSection(lpRows)}

        {selectedSections.includes("detections") && (
          <SectionShell eyebrow="Live Feed" title="Orca MEV Detections">
            <DetectionFeed attacks={attacks} />
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
