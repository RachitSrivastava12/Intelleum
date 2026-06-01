import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  api, Attack, AttackDetail, LpProtectionSnapshot, PoolToxicity, RouteRisk, SystemStatus,
} from "@/lib/api";
import {
  demoSystemStatus,
  getDemoRaydiumAttacks,
  getDemoRaydiumLpProtection,
  getDemoRaydiumPools,
  getDemoRaydiumRoutes,
} from "@/lib/demoData";
import { formatPoolLabel, formatRelativeTime, truncateAddress } from "@/lib/utils";
import {
  RAYDIUM_PROGRAMS,
  raydiumProgramLabel,
  attackMeta,
  sandwichConfidenceSignals,
  jitConfidenceSignals,
  fmtUsd,
  fmtBps,
  fmtLamports,
} from "@/lib/raydium";

export type RaydiumSection =
  | "pools" | "jit" | "launchlab" | "lp"
  | "detections" | "savings" | "extraction";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Keep local aliases so internal code doesn't need to change
const fmt = fmtUsd;
const bps = fmtBps;

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  if (v > 0) return `$${v.toFixed(0)}`;
  return "$0";
}

function solscan(address: string, type: "account" | "tx" = "account") {
  return `https://solscan.io/${type}/${address}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy"
      className="inline-flex items-center justify-center h-4 w-4 shrink-0 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none"
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 5.5L4 8L9.5 2.5" stroke="hsl(var(--primary))" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <rect x="1" y="3.5" width="6.5" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M3.5 3.5V2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H8" stroke="currentColor" strokeWidth="1.1"/>
        </svg>
      )}
    </button>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex min-h-6 items-center gap-1 font-mono text-[10px] text-primary underline decoration-primary/30 transition-all hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {label}
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0">
        <path d="M1.5 7.5L7.5 1.5M7.5 1.5H3.5M7.5 1.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </a>
  );
}
function isRaydium(v?: string | null) { return !!v && /raydium/i.test(v); }
function isRaydiumRoute(r: RouteRisk) { return isRaydium(r.protocol) || isRaydium(r.route_key) || isRaydium(r.label); }
function isRaydiumAttack(a: Attack) { return isRaydium(a.protocol) || isRaydium(a.pool_address) || isRaydium(a.surface_label); }
function isRaydiumPool(p: PoolToxicity | LpProtectionSnapshot) { return isRaydium(p.protocol) || isRaydium(p.pool_address); }
const ENABLE_LOCAL_RAYDIUM_DEMO =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_RAYDIUM_DEMO === "true";
function isLiveData(data: RaydiumData | null) { return data?.source === "chain" && data.status?.mode === "chain"; }
function isDemoData(data: RaydiumData | null) { return data?.source === "demo"; }
function hasRaydiumData(data: RaydiumData | null) { return data?.source === "chain" || data?.source === "demo"; }
function sourceLabel(data: RaydiumData | null) {
  if (isLiveData(data)) return "Chain";
  if (isDemoData(data)) return "Local demo";
  return "--";
}
function sourceDetail(data: RaydiumData | null) {
  if (isLiveData(data)) return "QuickNode live";
  if (isDemoData(data)) return "local Raydium demo";
  return "waiting for chain";
}
function sourceRowsText(data: RaydiumData | null) {
  return isDemoData(data) ? "from local demo rows" : "from current API rows";
}
function programName(protocol?: string | null) { return raydiumProgramLabel(protocol, "Raydium"); }
function programIdForProtocol(protocol?: string | null) {
  const raw = protocol ?? "";
  if (/cpmm/i.test(raw)) return RAYDIUM_PROGRAMS.CPMM;
  if (/clmm/i.test(raw)) return RAYDIUM_PROGRAMS.CLMM;
  if (/launch/i.test(raw)) return RAYDIUM_PROGRAMS.LAUNCHLAB;
  if (/stable/i.test(raw)) return RAYDIUM_PROGRAMS.STABLE_AMM;
  return RAYDIUM_PROGRAMS.AMM_V4;
}
function hasBundleSignal(attack: Attack) {
  return attack.execution_lane === "jito-aligned" || (attack.bundle_likelihood ?? 0) >= 0.75;
}
const TX_LABELS: Record<string, { frontrun?: string; victim?: string; backrun?: string }> = {
  sandwich:        { frontrun: "Frontrun tx",   victim: "Victim tx",    backrun: "Backrun tx" },
  jit:             { frontrun: "LP add",         victim: "Victim swap",  backrun: "LP remove" },
  backrun:         {                             victim: "Victim tx",    backrun: "Backrun tx" },
  arbitrage:       { frontrun: "Entry leg",      victim: "Exit leg" },
  liquidity_snipe: { frontrun: "Launch create",  victim: "First buy" },
  liquidity_drain: { frontrun: "Drain remove",                           backrun: "Dump tx" },
  liquidation:     {                             victim: "Liquidation tx" },
};

function actionTone(a: string) {
  if (a === "avoid" || a === "block" || a === "high") return "border-red-500/45 bg-red-500/10 text-red-300";
  if (a === "reroute" || a === "penalize" || a === "cap" || a === "medium") return "border-yellow-500/45 bg-yellow-500/10 text-yellow-200";
  if (a === "allow" || a === "low") return "border-green-500/40 bg-green-500/10 text-green-300";
  return "border-primary/35 bg-primary/10 text-primary";
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-border/60 bg-background/50 p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Raydium Logo ─────────────────────────────────────────────────────────────

function RaydiumLogo({ size = 28 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center border border-primary/40 bg-primary/10 font-mono text-xs font-bold text-primary">R</div>
  );
  return <img src="https://raydium.io/favicon.ico" alt="Raydium" width={size} height={size} className="object-contain" onError={() => setFailed(true)} />;
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

const SECTION_META: Record<RaydiumSection, { eyebrow: string; title: string }> = {
  pools:      { eyebrow: "CPMM / AMM v4", title: "Sandwiched Pools" },
  jit:        { eyebrow: "CLMM",          title: "JIT Liquidity Monitor" },
  launchlab:  { eyebrow: "LaunchLab",     title: "Sniper Feed" },
  lp:         { eyebrow: "LP Protection", title: "Per-Pool Protection Scores" },
  detections: { eyebrow: "Live Feed",     title: "Raydium MEV Detections" },
  savings:    { eyebrow: "Savings",       title: "Estimated Savings" },
  extraction: { eyebrow: "Observed Trend", title: "Extraction Timeline" },
};

function PageShell({ section, refreshing, onRefresh, children }: {
  section: RaydiumSection;
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  const { eyebrow, title } = SECTION_META[section];
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="pointer-events-none fixed inset-0 grid-overlay-subtle opacity-10" />
      <div className="relative mx-auto max-w-7xl space-y-5">

        {/* Nav */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
            <Link to="/" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Home</Link>
            <Link to="/dex-intelligence" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">DEX Intelligence</Link>
            <Link to="/dex-intelligence/raydium" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Raydium</Link>
            <span className="border border-primary/40 bg-primary/5 px-3 py-2 text-primary">{title}</span>
          </div>
          <button type="button" onClick={onRefresh} disabled={refreshing}
            className="inline-flex min-h-10 items-center gap-2 border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        {/* Title */}
        <div className="flex items-center gap-4">
          <RaydiumLogo size={36} />
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

// ─── Shared chart style ────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 0,
  fontFamily: "JetBrains Mono",
  fontSize: 11,
};
const TICK_STYLE = { fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" };

// ─── Data hook ────────────────────────────────────────────────────────────────

type RaydiumData = {
  status: SystemStatus | null;
  routes: RouteRisk[];
  attacks: Attack[];
  pools: PoolToxicity[];
  lp: LpProtectionSnapshot[];
  source: "chain" | "demo";
};

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

function buildRaydiumDemoData(status?: SystemStatus | null): RaydiumData {
  return {
    status: buildRaydiumDemoStatus(status),
    routes: getDemoRaydiumRoutes(),
    attacks: getDemoRaydiumAttacks(),
    pools: getDemoRaydiumPools(),
    lp: getDemoRaydiumLpProtection(),
    source: "demo",
  };
}

function shouldUseLocalRaydiumDemo(
  status: SystemStatus,
  routes: RouteRisk[],
  attacks: Attack[],
  pools: PoolToxicity[],
  lp: LpProtectionSnapshot[],
) {
  if (!ENABLE_LOCAL_RAYDIUM_DEMO) return false;
  if (status.mode !== "chain") return true;
  return !(
    routes.some(isRaydiumRoute) ||
    attacks.some(isRaydiumAttack) ||
    pools.some(isRaydiumPool) ||
    lp.some(isRaydiumPool)
  );
}

function useRaydiumData() {
  const [data, setData] = useState<RaydiumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAttackFetchRef = useRef<string | null>(null);

  // Initial load — fetch routes/pools/lp once, attacks for seed
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [status, routes, attacks, pools, lp] = await Promise.all([
        api.systemStatus(),
        api.routeRisks(20),
        api.attacks({ limit: "20" }),
        api.pools(20),
        api.lpProtection(20),
      ]);
      if (attacks.length > 0) {
        lastAttackFetchRef.current = attacks[0].block_time;
      }
      if (shouldUseLocalRaydiumDemo(status, routes, attacks, pools, lp)) {
        setData(buildRaydiumDemoData(status));
      } else {
        setData({ status, routes, attacks, pools, lp, source: "chain" });
      }
      setError(null);
    } catch (err) {
      if (ENABLE_LOCAL_RAYDIUM_DEMO) {
        setData(buildRaydiumDemoData());
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load Raydium data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Attack poll — runs every 5s, fetches only new attacks and prepends them
  const pollAttacks = useCallback(async () => {
    try {
      const fresh = await api.attacks({
        limit: "20",
        since: lastAttackFetchRef.current ?? undefined,
      });
      if (fresh.length === 0) return;
      lastAttackFetchRef.current = fresh[0].block_time;
      setData((prev) => {
        if (!prev || prev.source === "demo") return prev;
        const existingIds = new Set(prev.attacks.map((a) => a.id));
        const newOnes = fresh.filter((a) => !existingIds.has(a.id));
        if (newOnes.length === 0) return prev;
        return { ...prev, attacks: [...newOnes, ...prev.attacks].slice(0, 200) };
      });
    } catch { /* silent — don't disrupt the page */ }
  }, []);

  useEffect(() => {
    void load();
    // Routes/pools/lp refresh every 30s; attacks every 5s
    const slowId = window.setInterval(() => void load(true), 30_000);
    const fastId = window.setInterval(() => void pollAttacks(), 5_000);
    return () => {
      window.clearInterval(slowId);
      window.clearInterval(fastId);
    };
  }, [load, pollAttacks]);

  return { data, loading, refreshing, error, reload: () => void load(true) };
}

function typeTextClass(t: string) {
  if (t === "sandwich")        return "text-red-300";
  if (t === "jit")             return "text-primary";
  if (t === "backrun")         return "text-orange-300";
  if (t === "arbitrage")       return "text-blue-300";
  if (t === "liquidity_snipe") return "text-yellow-200";
  if (t === "liquidity_drain") return "text-yellow-400";
  if (t === "liquidation")     return "text-purple-300";
  return "text-muted-foreground";
}

// ─── Section: Pools ──────────────────────────────────────────────────────────

function SectionPools({ data }: { data: RaydiumData | null }) {
  const live = useMemo(() => {
    if (!hasRaydiumData(data)) return [];
    const fromRoutes = data.routes.filter(isRaydiumRoute).filter((r) => r.sandwich_count > 0).map((r) => ({
      id: r.route_key,
      routeKey: r.route_key,
      pair: r.label?.split("•")[1]?.trim() ?? r.route_key,
      program: programName(r.protocol),
      programId: programIdForProtocol(r.protocol),
      sandwichPct: Math.round((r.sandwich_count / Math.max(1, r.total_attacks)) * 100),
      stalePct: Math.round(r.stale_quote_pickup_rate),
      bpsAtRisk: r.markout_30s_bps, loss: r.total_extracted_usd,
      attackers: r.unique_attackers, conf: Math.round(r.avg_confidence * 100),
      action: r.policy_action,
    }));
    return fromRoutes;
  }, [data]);

  const totalLoss = live.reduce((s, r) => s + r.loss, 0);
  const avgBps = live.length > 0 ? live.reduce((s, r) => s + r.bpsAtRisk, 0) / live.length : null;
  const topAttackers = useMemo(() => {
    if (!hasRaydiumData(data)) return [];
    const byWallet = new Map<string, { wallet: string; attacks: number; extracted: number; types: Set<string> }>();
    for (const attack of data.attacks.filter(isRaydiumAttack)) {
      const current = byWallet.get(attack.attacker_wallet) ?? {
        wallet: attack.attacker_wallet,
        attacks: 0,
        extracted: 0,
        types: new Set<string>(),
      };
      current.attacks += 1;
      current.extracted += (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0);
      current.types.add(attack.attack_type);
      byWallet.set(attack.attacker_wallet, current);
    }
    return [...byWallet.values()]
      .sort((a, b) => b.extracted - a.extracted || b.attacks - a.attacks)
      .slice(0, 5);
  }, [data]);

  return (
    <>
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Pools Monitored", `${live.length}`, "CPMM + AMM v4"],
          ["Observed Loss", fmt(totalLoss), sourceRowsText(data)],
          ["Avg Bps at Risk", avgBps == null ? "--" : `${avgBps.toFixed(1)} bps`, "per swap"],
          ["Active Operators", `${live.reduce((s, r) => s + r.attackers, 0)}`, "unique wallets"],
        ].map(([label, value, sub]) => (
          <div key={label} className="border border-border bg-card p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Sandwich Rate by Pool</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Which pools are most targeted</h2>
        </div>
        <div className="h-48 p-4">
          {live.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={live.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={TICK_STYLE} axisLine={false} tickLine={false} domain={[0, 100]} />
                <YAxis type="category" dataKey="pair" width={80} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Sandwich rate"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="sandwichPct" fill="hsl(0 85% 62%)" fillOpacity={0.8} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Raydium sandwich pool rows are available from the live API yet." />}
        </div>
      </div>

      {/* Full table */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All Monitored Pools</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">{live.length} surfaces ranked by extraction risk</h2>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{sourceDetail(data)}</span>
        </div>
        {live.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-border/50">
              <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Pair / Route</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Sandwich%</th>
                <th className="px-4 py-3 font-medium">Stale Quote</th>
                <th className="px-4 py-3 font-medium">Bps Risk</th>
                <th className="px-4 py-3 font-medium">Est. Daily Loss</th>
                <th className="px-4 py-3 font-medium">Operators</th>
                <th className="px-4 py-3 font-medium">Policy</th>
              </tr>
            </thead>
            <tbody>
              {live.map((row) => (
                <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-semibold text-foreground">{row.pair}</div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[160px]">{row.routeKey}</span>
                      <CopyButton text={row.routeKey} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-[10px] text-primary">{row.program}</div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <ExtLink href={solscan(row.programId)} label={truncateAddress(row.programId, 5, 4)} />
                      <CopyButton text={row.programId} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-red-300">{row.sandwichPct}%</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.stalePct}%</td>
                  <td className="px-4 py-3 font-mono text-xs text-yellow-200">{bps(row.bpsAtRisk)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-red-300">{fmt(row.loss)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.attackers}</td>
                  <td className="px-4 py-3">
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase ${actionTone(row.action)}`}>{row.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyPanel message="No Raydium pool risk rows yet. This stays empty until the API returns chain-classified Raydium surfaces." />}
      </div>

      {/* Top attackers */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Top Operators</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Wallets responsible for Raydium extraction</h2>
        </div>
        <div className="divide-y divide-border/40">
          {topAttackers.length > 0 ? topAttackers.map((a, i) => (
            <div key={a.wallet} className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border font-mono text-xs text-muted-foreground">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ExtLink href={solscan(a.wallet)} label={truncateAddress(a.wallet, 8, 5)} />
                  <CopyButton text={a.wallet} />
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{[...a.types].join(", ")}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs font-semibold text-red-300">{fmt(a.extracted)}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{a.attacks} attacks</div>
              </div>
            </div>
          )) : <EmptyPanel message="No Raydium attacker wallets are present in the current live detection window." />}
        </div>
      </div>
    </>
  );
}

// ─── Section: JIT ────────────────────────────────────────────────────────────

function SectionJit({ data }: { data: RaydiumData | null }) {
  const live = useMemo(() => {
    if (!hasRaydiumData(data)) return [];
    return data.routes.filter(isRaydiumRoute).filter((r) => r.jit_count > 0 || /clmm/i.test(r.protocol ?? "")).map((r) => ({
      id: r.route_key,
      pool: r.label?.split("•")[1]?.trim() ?? r.route_key,
      feeTier: "--",
      tickBand: bps(r.markout_30s_bps),
      windows: r.jit_count,
      dilutionBps: r.markout_5s_bps,
      lpDrag: r.lp_annual_loss_usd_estimate,
      attacker: `${r.unique_attackers} operators`,
      action: r.policy_action,
    }));
  }, [data]);

  const clmmId = RAYDIUM_PROGRAMS.CLMM;

  return (
    <>
      {/* Stats bar */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">CLMM Program</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-foreground">{truncateAddress(clmmId, 8, 6)}</span>
            <CopyButton text={clmmId} />
          </div>
          <div className="mt-1.5"><ExtLink href={solscan(clmmId)} label="View on Solscan" /></div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">JIT Windows</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{live.reduce((s, r) => s + r.windows, 0)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">live feed</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total LP Drag</div>
          <div className="mt-2 text-2xl font-bold text-red-300">{fmt(live.reduce((s, r) => s + r.lpDrag, 0))}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">fee dilution + adverse selection</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Fee Config</div>
          <div className="mt-2 text-2xl font-bold text-primary">AmmConfig</div>
          <div className="mt-0.5 text-xs text-muted-foreground">read live fee tiers before quoting</div>
        </div>
      </div>

      {/* LP drag chart */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Fee Dilution by Pool</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">LP drag from JIT windows</h2>
        </div>
        <div className="h-44 p-4">
          {live.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={live} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="pool" width={80} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [fmt(v), "LP Drag"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="lpDrag" fill="hsl(var(--primary))" fillOpacity={0.8} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Raydium CLMM JIT rows are available from the live API yet." />}
        </div>
      </div>

      {/* Full table */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All JIT Windows</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">{live.length} CLMM pools with JIT activity</h2>
        </div>
        <div className="divide-y divide-border/40">
          {live.length === 0 && <EmptyPanel message="No JIT activity is present in the current Raydium API window." />}
          {live.map((row) => (
            <div key={row.id} className="grid gap-4 px-4 py-4 md:grid-cols-[1.5fr_1fr_1fr_0.5fr]">
              <div>
                <div className="font-mono text-sm font-semibold text-foreground">{row.pool}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">Fee tier: {row.feeTier} · Tick: {row.tickBand}</div>
                <div className="mt-1"><ExtLink href={solscan(clmmId)} label="CLMM program" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-border/50 p-2">
                  <div className="font-mono text-[9px] text-muted-foreground">JIT Windows</div>
                  <div className="mt-1 font-mono text-sm text-primary">{row.windows}</div>
                </div>
                <div className="border border-border/50 p-2">
                  <div className="font-mono text-[9px] text-muted-foreground">Fee Dilution</div>
                  <div className="mt-1 font-mono text-sm text-yellow-200">{bps(row.dilutionBps)}</div>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-muted-foreground">LP Drag</div>
                <div className="mt-1 font-mono text-lg font-bold text-red-300">{fmt(row.lpDrag)}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.attacker}</div>
              </div>
              <div className="flex items-center">
                <span className={`border px-2 py-1 font-mono text-[9px] uppercase ${actionTone(row.action)}`}>{row.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Section: LaunchLab ──────────────────────────────────────────────────────

function SectionLaunchLab({ data }: { data: RaydiumData | null }) {
  const live = useMemo(() => {
    if (!hasRaydiumData(data)) return [];
    return data.attacks.filter(isRaydiumAttack).filter((a) => a.attack_type === "liquidity_snipe").map((a) => ({
      id: a.frontrun_tx ?? a.pool_address,
      token: a.token_mint ? truncateAddress(a.token_mint, 8, 5) : "Unknown",
      tokenFull: a.token_mint ?? null,
      firstBuy: a.evidence?.some((e: string) => /same slot/i.test(e)) ? "same slot" : a.evidence?.some((e) => /\+1 slot/.test(e)) ? "+1 slot" : "--",
      tipLamports: a.tip_lamports ?? 0,
      hasBundle: hasBundleSignal(a),
      sniper: truncateAddress(a.attacker_wallet, 8, 5),
      sniperFull: a.attacker_wallet,
      entityLabel: a.entity_label,
      extracted: a.profit_usd ?? a.victim_loss_usd ?? 0,
    }));
  }, [data]);

  const launchlabId = RAYDIUM_PROGRAMS.LAUNCHLAB;
  const totalExtracted = live.reduce((s, r) => s + r.extracted, 0);
  const bundleCount = live.filter((r) => r.hasBundle).length;

  return (
    <>
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">LaunchLab Program</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-foreground">{truncateAddress(launchlabId, 8, 6)}</span>
            <CopyButton text={launchlabId} />
          </div>
          <div className="mt-1.5"><ExtLink href={solscan(launchlabId)} label="View on Solscan" /></div>
        </div>
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Snipes Detected</div>
          <div className="mt-2 text-2xl font-bold text-yellow-200">{live.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{bundleCount} with bundle signal</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total Extracted</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{fmt(totalExtracted)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">from launch curves</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Graduation Rule</div>
          <div className="mt-2 text-2xl font-bold text-foreground">Quote target</div>
          <div className="mt-0.5 text-xs text-muted-foreground">read from LaunchState</div>
        </div>
      </div>

      {/* Live snipes table */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Detected Snipes</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">LaunchLab launches with first-slot buy activity</h2>
        </div>
        <div className="divide-y divide-border/40">
          {live.length === 0 && <EmptyPanel message="No Raydium LaunchLab sniper detections in the current API window." />}
          {live.map((row) => (
            <div key={row.id} className="grid gap-4 px-4 py-4 md:grid-cols-[1.5fr_1fr_1fr]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{row.token}</span>
                  {row.hasBundle && <span className="border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-orange-300">Bundle signal</span>}
                  {row.entityLabel && <span className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] uppercase text-primary">{row.entityLabel}</span>}
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  First buy: <span className="text-foreground">{row.firstBuy}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {row.sniperFull
                    ? <ExtLink href={solscan(row.sniperFull)} label={row.sniper} />
                    : <span className="font-mono text-[10px] text-muted-foreground">{row.sniper}</span>}
                  {row.sniperFull && <CopyButton text={row.sniperFull} />}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-muted-foreground">Extracted</div>
                <div className="mt-1 font-mono text-lg font-bold text-yellow-200">{fmt(row.extracted)}</div>
                <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{fmtLamports(row.tipLamports)} tip</div>
              </div>
              <div>
                {row.tokenFull && (
                  <div className="flex items-center gap-1.5">
                    <ExtLink href={solscan(row.tokenFull)} label="View token" />
                    <CopyButton text={row.tokenFull} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Section: LP ─────────────────────────────────────────────────────────────

function SectionLP({ data }: { data: RaydiumData | null }) {
  const live = useMemo(() => {
    if (!hasRaydiumData(data)) return [];
    const from = data.lp.filter(isRaydiumPool).map((p) => ({
      id: p.pool_address, pool: p.pool_address,
      score: Math.round(p.toxicity_score), lvr: Math.round(p.lvr_proxy_score ?? 0),
      adv: Math.round(p.adverse_selection_intensity ?? 0), drag: p.lp_drag_estimate_usd ?? 0,
      saved: p.saved_fee_bps_if_segmented ?? 0, cause: p.primary_cause ?? "toxic flow",
    }));
    return from;
  }, [data]);

  const scoreData = [
    { range: "80-100", count: live.filter((r) => r.score >= 80).length, color: "hsl(0 85% 62%)" },
    { range: "60-79",  count: live.filter((r) => r.score >= 60 && r.score < 80).length, color: "hsl(48 96% 53%)" },
    { range: "0-59",   count: live.filter((r) => r.score < 60).length, color: "hsl(var(--primary))" },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="col-span-2 border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total LP Drag</div>
          <div className="mt-2 text-3xl font-bold text-red-300">{fmt(live.reduce((s, r) => s + r.drag, 0))}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">adverse selection + JIT fee dilution</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Pools Monitored</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{live.length}</div>
        </div>
        <div className="border border-red-500/30 bg-red-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">High Risk Pools</div>
          <div className="mt-2 text-2xl font-bold text-red-300">{live.filter((r) => r.score >= 80).length}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Fee Saved / Pool</div>
          <div className="mt-2 text-2xl font-bold text-primary">{live.length > 0 ? bps(live.reduce((s, r) => s + r.saved, 0) / live.length) : "--"}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Data Source</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{sourceLabel(data)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{isDemoData(data) ? "local demo rows" : "live API rows only"}</div>
        </div>
      </div>

      {/* Score distribution */}
      <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Risk Distribution</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Score breakdown</h2>
          </div>
          <div className="h-44 p-4">
            {live.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={scoreData} dataKey="count" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                    {scoreData.map((d) => <Cell key={d.range} fill={d.color} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} pools`, ""]} contentStyle={TOOLTIP_STYLE} />
                  <Legend formatter={(value) => <span className="font-mono text-[10px] text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyPanel message="No LP protection score distribution is available from live Raydium rows yet." />}
          </div>
          <div className="border-t border-border/50 p-3 space-y-1.5">
            {scoreData.map((d) => (
              <div key={d.range} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="font-mono text-[10px] text-muted-foreground">Score {d.range}</span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-foreground">{d.count} pools</span>
              </div>
            ))}
          </div>
        </div>

        {/* Full table */}
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All LP Protection Scores</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Ranked by extraction risk</h2>
          </div>
          <div className="divide-y divide-border/40">
            {live.length === 0 && <EmptyPanel message="No Raydium LP protection rows are present in the current API window." />}
            {live.map((row) => (
              <div key={row.id} className="flex items-center gap-4 px-4 py-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center border font-mono text-sm font-bold ${row.score >= 80 ? "border-red-500/40 text-red-300" : row.score >= 60 ? "border-yellow-500/40 text-yellow-200" : "border-green-500/40 text-green-300"}`}>
                  {row.score}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{row.pool}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{row.cause} · LVR {row.lvr} · Adverse sel. {row.adv}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs font-semibold text-red-300">{fmt(row.drag)}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">{bps(row.saved)} saved</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Section: Detections ─────────────────────────────────────────────────────

type DetectionFilter =
  | "all" | "sandwich" | "backrun" | "arbitrage"
  | "jit" | "liquidation" | "liquidity_snipe" | "liquidity_drain";

const FILTER_LABELS: Record<DetectionFilter, string> = {
  all:              "All",
  sandwich:         "Sandwich",
  backrun:          "Backrun",
  arbitrage:        "Arbitrage",
  jit:              "JIT",
  liquidation:      "Liquidation",
  liquidity_snipe:  "Snipe",
  liquidity_drain:  "Drain",
};

const DETECTION_FILTERS = Object.keys(FILTER_LABELS) as DetectionFilter[];

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

function profitLabel(attack: Attack) {
  if (attack.attack_type === "liquidation") return "Liquidator Gain";
  if (attack.attack_type === "jit") return "LP Capture";
  if (attack.attack_type === "liquidity_drain") return "Removed Value";
  if (attack.attack_type === "liquidity_snipe") return "First Fill";
  return "Searcher PnL";
}

function harmLabel(attack: Attack) {
  if (attack.attack_type === "liquidation") return "Borrower Loss";
  if (attack.attack_type === "jit") return "User Impact";
  if (attack.attack_type === "liquidity_drain") return "Holder Risk";
  if (attack.attack_type === "liquidity_snipe") return "Launch Risk";
  return "User Harm";
}

function detectionSummary(attack: Attack) {
  if (attack.attack_type === "jit") return "Short-lived concentrated liquidity entered around a target swap, then exited after the flow cleared.";
  if (attack.attack_type === "liquidity_snipe") return "LaunchLab buy activity appeared near the launch window before broader organic demand caught up.";
  if (attack.attack_type === "liquidity_drain") return "Liquidity removal and follow-through trading created a drain-like risk profile.";
  if (attack.attack_type === "sandwich") return "Victim execution was bracketed by hostile Raydium route activity.";
  if (attack.attack_type === "backrun") return "Post-victim execution harvested downstream repricing on a Raydium surface.";
  if (attack.attack_type === "liquidation") return "Liquidation-like flow crossed Raydium liquidity and created adverse selection risk.";
  return "Cross-surface Raydium activity matched an extraction pattern in the feed.";
}

function raydiumMechanic(attack: Attack) {
  if (attack.attack_type === "jit") return "CLMM positions earn fees only while their tick range is active, so short-lived liquidity can capture flow without carrying normal LP inventory risk.";
  if (attack.attack_type === "liquidity_snipe") return "LaunchLab launches trade on a bonding curve until the launch reaches its configured quote target and graduates into a post-launch pool.";
  if (programName(attack.protocol) === "CLMM") return "CLMM swaps move through ticks and position liquidity ranges, so adverse selection often appears as markout after the active range is crossed.";
  if (programName(attack.protocol) === "CPMM") return "CPMM is Raydium's modern constant-product pool; route risk comes from price impact, stale quotes, and toxic flow concentration.";
  return "Raydium AMM v4 and CPMM pools follow constant-product pricing; sandwiches and backruns capture value from the price movement around user flow.";
}

function SectionDetections({ data }: { data: RaydiumData | null }) {
  const [filter, setFilter] = useState<DetectionFilter>("all");
  const [selectedAttackId, setSelectedAttackId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, AttackDetail>>({});
  const [detailErrorById, setDetailErrorById] = useState<Record<number, string>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);

  const liveAttacks = useMemo<Attack[]>(() => {
    if (!hasRaydiumData(data)) return [];
    return dedupeAttacks(data.attacks.filter(isRaydiumAttack))
      .sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime());
  }, [data]);

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
    const c: Record<DetectionFilter, number> = {
      all: liveAttacks.length,
      sandwich: 0, backrun: 0, arbitrage: 0,
      jit: 0, liquidation: 0, liquidity_snipe: 0, liquidity_drain: 0,
    };
    for (const a of liveAttacks) {
      if (a.attack_type in c) c[a.attack_type as DetectionFilter] += 1;
    }
    return c;
  }, [liveAttacks]);

  const filtered = useMemo(() =>
    filter === "all" ? liveAttacks : liveAttacks.filter((a) => a.attack_type === filter),
  [filter, liveAttacks]);

  const totalProfit = liveAttacks.reduce((sum, a) => sum + (a.profit_usd ?? 0), 0);
  const totalVictimLoss = liveAttacks.reduce((sum, a) => sum + (a.victim_loss_usd ?? 0), 0);
  const bundleSignals = liveAttacks.filter(hasBundleSignal).length;

  return (
    <>
      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total Detections</div>
          <div className="mt-2 text-3xl font-bold text-foreground">{liveAttacks.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">live feed</div>
        </div>
        <div className="border border-red-500/30 bg-red-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Searcher Profit</div>
          <div className="mt-2 text-3xl font-bold text-red-300">{fmt(totalProfit)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">net gain by attackers</div>
        </div>
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Victim Loss</div>
          <div className="mt-2 text-3xl font-bold text-yellow-200">{fmt(totalVictimLoss)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">harm to users</div>
        </div>
        <div className="border border-primary/30 bg-primary/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Bundle Signals</div>
          <div className="mt-2 text-2xl font-bold text-primary">{bundleSignals}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">from lane or likelihood fields</div>
        </div>
      </div>

      {/* Filter tabs — all 8 attack types */}
      <div className="flex flex-wrap gap-2">
        {DETECTION_FILTERS.map((f) => {
          const n = counts[f];
          return (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`min-h-10 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
              <span className={filter !== f && n > 0 ? typeTextClass(f) : ""}>{FILTER_LABELS[f]}</span>
              {f !== "all" && <span className="ml-1 opacity-60">({n})</span>}
            </button>
          );
        })}
      </div>

      {/* Detection cards */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-2.5 flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Live Raydium MEV Detections</p>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{sourceDetail(data)}</span>
        </div>
        {filtered.length > 0 ? (
          <div className="space-y-2 p-3">
            {filtered.map((attack) => (
              <RaydiumDetectionCard
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
          <EmptyPanel message={hasRaydiumData(data) ? `No ${filter === "all" ? "Raydium" : filter} detections in the current window.` : "Waiting for live chain data. Detections appear here once the feed connects."} />
        )}
      </div>
    </>
  );
}

function RaydiumDetectionCard({
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
  const meta = attackMeta(attack.attack_type);
  const bundleSignal = hasBundleSignal(attack);
  const confidenceSignals = attack.attack_type === "sandwich"
    ? sandwichConfidenceSignals(attack)
    : attack.attack_type === "jit"
      ? jitConfidenceSignals(attack)
      : null;
  const confPct = Math.round((attack.confidence ?? 0) * 100);
  const detailId = `raydium-detection-${attack.id}`;

  return (
    <article className={`border p-3 transition-colors ${meta.bgColor}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 font-mono text-xs font-bold uppercase ${meta.bgColor} ${meta.color}`}>
              {meta.shortLabel}
            </span>
            {bundleSignal && <span className="border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-orange-300">Bundle signal</span>}
            {attack.entity_label && <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase text-primary">{attack.entity_label}</span>}
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {programName(attack.protocol)} · {attack.surface_precision ?? "inferred"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">ATTACKER </span>
              <ExtLink href={solscan(attack.attacker_wallet)} label={truncateAddress(attack.attacker_wallet, 6, 4)} />
              <CopyButton text={attack.attacker_wallet} />
            </div>
            {attack.victim_wallet && (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-muted-foreground">VICTIM </span>
                <ExtLink href={solscan(attack.victim_wallet)} label={truncateAddress(attack.victim_wallet, 6, 4)} />
                <CopyButton text={attack.victim_wallet} />
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {attack.surface_label ?? formatPoolLabel(attack.pool_address)}
            </h3>
            <CopyButton text={attack.pool_address} />
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detectionSummary(attack)}</p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 text-right sm:grid-cols-5 lg:min-w-[620px]">
          <Metric label="Model" value={attack.detector ?? "unknown"} />
          <Metric label="Confidence" value={`${confidenceLabel(attack.confidence)} · ${confPct}%`} tone={meta.color} />
          <Metric label={profitLabel(attack)} value={fmt(attack.profit_usd)} tone={meta.color} />
          <Metric label={harmLabel(attack)} value={fmt(attack.victim_loss_usd)} tone="text-yellow-200" />
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
          {evidence.slice(0, 3).map((item) => (
            <span key={item} className="border border-border/80 px-2 py-1">{item}</span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        {attack.frontrun_tx && <ExtLink href={solscan(attack.frontrun_tx, "tx")} label={TX_LABELS[attack.attack_type]?.frontrun ?? "Frontrun tx"} />}
        {attack.victim_tx && <ExtLink href={solscan(attack.victim_tx, "tx")} label={TX_LABELS[attack.attack_type]?.victim ?? "Victim tx"} />}
        {attack.backrun_tx && <ExtLink href={solscan(attack.backrun_tx, "tx")} label={TX_LABELS[attack.attack_type]?.backrun ?? "Backrun tx"} />}
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
                <span className={`font-mono text-sm font-bold ${confPct >= 85 ? "text-red-300" : confPct >= 65 ? "text-yellow-200" : "text-muted-foreground"}`}>{confPct}%</span>
              </div>
              <div className="h-1.5 border border-border/50 bg-background/60">
                <div
                  className={`h-full transition-[width] ${confPct >= 85 ? "bg-red-400" : confPct >= 65 ? "bg-yellow-400" : "bg-primary"}`}
                  style={{ width: `${confPct}%` }}
                />
              </div>
              {confidenceSignals ? (
                <div className="mt-3 space-y-1.5">
                  {confidenceSignals.map((sig) => (
                    <div key={sig.label} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sig.present ? "bg-green-400" : "bg-border"}`} />
                      <span className={`font-mono text-[10px] ${sig.present ? "text-foreground" : "text-muted-foreground/60"}`}>{sig.label}</span>
                      {sig.present && <span className="ml-auto font-mono text-[9px] text-green-400">+{Math.round(sig.weight * 100)}%</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">This detector does not expose a specialized Raydium confidence checklist yet.</p>
              )}
            </div>

            <div className="border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Evidence trail</span>
                {loading && <span className="font-mono text-[9px] text-primary animate-pulse">Loading...</span>}
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
                <DetailLine label="Program" value={programName(attack.protocol)} />
                <DetailLine label="Block time" value={new Date(attack.block_time).toLocaleString()} />
                <DetailLine label="Validator" value={truncateAddress(attack.validator, 10, 6)} href={solscan(attack.validator)} copy={attack.validator} />
                {attack.token_mint && <DetailLine label="Token mint" value={truncateAddress(attack.token_mint, 10, 6)} href={solscan(attack.token_mint)} copy={attack.token_mint} />}
                <DetailLine label="Surface precision" value={attack.surface_precision ?? "inferred"} />
              </div>
            </div>

            <div className="border border-primary/25 bg-primary/5 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">Raydium mechanics</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{raydiumMechanic(attack)}</p>
            </div>
          </div>
        </div>
      )}
    </article>
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
        {href ? <ExtLink href={href} label={value} /> : <span className="break-all font-mono text-[11px] text-foreground">{value}</span>}
        {copy && <CopyButton text={copy} />}
      </div>
    </div>
  );
}

// ─── Section: Savings ────────────────────────────────────────────────────────

function SectionSavings({ data }: { data: RaydiumData | null }) {
  const chartData = useMemo(() => {
    if (!hasRaydiumData(data)) return [];
    const from = data.routes.filter(isRaydiumRoute).filter((r) => r.estimated_savings_usd > 0).map((r) => ({
      name: r.label?.split("•")[1]?.trim() ?? r.route_key,
      routeKey: r.route_key,
      savings: Math.round(r.estimated_savings_usd),
      program: programName(r.protocol),
      programId: programIdForProtocol(r.protocol),
    })).sort((a, b) => b.savings - a.savings);
    return from;
  }, [data]);

  const totalSavings = chartData.reduce((s, r) => s + r.savings, 0);
  const byProgram = chartData.reduce((acc, r) => { acc[r.program] = (acc[r.program] ?? 0) + r.savings; return acc; }, {} as Record<string, number>);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="col-span-2 border border-primary/40 bg-primary/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Observed Savings Potential</div>
          <div className="mt-2 text-5xl font-bold text-primary">{fmt(totalSavings)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{sourceRowsText(data)}</div>
        </div>
        {Object.entries(byProgram).slice(0, 3).map(([program, savings]) => (
          <div key={program} className="border border-border bg-card p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{program}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{fmt(savings)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">savings potential</div>
          </div>
        ))}
      </div>

      {/* Big bar chart */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Savings by Pool</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Estimated savings from {isDemoData(data) ? "local demo" : "live route"} rows</h2>
        </div>
        <div className="h-64 p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tickFormatter={(v) => fmtAxis(v)} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ ...TICK_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [fmt(v), "Savings"]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "hsl(var(--foreground))" }} />
                <Bar dataKey="savings" radius={[0, 2, 2, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.program === "CLMM" ? "hsl(var(--primary))" : entry.program === "LaunchLab" ? "hsl(48 96% 53%)" : "hsl(0 85% 62%)"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Raydium savings rows are available from the live API yet." />}
        </div>
        <div className="flex gap-5 border-t border-border/50 px-4 py-2.5">
          {[["CPMM/AMM v4", "hsl(0 85% 62%)"], ["CLMM", "hsl(var(--primary))"], ["LaunchLab", "hsl(48 96% 53%)"]].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Route table with copyable identifiers */}
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
                  <th className="px-4 py-2.5 font-medium">Pair</th>
                  <th className="px-4 py-2.5 font-medium">Program</th>
                  <th className="px-4 py-2.5 font-medium">Route Key</th>
                  <th className="px-4 py-2.5 font-medium text-right">Savings</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.routeKey} className="border-b border-border/30 last:border-0 hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{row.name}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[10px] text-primary">{row.program}</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <ExtLink href={solscan(row.programId)} label={truncateAddress(row.programId, 5, 4)} />
                        <CopyButton text={row.programId} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground max-w-[220px] truncate">{row.routeKey}</span>
                        <CopyButton text={row.routeKey} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary text-right">{fmt(row.savings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* What this means */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "Routes", value: `${chartData.length}`, desc: "Raydium routes with savings estimates returned by the API", color: "border-red-500/30 bg-red-500/5" },
          { title: "For LPs", value: fmt(live_lp_drag(data)), desc: "LP drag currently returned by live LP protection rows", color: "border-primary/30 bg-primary/5" },
          { title: "Data Source", value: sourceLabel(data), desc: isDemoData(data) ? "local demo scenario for offline UI work" : "live Raydium rows returned by the API", color: "border-yellow-500/30 bg-yellow-500/5" },
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
function live_lp_drag(data: RaydiumData | null): number {
  if (!hasRaydiumData(data)) return 0;
  const total = data.lp.filter(isRaydiumPool).reduce((s, p) => s + (p.lp_drag_estimate_usd ?? 0), 0);
  return total;
}

// ─── Section: Extraction ─────────────────────────────────────────────────────

const EXTRACTION_TYPES = [
  { key: "sandwich",        label: "Sandwich",  color: "hsl(0 85% 62%)"       },
  { key: "jit",             label: "JIT",       color: "hsl(var(--primary))"  },
  { key: "backrun",         label: "Backrun",   color: "hsl(24 95% 58%)"      },
  { key: "arbitrage",       label: "Arb",       color: "hsl(210 80% 60%)"     },
  { key: "liquidity_snipe", label: "Snipe",     color: "hsl(48 96% 53%)"      },
  { key: "liquidity_drain", label: "Drain",     color: "hsl(280 70% 60%)"     },
] as const;

type ExtractionKey = typeof EXTRACTION_TYPES[number]["key"];

type TrendRow = { ts: number; day: string } & Record<ExtractionKey, number>;

function rowTotal(row: TrendRow) {
  return EXTRACTION_TYPES.reduce((s, { key }) => s + row[key], 0);
}

function SectionExtraction({ data }: { data: RaydiumData | null }) {
  const liveAttacks = useMemo(() => hasRaydiumData(data) ? data.attacks.filter(isRaydiumAttack) : [], [data]);
  const trendData = useMemo(() => liveAttacks
    .map((attack): TrendRow => {
      const value = (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0);
      const ts = new Date(attack.block_time).getTime();
      const t = attack.attack_type as ExtractionKey;
      return {
        ts,
        day: Number.isFinite(ts) ? new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--",
        sandwich:        t === "sandwich"        ? value : 0,
        jit:             t === "jit"             ? value : 0,
        backrun:         t === "backrun"         ? value : 0,
        arbitrage:       t === "arbitrage"       ? value : 0,
        liquidity_snipe: t === "liquidity_snipe" ? value : 0,
        liquidity_drain: t === "liquidity_drain" ? value : 0,
      };
    })
    .filter((row) => Number.isFinite(row.ts) && rowTotal(row) > 0)
    .sort((a, b) => a.ts - b.ts), [liveAttacks]);

  const observedTotal = trendData.reduce((sum, row) => sum + rowTotal(row), 0);
  const peakBucket = trendData.length > 0
    ? trendData.reduce((max, row) => rowTotal(row) > rowTotal(max) ? row : max, trendData[0])
    : null;
  const byProgram = useMemo(() => {
    const totals = new Map<string, number>();
    for (const attack of liveAttacks) {
      const program = programName(attack.protocol);
      totals.set(program, (totals.get(program) ?? 0) + (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0));
    }
    const fills = ["hsl(0 85% 62%)", "hsl(var(--primary))", "hsl(48 96% 53%)", "hsl(150 70% 45%)"];
    return [...totals.entries()]
      .map(([name, value], index) => ({ name, value, fill: fills[index % fills.length] }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [liveAttacks]);
  const byProgramTotal = byProgram.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="col-span-2 border border-red-500/40 bg-red-500/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Observed Raydium extraction</div>
          <div className="mt-2 text-5xl font-bold text-red-300">{fmt(observedTotal)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isDemoData(data) ? "from local demo detections" : "from current live detections"}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Peak Observation</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{peakBucket?.day ?? "--"}</div>
          <div className="mt-0.5 font-mono text-xs text-red-300">{peakBucket ? fmt(rowTotal(peakBucket)) : "--"}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Detections</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{liveAttacks.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{isDemoData(data) ? "local demo window" : "current API window"}</div>
        </div>
      </div>

      {/* Full area chart */}
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
                <YAxis tickFormatter={(v) => fmtAxis(v)} tick={TICK_STYLE} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: number, name: string) => [fmt(v), EXTRACTION_TYPES.find(t => t.key === name)?.label ?? name]} contentStyle={TOOLTIP_STYLE} />
                {EXTRACTION_TYPES.map(({ key, color }) => (
                  <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Raydium extraction timeline is available yet. The graph only renders live API detections." />}
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

      {/* By program + bucket table */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">By Program</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Extraction breakdown by Raydium surface</h2>
          </div>
          <div className="h-64 p-4">
            {byProgram.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byProgram} dataKey="value" cx="50%" cy="50%" outerRadius={90} strokeWidth={0}>
                    {byProgram.map((d) => <Cell key={d.name} fill={d.fill} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [fmt(v), ""]} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyPanel message="No Raydium program breakdown is available from live detections yet." />}
          </div>
          <div className="border-t border-border/50 p-3 space-y-2">
            {byProgram.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                <span className="font-mono text-[10px] text-muted-foreground flex-1">{d.name}</span>
                <span className="font-mono text-[10px] font-semibold text-foreground">{fmt(d.value)}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{byProgramTotal > 0 ? Math.round(d.value / byProgramTotal * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bucket table */}
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Bucket Breakdown</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Extraction per type per slot window</h2>
          </div>
          {trendData.length > 0 ? <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border/50">
                <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium text-left">Time</th>
                  {EXTRACTION_TYPES.map(({ key, label, color }) => (
                    <th key={key} className="px-3 py-2.5 font-medium text-right" style={{ color }}>{label}</th>
                  ))}
                  <th className="px-3 py-2.5 font-medium text-right text-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((row) => {
                  const total = rowTotal(row);
                  const isPeak = peakBucket != null && row.day === peakBucket.day;
                  return (
                    <tr key={`${row.ts}-${row.day}`} className={`border-b border-border/30 last:border-0 ${isPeak ? "bg-red-500/5" : "hover:bg-primary/5"} transition-colors`}>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.day}{isPeak && <span className="ml-1 font-mono text-[9px] text-red-300">peak</span>}
                      </td>
                      {EXTRACTION_TYPES.map(({ key }) => (
                        <td key={key} className="px-3 py-2 font-mono text-xs text-right text-muted-foreground">
                          {row[key] > 0 ? fmt(row[key]) : "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 font-mono text-xs text-right font-semibold text-foreground">{fmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div> : <EmptyPanel message="No extraction rows are present in the current live detection window." />}
        </div>
      </div>
    </>
  );
}

// ─── Root export ─────────────────────────────────────────────────────────────

export default function RaydiumDeepDive({ section }: { section: RaydiumSection }) {
  const { data, loading, refreshing, error, reload } = useRaydiumData();

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-background px-4 py-5 text-foreground">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground animate-pulse">
            Loading Raydium intelligence...
          </div>
        </div>
      </main>
    );
  }

  return (
    <PageShell section={section} refreshing={refreshing} onRefresh={reload}>
      {error && (
        <div className="border border-red-500/35 bg-red-500/10 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-300">Raydium API request failed</div>
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
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-200">Local Raydium demo scenario</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Backend chain rows are unavailable or empty, so this page is showing a seeded Raydium protection scenario for local testing.
            Live API rows replace it automatically once Raydium surfaces arrive.
          </p>
        </div>
      )}
      {section === "pools"      && <SectionPools data={data} />}
      {section === "jit"        && <SectionJit data={data} />}
      {section === "launchlab"  && <SectionLaunchLab data={data} />}
      {section === "lp"         && <SectionLP data={data} />}
      {section === "detections" && <SectionDetections data={data} />}
      {section === "savings"    && <SectionSavings data={data} />}
      {section === "extraction" && <SectionExtraction data={data} />}
    </PageShell>
  );
}
