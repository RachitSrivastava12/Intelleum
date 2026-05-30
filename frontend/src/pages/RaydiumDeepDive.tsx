import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  api, Attack, AttackDetail, LpProtectionSnapshot, PoolToxicity, RouteRisk, SystemStatus,
} from "@/lib/api";
import { formatPoolLabel, formatRelativeTime, truncateAddress } from "@/lib/utils";

export type RaydiumSection =
  | "pools" | "jit" | "launchlab" | "lp"
  | "detections" | "savings" | "extraction";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return "--";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function bps(n: number | null | undefined) {
  if (n == null) return "--";
  return `${n.toFixed(1)} bps`;
}
function solscan(address: string, type: "account" | "tx" = "account") {
  return `https://solscan.io/${type}/${address}`;
}
function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10px] text-primary underline decoration-primary/30 hover:decoration-primary transition-all">
      {label}
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0">
        <path d="M1.5 7.5L7.5 1.5M7.5 1.5H3.5M7.5 1.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </a>
  );
}
function isRaydium(v?: string | null) { return !!v && /raydium/i.test(v); }
function isRaydiumRoute(r: RouteRisk) { return isRaydium(r.protocol) || isRaydium(r.route_key) || isRaydium(r.label); }
function isRaydiumAttack(a: Attack) { return isRaydium(a.protocol) || isRaydium(a.pool_address) || isRaydium((a as any).surface_label); }
function isRaydiumPool(p: PoolToxicity | LpProtectionSnapshot) { return isRaydium(p.protocol) || isRaydium(p.pool_address); }
function isLiveData(data: RaydiumData | null) { return data?.status?.mode === "chain"; }
function programName(protocol?: string | null) {
  const raw = protocol ?? "";
  if (raw.includes("cpmm")) return "CPMM";
  if (raw.includes("clmm")) return "CLMM";
  if (raw.includes("v4") || raw.includes("amm")) return "AMM v4";
  if (raw.includes("launch")) return "LaunchLab";
  return "Raydium";
}
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
            <Link to="/" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">Home</Link>
            <Link to="/dex-intelligence" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">DEX Intelligence</Link>
            <Link to="/dex-intelligence/raydium" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">Raydium</Link>
            <span className="border border-primary/40 bg-primary/5 px-3 py-2 text-primary">{title}</span>
          </div>
          <button type="button" onClick={onRefresh} disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-2 border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        {/* Title */}
        <div className="flex items-center gap-4">
          <RaydiumLogo size={36} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">// {eyebrow}</p>
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
};

function useRaydiumData() {
  const [data, setData] = useState<RaydiumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [status, routes, attacks, pools, lp] = await Promise.all([
        api.systemStatus(),
        api.routeRisks(120),
        api.attacks({ limit: "200" }),
        api.pools(120),
        api.lpProtection(120),
      ]);
      setData({ status, routes, attacks, pools, lp });
    } catch { /* silently ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  return { data, loading, refreshing, reload: () => void load(true) };
}

function typeTextClass(t: string) {
  if (t === "sandwich") return "text-red-300";
  if (t === "jit")      return "text-primary";
  return "text-yellow-200";
}

// ─── Section: Pools ──────────────────────────────────────────────────────────

function SectionPools({ data }: { data: RaydiumData | null }) {
  const live = useMemo(() => {
    if (!isLiveData(data)) return [];
    const fromRoutes = data.routes.filter(isRaydiumRoute).filter((r) => r.sandwich_count > 0).map((r) => ({
      id: r.route_key, pair: r.label?.split("•")[1]?.trim() ?? r.route_key,
      program: programName(r.protocol),
      sandwichPct: Math.round((r.sandwich_count / Math.max(1, r.total_attacks)) * 100),
      stalePct: Math.round(r.stale_quote_pickup_rate),
      bpsAtRisk: r.markout_30s_bps, loss: r.total_extracted_usd,
      attackers: r.unique_attackers, conf: Math.round(r.avg_confidence * 100),
      action: r.policy_action,
      programId: r.protocol?.includes("cpmm") ? "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C" : "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    }));
    return fromRoutes;
  }, [data]);

  const totalLoss = live.reduce((s, r) => s + r.loss, 0);
  const avgBps = live.length > 0 ? live.reduce((s, r) => s + r.bpsAtRisk, 0) / live.length : null;
  const topAttackers = useMemo(() => {
    if (!isLiveData(data)) return [];
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
          ["Observed Loss", fmt(totalLoss), "from current API rows"],
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
          <span className="font-mono text-[10px] text-muted-foreground">{isLiveData(data) ? "chain data" : "waiting for chain"}</span>
        </div>
        {live.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-border/50">
              <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Pair</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Sandwich%</th>
                <th className="px-4 py-3 font-medium">Stale Quote</th>
                <th className="px-4 py-3 font-medium">Bps Risk</th>
                <th className="px-4 py-3 font-medium">Est. Daily Loss</th>
                <th className="px-4 py-3 font-medium">Operators</th>
                <th className="px-4 py-3 font-medium">Policy</th>
                <th className="px-4 py-3 font-medium">Program</th>
              </tr>
            </thead>
            <tbody>
              {live.map((row) => (
                <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{row.pair}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-primary">{row.program}</td>
                  <td className="px-4 py-3 font-mono text-xs text-red-300">{row.sandwichPct}%</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.stalePct}%</td>
                  <td className="px-4 py-3 font-mono text-xs text-yellow-200">{bps(row.bpsAtRisk)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-red-300">{fmt(row.loss)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.attackers}</td>
                  <td className="px-4 py-3">
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase ${actionTone(row.action)}`}>{row.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ExtLink href={solscan(row.programId)} label={truncateAddress(row.programId, 6, 5)} />
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
                <ExtLink href={solscan(a.wallet)} label={truncateAddress(a.wallet, 8, 5)} />
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
    if (!isLiveData(data)) return [];
    const from = data.routes.filter(isRaydiumRoute).filter((r) => r.jit_count > 0 || /clmm/i.test(r.protocol ?? "")).map((r) => ({
      id: r.route_key, pool: r.label?.split("•")[1]?.trim() ?? r.route_key,
      feeTier: "--", tickBand: bps(r.markout_30s_bps),
      windows: r.jit_count, dilutionBps: r.markout_5s_bps, lpDrag: r.lp_annual_loss_usd_estimate,
      attacker: `${r.unique_attackers} operators`, action: r.policy_action,
      programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    }));
    return from;
  }, [data]);

  const clmmId = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

  return (
    <>
      {/* CLMM info bar */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["CLMM Program", truncateAddress(clmmId, 8, 6), ""],
          ["JIT Windows", `${live.reduce((s, r) => s + r.windows, 0)}`, "detected this session"],
          ["Total LP Drag", fmt(live.reduce((s, r) => s + r.lpDrag, 0)), "fee dilution + adverse selection"],
          ["Pools With JIT", `${live.length}`, "from current API rows"],
        ].map(([label, value, sub]) => (
          <div key={label} className="border border-border bg-card p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <div className={`mt-2 font-bold text-foreground ${label === "CLMM Program" ? "text-sm" : "text-2xl"}`}>{value}</div>
            {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
            {label === "CLMM Program" && <div className="mt-1.5"><ExtLink href={solscan(clmmId)} label="View on Solscan" /></div>}
          </div>
        ))}
      </div>

      {/* How JIT works */}
      <div className="border border-primary/20 bg-primary/5 p-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary mb-3">How JIT Works on Raydium CLMM</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ["01", "Detection", "Bot detects large swap in mempool before execution"],
            ["02", "Entry", "Adds concentrated liquidity in exact tick range using `increase_liquidity`"],
            ["03", "Capture", "Captures fees from the swap while the temporary liquidity is active"],
            ["04", "Exit", "Immediately removes liquidity via `decrease_liquidity` after swap confirms"],
          ].map(([num, title, desc]) => (
            <div key={num} className="border border-primary/20 bg-background/40 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] font-bold text-primary">{num}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground">{title}</span>
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">{desc}</p>
            </div>
          ))}
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
                <div className="mt-1"><ExtLink href={solscan(row.programId)} label="CLMM program" /></div>
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
    if (!isLiveData(data)) return [];
    const from = data.attacks.filter(isRaydiumAttack).filter((a) => a.attack_type === "liquidity_snipe").map((a) => ({
      id: a.frontrun_tx ?? a.pool_address,
      token: a.token_mint ? truncateAddress(a.token_mint, 8, 5) : "Unknown",
      progress: null as number | null,
      firstBuy: a.evidence?.some((e: string) => /same slot/i.test(e)) ? "same slot" : "--",
      fee: a.tip_lamports ?? 0,
      sniper: truncateAddress(a.attacker_wallet, 8, 5),
      risk: "monitor",
      extracted: a.profit_usd ?? a.victim_loss_usd ?? 0,
    }));
    return from;
  }, [data]);

  const launchlabId = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["LaunchLab Program", truncateAddress(launchlabId, 8, 6), ""],
          ["Active Launches", `${live.length}`, "with sniper activity"],
          ["Total Extracted", fmt(live.reduce((s, r) => s + r.extracted, 0)), "from launch curves"],
          ["Priority Fees", live.reduce((s, r) => s + r.fee, 0).toLocaleString(), "lamports observed"],
        ].map(([label, value, sub]) => (
          <div key={label} className="border border-border bg-card p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <div className={`mt-2 font-bold text-foreground ${label === "LaunchLab Program" ? "text-sm" : "text-2xl"}`}>{value}</div>
            {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
            {label === "LaunchLab Program" && <div className="mt-1.5"><ExtLink href={solscan(launchlabId)} label="View on Solscan" /></div>}
          </div>
        ))}
      </div>

      {/* Bonding curve explainer */}
      <div className="border border-yellow-500/20 bg-yellow-500/5 p-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-yellow-200 mb-3">How LaunchLab Snipers Work</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["Target", "Bots monitor LaunchLab for new pool creation transactions in every slot"],
            ["Strike", "First buy happens in same slot or +1 slot with priority fee of 100K+ lamports"],
            ["Extract", "Attempts to exit around migration when liquidity moves to a pool"],
          ].map(([title, desc]) => (
            <div key={title} className="border border-yellow-500/20 bg-background/40 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-yellow-200 mb-1.5">{title}</div>
              <p className="text-[11px] leading-4 text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live launches */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Active Launch Curves</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Launches with detected sniper activity</h2>
        </div>
        <div className="divide-y divide-border/40">
          {live.length === 0 && <EmptyPanel message="No Raydium LaunchLab sniper detections are present in the current API window." />}
          {live.map((row) => (
            <div key={row.id} className="grid gap-4 px-4 py-4 md:grid-cols-[1.5fr_1.2fr_1fr_0.5fr]">
              <div>
                <div className="font-mono text-sm font-semibold text-foreground">{row.token}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">Sniper: {row.sniper}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">First buy: {row.firstBuy}</div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                  <span>Curve progress</span>
                  <span className="text-foreground font-semibold">{row.progress == null ? "--" : `${row.progress}%`}</span>
                </div>
                {row.progress != null && (
                  <div className="h-2 border border-border/60 bg-background">
                    <div className="h-full bg-primary/70 transition-all" style={{ width: `${row.progress}%` }} />
                  </div>
                )}
              </div>
              <div>
                <div className="font-mono text-[9px] text-muted-foreground">Extracted</div>
                <div className="font-mono text-lg font-bold text-yellow-200">{fmt(row.extracted)}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{row.fee.toLocaleString()} lamports tip</div>
              </div>
              <div className="flex items-center">
                <span className={`border px-2 py-1 font-mono text-[9px] uppercase ${actionTone(row.risk)}`}>{row.risk}</span>
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
    if (!isLiveData(data)) return [];
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
          <div className="mt-2 text-2xl font-bold text-foreground">{isLiveData(data) ? "Chain" : "--"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">live API rows only</div>
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

type DetectionRow = {
  attack: Attack;
  id: string;
  type: string;
  pair: string;
  program: string;
  profit: number | null;
  loss: number | null;
  conf: number;
  attacker: string;
  attackerFull: string | null;
  age: string;
  frontrunTx: string | null;
  backrunTx?: string | null;
};

function SectionDetections({ data }: { data: RaydiumData | null }) {
  const [filter, setFilter] = useState<"all" | "sandwich" | "jit" | "sniper">("all");
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [detail, setDetail] = useState<AttackDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const liveAttacks = useMemo<DetectionRow[]>(() => {
    if (!isLiveData(data)) return [];
    const from = data.attacks.filter(isRaydiumAttack).map((a, i) => ({
      attack: a,
      id: a.frontrun_tx ?? a.pool_address ?? String(i),
      type: a.attack_type === "liquidity_snipe" ? "sniper" : a.attack_type,
      pair: (a as any).surface_label ?? truncateAddress(a.pool_address, 8, 5),
      program: programName(a.protocol),
      profit: a.profit_usd ?? null,
      loss: a.victim_loss_usd ?? null,
      conf: Math.round(a.confidence * 100),
      attacker: truncateAddress(a.attacker_wallet, 8, 5),
      attackerFull: a.attacker_wallet,
      age: a.block_time ? formatRelativeTime(a.block_time) : "--",
      frontrunTx: a.frontrun_tx ?? null,
      backrunTx: (a as any).backrun_tx ?? null,
    }));
    return from;
  }, [data]);

  useEffect(() => {
    if (!selectedAttack) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    api.attackDetail(selectedAttack.id)
      .then(setDetail)
      .catch((err) => setDetailError(err instanceof Error ? err.message : "Failed to load detection detail"))
      .finally(() => setDetailLoading(false));
  }, [selectedAttack]);

  const filtered = liveAttacks.filter((a) =>
    filter === "all" ? true :
    filter === "sandwich" ? a.type === "sandwich" :
    filter === "jit" ? a.type === "jit" :
    a.type === "sniper" || a.type === "liquidity_snipe"
  );

  const counts = {
    sandwich: liveAttacks.filter((a) => a.type === "sandwich").length,
    jit: liveAttacks.filter((a) => a.type === "jit").length,
    sniper: liveAttacks.filter((a) => a.type === "sniper" || a.type === "liquidity_snipe").length,
  };

  return (
    <>
      {selectedAttack && (
        <>
          <button
            type="button"
            aria-label="Close detection detail"
            className="fixed inset-0 z-40 cursor-default bg-background/60 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setSelectedAttack(null)}
          />
          <DetectionDetailPanel
            attack={selectedAttack}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onClose={() => setSelectedAttack(null)}
          />
        </>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Total Detections</div>
          <div className="mt-2 text-3xl font-bold text-foreground">{liveAttacks.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">this session</div>
        </div>
        <div className="border border-red-500/30 bg-red-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Sandwich</div>
          <div className="mt-2 text-3xl font-bold text-red-300">{counts.sandwich}</div>
        </div>
        <div className="border border-primary/30 bg-primary/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">JIT</div>
          <div className="mt-2 text-3xl font-bold text-primary">{counts.jit}</div>
        </div>
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">LaunchLab Sniper</div>
          <div className="mt-2 text-3xl font-bold text-yellow-200">{counts.sniper}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "sandwich", "jit", "sniper"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
            {f} {f !== "all" && `(${counts[f as keyof typeof counts]})`}
          </button>
        ))}
      </div>

      {/* Detections table */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3 flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Live Raydium MEV Detections</p>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{isLiveData(data) ? "QuickNode live" : "waiting for chain"}</span>
        </div>
        {filtered.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-border/50">
              <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium text-left">Type</th>
                <th className="px-4 py-3 font-medium text-left">Surface</th>
                <th className="px-4 py-3 font-medium text-left">Program</th>
                <th className="px-4 py-3 font-medium text-left">Attacker</th>
                <th className="px-4 py-3 font-medium text-right">Profit</th>
                <th className="px-4 py-3 font-medium text-right">Victim Loss</th>
                <th className="px-4 py-3 font-medium text-right">Conf</th>
                <th className="px-4 py-3 font-medium text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] uppercase font-semibold ${typeTextClass(row.type)}`}>{row.type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.pair}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-primary">{row.program}</td>
                  <td className="px-4 py-3">
                    {row.attackerFull ? (
                      <ExtLink href={solscan(row.attackerFull)} label={row.attacker} />
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">{row.attacker}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-red-300">{row.profit != null ? fmt(row.profit) : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-red-300">{row.loss != null ? fmt(row.loss) : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-muted-foreground">{row.conf}%</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAttack(row.attack)}
                      className="border border-primary/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyPanel message="No Raydium detections match this filter in the current live API window." />}
      </div>
    </>
  );
}

function DetectionDetailPanel({
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
  const evidence = detail?.evidence ?? attack.evidence ?? [];

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Detection detail</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">{attack.attack_type.toUpperCase()} · {attack.surface_label ?? formatPoolLabel(attack.pool_address)}</h2>
        </div>
        <button type="button" onClick={onClose} className="border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-4 p-5">
        <div className="border border-border/60 p-4">
          <div className="grid gap-3 text-xs">
            <DetailLine label="Attacker" value={attack.attacker_wallet} href={solscan(attack.attacker_wallet)} />
            {attack.victim_wallet && <DetailLine label="Victim" value={attack.victim_wallet} href={solscan(attack.victim_wallet)} />}
            <DetailLine label="Validator" value={attack.validator} href={solscan(attack.validator)} />
            <DetailLine label="Confidence" value={`${Math.round(attack.confidence * 100)}%`} />
            <DetailLine label="Surface" value={attack.surface_label ?? formatPoolLabel(attack.pool_address)} />
            <DetailLine label="Block time" value={new Date(attack.block_time).toLocaleString()} />
            {attack.profit_usd != null && <DetailLine label="Searcher profit" value={fmt(attack.profit_usd)} />}
            {attack.victim_loss_usd != null && <DetailLine label="Victim loss" value={fmt(attack.victim_loss_usd)} />}
          </div>
        </div>

        <div className="border border-border/60 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Transactions</div>
          <div className="mt-3 flex flex-col gap-2">
            {attack.frontrun_tx && <ExtLink href={solscan(attack.frontrun_tx, "tx")} label="Frontrun tx" />}
            {attack.victim_tx && <ExtLink href={solscan(attack.victim_tx, "tx")} label="Victim tx" />}
            {attack.backrun_tx && <ExtLink href={solscan(attack.backrun_tx, "tx")} label="Backrun tx" />}
            {!attack.frontrun_tx && !attack.victim_tx && !attack.backrun_tx && <span className="text-sm text-muted-foreground">No transaction signatures returned for this detection.</span>}
          </div>
        </div>

        <div className="border border-border/60 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Evidence</span>
            {loading && <span className="font-mono text-[9px] text-primary">Loading</span>}
          </div>
          {error ? (
            <div className="mt-3 text-sm text-red-300">{error}</div>
          ) : evidence.length > 0 ? (
            <div className="mt-3 space-y-2 text-[11px] text-foreground">
              {evidence.map((item) => (
                <div key={item} className="border border-border/70 px-2 py-2">{item}</div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-muted-foreground">No evidence trail returned yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailLine({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {href ? <ExtLink href={href} label={value} /> : <span className="break-all font-mono text-[11px] text-foreground">{value}</span>}
    </div>
  );
}

// ─── Section: Savings ────────────────────────────────────────────────────────

function SectionSavings({ data }: { data: RaydiumData | null }) {
  const chartData = useMemo(() => {
    if (!isLiveData(data)) return [];
    const from = data.routes.filter(isRaydiumRoute).filter((r) => r.estimated_savings_usd > 0).map((r) => ({
      name: r.label?.split("•")[1]?.trim() ?? r.route_key,
      savings: Math.round(r.estimated_savings_usd),
      program: programName(r.protocol),
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
          <div className="mt-1 text-sm text-muted-foreground">from current Raydium route rows</div>
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
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Estimated savings from live route rows</h2>
        </div>
        <div className="h-64 p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis type="number" tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={TICK_STYLE} axisLine={false} tickLine={false} />
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

      {/* What this means */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "Routes", value: `${chartData.length}`, desc: "Raydium routes with savings estimates returned by the API", color: "border-red-500/30 bg-red-500/5" },
          { title: "For LPs", value: fmt(live_lp_drag(data)), desc: "LP drag currently returned by live LP protection rows", color: "border-primary/30 bg-primary/5" },
          { title: "Data Source", value: isLiveData(data) ? "Chain" : "--", desc: "no frontend demo values are blended into this view", color: "border-yellow-500/30 bg-yellow-500/5" },
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
  if (!isLiveData(data)) return 0;
  const total = data.lp.filter(isRaydiumPool).reduce((s, p) => s + (p.lp_drag_estimate_usd ?? 0), 0);
  return total;
}

// ─── Section: Extraction ─────────────────────────────────────────────────────

function SectionExtraction({ data }: { data: RaydiumData | null }) {
  const liveAttacks = useMemo(() => isLiveData(data) ? data.attacks.filter(isRaydiumAttack) : [], [data]);
  const trendData = useMemo(() => liveAttacks
    .map((attack) => {
      const value = (attack.profit_usd ?? 0) + (attack.victim_loss_usd ?? 0);
      const ts = new Date(attack.block_time).getTime();
      const bucket = attack.attack_type === "sandwich" ? "sandwich" : attack.attack_type === "jit" ? "jit" : "sniper";
      return {
        ts,
        day: Number.isFinite(ts) ? new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--",
        sandwich: bucket === "sandwich" ? value : 0,
        jit: bucket === "jit" ? value : 0,
        sniper: bucket === "sniper" ? value : 0,
      };
    })
    .filter((row) => Number.isFinite(row.ts) && row.sandwich + row.jit + row.sniper > 0)
    .sort((a, b) => a.ts - b.ts), [liveAttacks]);

  const observedTotal = trendData.reduce((sum, row) => sum + row.sandwich + row.jit + row.sniper, 0);
  const peakBucket = trendData.length > 0
    ? trendData.reduce((max, row) => (row.sandwich + row.jit + row.sniper) > (max.sandwich + max.jit + max.sniper) ? row : max, trendData[0])
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
          <div className="mt-1 text-sm text-muted-foreground">from current live detections</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Peak Observation</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{peakBucket?.day ?? "--"}</div>
          <div className="mt-0.5 font-mono text-xs text-red-300">{peakBucket ? fmt(peakBucket.sandwich + peakBucket.jit + peakBucket.sniper) : "--"}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Detections</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{liveAttacks.length}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">current API window</div>
        </div>
      </div>

      {/* Full area chart */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Observed Extraction Timeline</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Sandwich / JIT / Sniper by detection time</h2>
        </div>
        <div className="h-72 p-4">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="day" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={TICK_STYLE} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: number, name: string) => [fmt(v), name.charAt(0).toUpperCase() + name.slice(1)]} contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="sandwich" stackId="1" stroke="hsl(0 85% 62%)" fill="hsl(0 85% 62%)" fillOpacity={0.35} strokeWidth={2} />
                <Area type="monotone" dataKey="jit"      stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} strokeWidth={2} />
                <Area type="monotone" dataKey="sniper"   stackId="1" stroke="hsl(48 96% 53%)" fill="hsl(48 96% 53%)" fillOpacity={0.35} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyPanel message="No Raydium extraction timeline is available yet. The graph only renders live API detections." />}
        </div>
      </div>

      {/* By program */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">By Program</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Extraction breakdown by Raydium surface</h2>
          </div>
          <div className="h-48 p-4">
            {byProgram.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byProgram} dataKey="value" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
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

        {/* Daily table */}
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Bucket Breakdown</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">Observed extraction per detection time</h2>
          </div>
          {trendData.length > 0 ? <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border/50">
                <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium text-left">Bucket</th>
                  <th className="px-4 py-2.5 font-medium text-right text-red-300">Sandwich</th>
                  <th className="px-4 py-2.5 font-medium text-right text-primary">JIT</th>
                  <th className="px-4 py-2.5 font-medium text-right text-yellow-200">Sniper</th>
                  <th className="px-4 py-2.5 font-medium text-right text-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((row) => {
                  const total = row.sandwich + row.jit + row.sniper;
                  const isPeak = peakBucket != null && row.day === peakBucket.day;
                  return (
                    <tr key={`${row.ts}-${row.day}`} className={`border-b border-border/30 last:border-0 ${isPeak ? "bg-red-500/5" : "hover:bg-primary/5"} transition-colors`}>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {row.day} {isPeak && <span className="ml-1 font-mono text-[9px] text-red-300">peak</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-right text-red-300">{fmt(row.sandwich)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-right text-primary">{fmt(row.jit)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-right text-yellow-200">{fmt(row.sniper)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-right font-semibold text-foreground">{fmt(total)}</td>
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
  const { data, loading, refreshing, reload } = useRaydiumData();

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
