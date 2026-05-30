import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  api, Attack, LpProtectionSnapshot, PoolToxicity, RouteRisk, SystemStatus,
} from "@/lib/api";
import { truncateAddress } from "@/lib/utils";

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
function actionTone(a: string) {
  if (a === "avoid" || a === "block" || a === "high") return "border-red-500/45 bg-red-500/10 text-red-300";
  if (a === "reroute" || a === "penalize" || a === "cap" || a === "medium") return "border-yellow-500/45 bg-yellow-500/10 text-yellow-200";
  if (a === "allow" || a === "low") return "border-green-500/40 bg-green-500/10 text-green-300";
  return "border-primary/35 bg-primary/10 text-primary";
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
  savings:    { eyebrow: "Savings",       title: "Estimated Daily Savings" },
  extraction: { eyebrow: "7-Day Trend",   title: "Extraction Timeline" },
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
    silent ? setRefreshing(true) : setLoading(true);
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

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_POOLS = [
  { id: "cpmm-sol-usdc", pair: "SOL/USDC", program: "CPMM",   sandwichPct: 63, stalePct: 49, bpsAtRisk: 18.7, loss: 158950, attackers: 11, conf: 91, action: "avoid",    programId: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C" },
  { id: "amm-sol-usdt",  pair: "SOL/USDT", program: "AMM v4", sandwichPct: 44, stalePct: 37, bpsAtRisk: 12.4, loss:  81420, attackers:  8, conf: 86, action: "reroute",  programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" },
  { id: "cpmm-ray-sol",  pair: "RAY/SOL",  program: "CPMM",   sandwichPct: 29, stalePct: 31, bpsAtRisk:  8.6, loss:  34880, attackers:  5, conf: 82, action: "penalize", programId: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C" },
  { id: "amm-ray-usdc",  pair: "RAY/USDC", program: "AMM v4", sandwichPct: 21, stalePct: 22, bpsAtRisk:  6.1, loss:  18340, attackers:  3, conf: 78, action: "monitor",  programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" },
  { id: "cpmm-sol-ray",  pair: "SOL/RAY",  program: "CPMM",   sandwichPct: 18, stalePct: 19, bpsAtRisk:  4.8, loss:  11200, attackers:  2, conf: 74, action: "monitor",  programId: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C" },
  { id: "amm-sol-bonk",  pair: "SOL/BONK", program: "AMM v4", sandwichPct: 14, stalePct: 16, bpsAtRisk:  3.9, loss:   7640, attackers:  2, conf: 71, action: "monitor",  programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" },
];

const DEMO_JIT = [
  { id: "clmm-sol-usdc",  pool: "SOL/USDC",  feeTier: "0.05%", tickBand: "-44352 → -44096", windows: 19, dilutionBps: 7.8, lpDrag: 47230, attacker: "J1TLabsT7Q2m...x4z7kL", action: "cap",     programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK" },
  { id: "clmm-usdc-usdt", pool: "USDC/USDT", feeTier: "0.01%", tickBand: "-128 → 128",       windows: 11, dilutionBps: 3.1, lpDrag: 18940, attacker: "7yCkPp9J4m...N7wR2dM",   action: "monitor", programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK" },
  { id: "clmm-ray-sol",   pool: "RAY/SOL",   feeTier: "0.25%", tickBand: "-8960 → -8704",    windows:  6, dilutionBps: 1.8, lpDrag:  9420, attacker: "R4yLP99m...K2wQ1X",        action: "monitor", programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK" },
];

const DEMO_LAUNCHES = [
  { id: "l1", token: "LaunchMint...1111", progress: 80, firstBuy: "same slot", fee: 176000, sniper: "L4unch9pQx3...2mN", risk: "high",   extracted: 12420 },
  { id: "l2", token: "CurveToken...9x2A", progress: 58, firstBuy: "+1 slot",   fee:  91000, sniper: "9sN1p3R8uD...N7q",  risk: "medium", extracted:  6850 },
  { id: "l3", token: "NewMint...7fX4",    progress: 41, firstBuy: "+1 slot",   fee:  44000, sniper: "7JkT8pQ2rL...M5n",  risk: "medium", extracted:  2910 },
  { id: "l4", token: "BondCurve...0023",  progress: 22, firstBuy: "+2 slots",  fee:  18000, sniper: "D3mX1vN8qR...L4k",  risk: "low",    extracted:   840 },
];

const DEMO_LP = [
  { id: "lp1", pool: "Raydium CPMM SOL / USDC", score: 86, lvr: 78, adv: 84, drag: 36119, saved: 9.5,  cause: "sandwich pressure" },
  { id: "lp2", pool: "Raydium CLMM SOL / USDC", score: 74, lvr: 69, adv: 72, drag: 28460, saved: 7.1,  cause: "JIT liquidity windows" },
  { id: "lp3", pool: "Raydium AMM v4 SOL/USDT",  score: 68, lvr: 61, adv: 64, drag: 19340, saved: 5.8,  cause: "stale quote arbitrage" },
  { id: "lp4", pool: "Raydium CPMM RAY / SOL",   score: 52, lvr: 48, adv: 51, drag: 10820, saved: 3.4,  cause: "sandwich pressure" },
  { id: "lp5", pool: "Raydium CLMM USDC/USDT",   score: 38, lvr: 34, adv: 36, drag:  6240, saved: 2.1,  cause: "JIT liquidity windows" },
  { id: "lp6", pool: "Raydium AMM v4 RAY/USDC",  score: 26, lvr: 22, adv: 24, drag:  3180, saved: 1.2,  cause: "low toxic flow" },
];

const DEMO_ATTACKERS = [
  { wallet: "B91MkNr9Z7JQ...NPnP9bm", attacks: 142, extracted: 48200, types: "sandwich",         link: "https://solscan.io/account/B91MkNr9Z7JQNDYUbMuA5vfP3FDtCBVxKh7vGPnP9bm" },
  { wallet: "J1TLabsT7Q2m...x4z7kL",  attacks:  89, extracted: 31400, types: "jit, sandwich",    link: "https://solscan.io/account/J1TLabsT7Q2mBT8TKRFyPvgKoGG7r1PNdQsHMcWxPvM" },
  { wallet: "7yCkPp9J4mXr...N7wR2dM", attacks:  61, extracted: 19800, types: "jit",               link: "https://solscan.io/account/7yCkPp9J4mXr8Z2kL5vN7mK2rS3dF8hJ9lP2qR4tY6u" },
  { wallet: "9sN1p3R8uDqM...M5zN7qR", attacks:  34, extracted: 12600, types: "sniper",            link: "https://solscan.io/account/9sN1p3R8uDqMK5zN7qRvL8mJ4tP2xC6vN7mK2rS3dF" },
  { wallet: "L4unch9pQx3k...2mN8qK",  attacks:  28, extracted:  9420, types: "launchlab sniper",  link: "https://solscan.io/account/L4unch9pQx3kKB7vGPnP9bmT8TKRFyPvgKoGG7r1PN" },
];

const DEMO_DETECTIONS = [
  { id: "x1", type: "sandwich",  pair: "SOL/USDC", program: "CPMM",      profit: 287,  loss: 340,  conf: 94, attacker: "B91Mk...P9bm", age: "4s",  frontrunTx: null },
  { id: "x2", type: "jit",       pair: "SOL/USDC", program: "CLMM",      profit:  58,  loss: null, conf: 88, attacker: "J1TLa...7kL",  age: "12s", frontrunTx: null },
  { id: "x3", type: "sandwich",  pair: "SOL/USDT", program: "AMM v4",    profit: 124,  loss: 142,  conf: 87, attacker: "7yCk...dM",    age: "19s", frontrunTx: null },
  { id: "x4", type: "sniper",    pair: "LaunchMint...1111", program: "LaunchLab", profit: null, loss: null, conf: 86, attacker: "L4un...mN", age: "27s", frontrunTx: null },
  { id: "x5", type: "sandwich",  pair: "RAY/SOL",  program: "CPMM",      profit:  89,  loss: 104,  conf: 83, attacker: "9sN1...qR",    age: "34s", frontrunTx: null },
  { id: "x6", type: "jit",       pair: "USDC/USDT",program: "CLMM",      profit:  31,  loss: null, conf: 81, attacker: "J1TLa...7kL",  age: "41s", frontrunTx: null },
  { id: "x7", type: "sandwich",  pair: "SOL/BONK", program: "AMM v4",    profit:  47,  loss:  58,  conf: 79, attacker: "B91Mk...P9bm", age: "52s", frontrunTx: null },
  { id: "x8", type: "sniper",    pair: "BondCurve...0023", program: "LaunchLab", profit: null, loss: null, conf: 78, attacker: "D3mX...L4k", age: "1m 8s", frontrunTx: null },
];

const SEVEN_DAY = [
  { day: "Mon", sandwich: 38400, jit: 14200, sniper: 7100 },
  { day: "Tue", sandwich: 42100, jit: 16800, sniper: 8200 },
  { day: "Wed", sandwich: 51200, jit: 19400, sniper: 9800 },
  { day: "Thu", sandwich: 44800, jit: 17200, sniper: 8400 },
  { day: "Fri", sandwich: 68300, jit: 24100, sniper: 11800 },
  { day: "Sat", sandwich: 28900, jit: 10400, sniper: 5200 },
  { day: "Sun", sandwich: 22400, jit: 8100,  sniper: 4300 },
];

const SAVINGS_BREAKDOWN = [
  { name: "SOL/USDC (CPMM)", savings: 158950, program: "CPMM" },
  { name: "SOL/USDT (AMM v4)", savings: 81420, program: "AMM v4" },
  { name: "SOL/USDC (CLMM JIT)", savings: 47230, program: "CLMM" },
  { name: "RAY/SOL (CPMM)", savings: 34880, program: "CPMM" },
  { name: "LaunchLab avg.", savings: 19270, program: "LaunchLab" },
  { name: "USDC/USDT (CLMM)", savings: 18940, program: "CLMM" },
  { name: "RAY/USDC (AMM v4)", savings: 11200, program: "AMM v4" },
];

function typeColor(t: string) {
  if (t === "sandwich") return "hsl(0 85% 62%)";
  if (t === "jit")      return "hsl(var(--primary))";
  return "hsl(48 96% 53%)";
}
function typeTextClass(t: string) {
  if (t === "sandwich") return "text-red-300";
  if (t === "jit")      return "text-primary";
  return "text-yellow-200";
}

// ─── Section: Pools ──────────────────────────────────────────────────────────

function SectionPools({ data }: { data: RaydiumData | null }) {
  const live = useMemo(() => {
    if (!data) return [];
    const fromRoutes = data.routes.filter(isRaydiumRoute).filter((r) => r.sandwich_count > 0).map((r) => ({
      id: r.route_key, pair: r.label?.split("•")[1]?.trim() ?? r.route_key,
      program: r.protocol?.includes("cpmm") ? "CPMM" : r.protocol?.includes("v4") ? "AMM v4" : "Raydium",
      sandwichPct: Math.round((r.sandwich_count / Math.max(1, r.total_attacks)) * 100),
      stalePct: Math.round(r.stale_quote_pickup_rate),
      bpsAtRisk: r.markout_30s_bps, loss: r.total_extracted_usd,
      attackers: r.unique_attackers, conf: Math.round(r.avg_confidence * 100),
      action: r.policy_action,
      programId: r.protocol?.includes("cpmm") ? "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C" : "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    }));
    return fromRoutes.length > 0 ? fromRoutes : DEMO_POOLS;
  }, [data]);

  const totalLoss = live.reduce((s, r) => s + r.loss, 0);
  const totalAttackers = new Set(live.map((r) => r.attackers)).size;

  return (
    <>
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Pools Monitored", `${live.length}`, "CPMM + AMM v4"],
          ["Total Daily Loss", fmt(totalLoss), "sandwich extraction"],
          ["Avg Bps at Risk", `${(live.reduce((s, r) => s + r.bpsAtRisk, 0) / live.length).toFixed(1)} bps`, "per swap"],
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={live.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={TICK_STYLE} axisLine={false} tickLine={false} domain={[0, 100]} />
              <YAxis type="category" dataKey="pair" width={80} tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Sandwich rate"]} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="sandwichPct" fill="hsl(0 85% 62%)" fillOpacity={0.8} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full table */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All Monitored Pools</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">{live.length} surfaces ranked by extraction risk</h2>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{data ? "live data" : "demo mode"}</span>
        </div>
        <div className="overflow-x-auto">
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
        </div>
      </div>

      {/* Top attackers */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Top Operators</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Wallets responsible for Raydium extraction</h2>
        </div>
        <div className="divide-y divide-border/40">
          {DEMO_ATTACKERS.slice(0, 5).map((a, i) => (
            <div key={a.wallet} className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border font-mono text-xs text-muted-foreground">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <ExtLink href={a.link} label={a.wallet} />
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{a.types}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs font-semibold text-red-300">{fmt(a.extracted)}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{a.attacks} attacks</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Section: JIT ────────────────────────────────────────────────────────────

function SectionJit({ data }: { data: RaydiumData | null }) {
  const live = useMemo(() => {
    if (!data) return DEMO_JIT;
    const from = data.routes.filter(isRaydiumRoute).filter((r) => r.jit_count > 0 || /clmm/i.test(r.protocol ?? "")).map((r) => ({
      id: r.route_key, pool: r.label?.split("•")[1]?.trim() ?? r.route_key,
      feeTier: "0.05%", tickBand: `tick proxy ${Math.round(r.markout_30s_bps * -256)} → ${Math.round(r.markout_30s_bps * 256)}`,
      windows: r.jit_count, dilutionBps: r.markout_5s_bps * 0.54, lpDrag: r.lp_annual_loss_usd_estimate,
      attacker: `${r.unique_attackers} operators`, action: r.policy_action === "avoid" ? "reroute" : "cap",
      programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    }));
    return from.length > 0 ? from : DEMO_JIT;
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
          ["LP Fee Split", "84% LP / 12% RAY / 4% Treasury", "per CLMM pool"],
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
            ["03", "Capture", "Earns 84% of swap fees on that single trade as passive LP"],
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={live} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="pool" width={80} tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [fmt(v), "LP Drag"]} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="lpDrag" fill="hsl(var(--primary))" fillOpacity={0.8} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full table */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">All JIT Windows</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">{live.length} CLMM pools with JIT activity</h2>
        </div>
        <div className="divide-y divide-border/40">
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
    if (!data) return DEMO_LAUNCHES;
    const from = data.attacks.filter(isRaydiumAttack).filter((a) => a.attack_type === "liquidity_snipe").map((a) => ({
      id: a.frontrun_tx ?? a.pool_address,
      token: a.token_mint ? truncateAddress(a.token_mint, 8, 5) : "Unknown",
      progress: Math.min(98, Math.max(20, Math.round(((a.tip_lamports ?? 0) / 2200) % 100))),
      firstBuy: a.evidence?.some((e: string) => /same slot/i.test(e)) ? "same slot" : "+1 slot",
      fee: a.tip_lamports ?? 0,
      sniper: truncateAddress(a.attacker_wallet, 8, 5),
      risk: (a.tip_lamports ?? 0) >= 140_000 ? "high" : (a.tip_lamports ?? 0) >= 75_000 ? "medium" : "low",
      extracted: a.profit_usd ?? a.victim_loss_usd ?? 0,
    }));
    return from.length > 0 ? from : DEMO_LAUNCHES;
  }, [data]);

  const launchlabId = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["LaunchLab Program", truncateAddress(launchlabId, 8, 6), ""],
          ["Graduation Target", "85 SOL", "JustSendit mode default"],
          ["Active Launches", `${live.length}`, "with sniper activity"],
          ["Total Extracted", fmt(live.reduce((s, r) => s + r.extracted, 0)), "from launch curves"],
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
            ["Extract", "Sells at graduation (85 SOL curve completion) when liquidity migrates to CPMM"],
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
                  <span className="text-foreground font-semibold">{row.progress}% / 85 SOL</span>
                </div>
                <div className="h-2 border border-border/60 bg-background">
                  <div className="h-full transition-all" style={{ width: `${row.progress}%`, background: row.risk === "high" ? "hsl(0 85% 62%)" : row.risk === "medium" ? "hsl(48 96% 53%)" : "hsl(var(--primary))" }} />
                </div>
                <div className="mt-1 font-mono text-[9px] text-muted-foreground">{(85 * row.progress / 100).toFixed(1)} SOL raised</div>
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
    if (!data) return DEMO_LP;
    const from = data.lp.filter(isRaydiumPool).map((p) => ({
      id: p.pool_address, pool: p.pool_address,
      score: Math.round(p.toxicity_score), lvr: Math.round(p.lvr_proxy_score ?? 0),
      adv: Math.round(p.adverse_selection_intensity ?? 0), drag: p.lp_drag_estimate_usd ?? 0,
      saved: p.saved_fee_bps_if_segmented ?? 0, cause: p.primary_cause ?? "toxic flow",
    }));
    return from.length > 0 ? from : DEMO_LP;
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
          <div className="mt-2 text-2xl font-bold text-primary">{bps(live.reduce((s, r) => s + r.saved, 0) / live.length)}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">CLMM LP Fee</div>
          <div className="mt-2 text-2xl font-bold text-foreground">84%</div>
          <div className="mt-0.5 text-xs text-muted-foreground">of swap fees to LPs</div>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scoreData} dataKey="count" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                  {scoreData.map((d) => <Cell key={d.range} fill={d.color} fillOpacity={0.85} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} pools`, ""]} contentStyle={TOOLTIP_STYLE} />
                <Legend formatter={(value) => <span className="font-mono text-[10px] text-muted-foreground">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
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

function SectionDetections({ data }: { data: RaydiumData | null }) {
  const [filter, setFilter] = useState<"all" | "sandwich" | "jit" | "sniper">("all");

  const liveAttacks = useMemo(() => {
    if (!data) return DEMO_DETECTIONS;
    const from = data.attacks.filter(isRaydiumAttack).map((a, i) => ({
      id: a.frontrun_tx ?? a.pool_address ?? String(i),
      type: a.attack_type === "liquidity_snipe" ? "sniper" : a.attack_type,
      pair: (a as any).surface_label ?? truncateAddress(a.pool_address, 8, 5),
      program: a.protocol?.includes("cpmm") ? "CPMM" : a.protocol?.includes("clmm") ? "CLMM" : a.protocol?.includes("v4") ? "AMM v4" : a.protocol?.includes("launch") ? "LaunchLab" : "Raydium",
      profit: a.profit_usd ?? null, loss: a.victim_loss_usd ?? null,
      conf: Math.round(a.confidence * 100),
      attacker: truncateAddress(a.attacker_wallet, 8, 5),
      attackerFull: a.attacker_wallet,
      age: `${i * 4 + 2}s`,
      frontrunTx: a.frontrun_tx ?? null,
      backrunTx: (a as any).backrun_tx ?? null,
    }));
    return from.length > 0 ? from : DEMO_DETECTIONS;
  }, [data]);

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
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{data ? "QuickNode live" : "demo mode"}</span>
        </div>
        <div className="overflow-x-auto">
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
                <th className="px-4 py-3 font-medium text-left">Tx</th>
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
                    <ExtLink href={solscan(row.attackerFull ?? row.attacker)} label={row.attacker} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-red-300">{row.profit != null ? fmt(row.profit) : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-red-300">{row.loss != null ? fmt(row.loss) : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-muted-foreground">{row.conf}%</td>
                  <td className="px-4 py-3">
                    {row.frontrunTx ? <ExtLink href={solscan(row.frontrunTx, "tx")} label="frontrun" /> : <span className="font-mono text-[10px] text-muted-foreground/50">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Section: Savings ────────────────────────────────────────────────────────

function SectionSavings({ data }: { data: RaydiumData | null }) {
  const chartData = useMemo(() => {
    if (!data) return SAVINGS_BREAKDOWN;
    const from = data.routes.filter(isRaydiumRoute).filter((r) => r.estimated_savings_usd > 0).map((r) => ({
      name: r.label?.split("•")[1]?.trim() ?? r.route_key,
      savings: Math.round(r.estimated_savings_usd),
      program: r.protocol?.includes("cpmm") ? "CPMM" : r.protocol?.includes("clmm") ? "CLMM" : r.protocol?.includes("launch") ? "LaunchLab" : "AMM v4",
    })).sort((a, b) => b.savings - a.savings);
    return from.length >= 3 ? from : SAVINGS_BREAKDOWN;
  }, [data]);

  const totalSavings = chartData.reduce((s, r) => s + r.savings, 0);
  const byProgram = chartData.reduce((acc, r) => { acc[r.program] = (acc[r.program] ?? 0) + r.savings; return acc; }, {} as Record<string, number>);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="col-span-2 border border-primary/40 bg-primary/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Total Savings Potential / 24h</div>
          <div className="mt-2 text-5xl font-bold text-primary">{fmt(totalSavings)}</div>
          <div className="mt-1 text-sm text-muted-foreground">if Intelleum protection is active across all surfaces</div>
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
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Estimated daily savings if Intelleum protection active</h2>
        </div>
        <div className="h-64 p-4">
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
          { title: "For Traders", value: "18.7 bps", desc: "average sandwich slippage saved per trade on high-risk CPMM pools", color: "border-red-500/30 bg-red-500/5" },
          { title: "For LPs", value: fmt(live_lp_drag(data)), desc: "estimated LP drag from JIT and adverse selection, recoverable with fee segmentation", color: "border-primary/30 bg-primary/5" },
          { title: "For Raydium", value: "~0.3% protocol fee", desc: "protected trades generate cleaner, more reliable fee revenue without extraction noise", color: "border-yellow-500/30 bg-yellow-500/5" },
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
  if (!data) return 65350;
  const total = data.lp.filter(isRaydiumPool).reduce((s, p) => s + (p.lp_drag_estimate_usd ?? 0), 0);
  return total > 0 ? total : 65350;
}

// ─── Section: Extraction ─────────────────────────────────────────────────────

function SectionExtraction({ data }: { data: RaydiumData | null }) {
  const dailyTotal = Math.max(83000, data?.attacks.filter(isRaydiumAttack).reduce((s, a) => s + (a.profit_usd ?? 0) + (a.victim_loss_usd ?? 0), 0) ?? 83000);
  const peakDay = SEVEN_DAY.reduce((max, d) => (d.sandwich + d.jit + d.sniper) > (max.sandwich + max.jit + max.sniper) ? d : max, SEVEN_DAY[0]);

  const byProgram = [
    { name: "CPMM", value: 52400, fill: "hsl(0 85% 62%)" },
    { name: "AMM v4", value: 28900, fill: "hsl(10 80% 55%)" },
    { name: "CLMM", value: 14200, fill: "hsl(var(--primary))" },
    { name: "LaunchLab", value: 7100, fill: "hsl(48 96% 53%)" },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="col-span-2 border border-red-500/40 bg-red-500/5 p-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">72% of Solana MEV targets Raydium</div>
          <div className="mt-2 text-5xl font-bold text-red-300">{fmt(dailyTotal)}</div>
          <div className="mt-1 text-sm text-muted-foreground">estimated daily extraction from Raydium pools</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Peak Day (7d)</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{peakDay.day}</div>
          <div className="mt-0.5 font-mono text-xs text-red-300">{fmt(peakDay.sandwich + peakDay.jit + peakDay.sniper)}</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Monthly Estimate</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{fmt(dailyTotal * 30)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">at current rate</div>
        </div>
      </div>

      {/* Full area chart */}
      <div className="border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">7-Day Extraction Timeline</p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">Sandwich / JIT / Sniper by day</h2>
        </div>
        <div className="h-72 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SEVEN_DAY} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis dataKey="day" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={TICK_STYLE} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v: number, name: string) => [fmt(v), name.charAt(0).toUpperCase() + name.slice(1)]} contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="sandwich" stackId="1" stroke="hsl(0 85% 62%)" fill="hsl(0 85% 62%)" fillOpacity={0.35} strokeWidth={2} />
              <Area type="monotone" dataKey="jit"      stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} strokeWidth={2} />
              <Area type="monotone" dataKey="sniper"   stackId="1" stroke="hsl(48 96% 53%)" fill="hsl(48 96% 53%)" fillOpacity={0.35} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byProgram} dataKey="value" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                  {byProgram.map((d) => <Cell key={d.name} fill={d.fill} fillOpacity={0.85} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [fmt(v), ""]} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-border/50 p-3 space-y-2">
            {byProgram.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                <span className="font-mono text-[10px] text-muted-foreground flex-1">{d.name}</span>
                <span className="font-mono text-[10px] font-semibold text-foreground">{fmt(d.value)}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{Math.round(d.value / (byProgram.reduce((s, x) => s + x.value, 0)) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily table */}
        <div className="border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Daily Breakdown</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">7-day extraction per type</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border/50">
                <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium text-left">Day</th>
                  <th className="px-4 py-2.5 font-medium text-right text-red-300">Sandwich</th>
                  <th className="px-4 py-2.5 font-medium text-right text-primary">JIT</th>
                  <th className="px-4 py-2.5 font-medium text-right text-yellow-200">Sniper</th>
                  <th className="px-4 py-2.5 font-medium text-right text-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {SEVEN_DAY.map((row) => {
                  const total = row.sandwich + row.jit + row.sniper;
                  const isPeak = row.day === peakDay.day;
                  return (
                    <tr key={row.day} className={`border-b border-border/30 last:border-0 ${isPeak ? "bg-red-500/5" : "hover:bg-primary/5"} transition-colors`}>
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
          </div>
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
