import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { api, LiquidationFirewallRecord, PreventionGuard, RouteRanking, RouteRisk } from "@/lib/api";

type Objective = "best_execution" | "protect_users" | "protect_lp" | "monitor_only";

type Scenario = {
  id: string;
  label: string;
  headline: string;
  protocol: string;
  route_key: string;
  input_mint: string | null;
  output_mint: string | null;
  defaultNotional: number;
  slippageBps: number;
  plainEnglishRisk: string;
};

const ROUTE_LIMIT = 50;
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const scenarios: Scenario[] = [
  {
    id: "raydium-toxic",
    label: "SOL / USDC through Raydium",
    headline: "Likely sandwich pressure",
    protocol: "raydium_amm",
    route_key: `route:raydium_amm:${SOL}->${USDC}`,
    input_mint: SOL,
    output_mint: USDC,
    defaultNotional: 85_000,
    slippageBps: 50,
    plainEnglishRisk: "High-value swap path.",
  },
  {
    id: "meteora-jit",
    label: "SOL / USDC through Meteora DLMM",
    headline: "JIT liquidity window",
    protocol: "meteora_dlmm",
    route_key: `venue:meteora_dlmm:${SOL}->${USDC}`,
    input_mint: SOL,
    output_mint: USDC,
    defaultNotional: 42_500,
    slippageBps: 40,
    plainEnglishRisk: "LP/JIT risk window.",
  },
  {
    id: "orca-monitor",
    label: "USDC / SOL through Orca",
    headline: "Cleaner fallback candidate",
    protocol: "orca_whirlpool",
    route_key: `venue:orca_whirlpool:${USDC}->${SOL}`,
    input_mint: USDC,
    output_mint: SOL,
    defaultNotional: 25_000,
    slippageBps: 30,
    plainEnglishRisk: "Cleaner fallback.",
  },
];

const objectiveLabels: Record<Objective, string> = {
  protect_users: "Protect users",
  protect_lp: "Protect LPs",
  best_execution: "Best execution",
  monitor_only: "Monitor only",
};

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "$0";
  return value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(2)}M`
    : value >= 1_000
      ? `$${(value / 1_000).toFixed(1)}K`
      : `$${value.toFixed(0)}`;
}

function formatAction(value: string | undefined | null) {
  if (!value) return "Waiting";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function actionTone(value: string | undefined | null) {
  if (value === "block" || value === "avoid" || value === "pause" || value === "stress") {
    return "border-red-500/50 bg-red-500/10 text-red-300";
  }
  if (value === "reroute" || value === "penalize" || value === "throttle" || value === "toxic") {
    return "border-yellow-500/50 bg-yellow-500/10 text-yellow-300";
  }
  if (value === "allow" || value === "normal") {
    return "border-green-500/50 bg-green-500/10 text-green-300";
  }
  return "border-primary/40 bg-primary/10 text-primary";
}

function decisionHeadline(action: PreventionGuard["action"] | undefined) {
  if (action === "block") return "Do not send this route.";
  if (action === "reroute") return "Use the safer route instead.";
  if (action === "penalize") return "Downrank it and cap size.";
  if (action === "monitor") return "Send only with monitoring.";
  if (action === "allow") return "Route is safe enough right now.";
  return "Run the guard to get a decision.";
}

function decisionExplanation(guard: PreventionGuard | null) {
  if (!guard) return "Route in. Decision out.";
  if (guard.action === "block") return "Fail closed. Get a new quote.";
  if (guard.action === "reroute") return "Move flow to the cleaner path.";
  if (guard.action === "penalize") return "Downrank, tighten, cap size.";
  if (guard.action === "monitor") return "Allowed, but watch the route.";
  return "Safe enough right now.";
}

function compactSteps(guard: PreventionGuard | null) {
  if (!guard) return ["Run guard", "Get action"];
  if (guard.action === "block") return ["Stop tx", "Requote"];
  if (guard.action === "reroute") return ["Switch route", "Private send"];
  if (guard.action === "penalize") return ["Downrank", "Cap size"];
  if (guard.action === "monitor") return ["Log route", "Rescore"];
  return ["Submit", "Track quality"];
}

function parseMintsFromRouteKey(routeKey: string) {
  const pair = routeKey.split(":").pop();
  const mints = pair?.split("->").filter(Boolean) ?? [];
  return {
    input_mint: mints[0] ?? null,
    output_mint: mints[1] ?? null,
  };
}

function routeRiskToScenario(route: RouteRisk): Scenario {
  const mints = parseMintsFromRouteKey(route.route_key);
  return {
    id: route.route_key,
    label: route.label,
    headline: `${formatAction(route.policy_action)} · ${route.toxicity_probability.toFixed(0)} toxicity`,
    protocol: route.protocol ?? "unknown",
    route_key: route.route_key,
    input_mint: mints.input_mint,
    output_mint: mints.output_mint,
    defaultNotional: Math.max(10_000, Math.min(150_000, route.recommended_max_notional_usd || 50_000)),
    slippageBps: Math.max(10, Math.round(route.realized_slippage_bps * 3.2)),
    plainEnglishRisk: `${route.total_attacks} detections · ${route.markout_30s_bps.toFixed(1)} bps markout`,
  };
}

function buildCandidates(current: Scenario, options: Scenario[]) {
  return options
    .map((scenario) => ({
      route_key: scenario.route_key,
      label: scenario.label,
      protocol: scenario.protocol,
      input_mint: scenario.input_mint,
      output_mint: scenario.output_mint,
    }))
    .filter((candidate) => candidate.route_key !== current.route_key)
    .concat({
      route_key: current.route_key,
      label: current.label,
      protocol: current.protocol,
      input_mint: current.input_mint,
      output_mint: current.output_mint,
    });
}

export default function Protection() {
  const reduceMotion = useReducedMotion();
  const [routeOptions, setRouteOptions] = useState<Scenario[]>(scenarios);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const scenario = routeOptions.find((item) => item.id === scenarioId) ?? routeOptions[0] ?? scenarios[0];
  const [notional, setNotional] = useState(String(scenario.defaultNotional));
  const [slippage, setSlippage] = useState(String(scenario.slippageBps));
  const [objective, setObjective] = useState<Objective>("protect_users");
  const [guard, setGuard] = useState<PreventionGuard | null>(null);
  const [ranking, setRanking] = useState<RouteRanking | null>(null);
  const [liquidationFirewall, setLiquidationFirewall] = useState<LiquidationFirewallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const notionalUsd = useMemo(() => Number(notional.replace(/,/g, "")) || 0, [notional]);
  const slippageBps = useMemo(() => Number(slippage.replace(/,/g, "")) || 0, [slippage]);

  useEffect(() => {
    let cancelled = false;

    const loadRoutes = async () => {
      setRoutesLoading(true);
      try {
        const routes = await api.routeRisks(ROUTE_LIMIT);
        if (cancelled) return;
        const nextOptions = routes.map(routeRiskToScenario);
        if (nextOptions.length > 0) {
          setRouteOptions(nextOptions);
          setScenarioId((current) =>
            nextOptions.some((option) => option.id === current) ? current : nextOptions[0].id,
          );
        }
      } catch {
        if (!cancelled) setRouteOptions(scenarios);
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    };

    void loadRoutes();
    const interval = window.setInterval(() => {
      void loadRoutes();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setNotional(String(scenario.defaultNotional));
    setSlippage(String(scenario.slippageBps));
    setGuard(null);
    setRanking(null);
  }, [scenario.defaultNotional, scenario.slippageBps]);

  const runGuard = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        route_key: scenario.route_key,
        route_label: scenario.label,
        protocol: scenario.protocol,
        input_mint: scenario.input_mint,
        output_mint: scenario.output_mint,
        notional_usd: notionalUsd,
        slippage_bps: slippageBps,
        objective,
        candidates: buildCandidates(scenario, routeOptions),
      };
      const [nextGuard, nextRanking, nextLiquidationFirewall] = await Promise.all([
        api.protectedSendPlan(payload),
        api.rankRoutes(payload),
        api.liquidationFirewall(4),
      ]);
      setGuard(nextGuard);
      setRanking(nextRanking);
      setLiquidationFirewall(nextLiquidationFirewall);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Protection check failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runGuard();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden px-4 py-5 md:px-6">
        <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_4%,hsl(var(--primary)/0.12),transparent_28%),radial-gradient(circle_at_92%_8%,hsl(var(--destructive)/0.10),transparent_24%)]" />

        <div className="relative mx-auto max-w-7xl">
          <PageNav />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35 }}
            className="grid gap-5 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end"
          >
            <div>
              <p className="data-label mb-4">// Protection Firewall</p>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                Check the route before it leaks.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                One pre-trade guard for wallets, routers, LP desks, and protocols.
              </p>
            </div>

            <div className="intel-panel p-5">
              <p className="data-label mb-4">// Flow</p>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs uppercase tracking-[0.14em]">
                <div className="border border-border/60 bg-background/25 p-3 text-muted-foreground">Route</div>
                <div className="border border-primary/40 bg-primary/10 p-3 text-primary">Guard</div>
                <div className="border border-border/60 bg-background/25 p-3 text-muted-foreground">Action</div>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-[24rem_1fr]">
            <div className="space-y-4">
              <TradeCheckForm
                scenario={scenario}
                scenarioId={scenarioId}
                notional={notional}
                slippage={slippage}
                objective={objective}
                loading={loading}
                routesLoading={routesLoading}
                error={error}
                routeOptions={routeOptions}
                onScenarioChange={setScenarioId}
                onNotionalChange={setNotional}
                onSlippageChange={setSlippage}
                onObjectiveChange={setObjective}
                onSubmit={handleSubmit}
              />
              <SdkExplainer />
            </div>

            <div className="space-y-5">
              <DecisionReceipt guard={guard} loading={loading} />
              <AdvancedIntel ranking={ranking} liquidationFirewall={liquidationFirewall} loading={loading} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PageNav() {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-border/70 pb-4 font-mono text-xs tracking-[0.16em] text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-3">
        <Link to="/" className="min-h-10 border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Home
        </Link>
        <Link to="/dashboard" className="min-h-10 border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Dashboard
        </Link>
        <Link to="/dex-intelligence/raydium" className="min-h-10 border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          DEX Intel
        </Link>
        <Link to="/intel-api" className="min-h-10 border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          API
        </Link>
      </div>
      <div className="flex min-h-10 items-center gap-2 text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-glow" />
        Pre-Trade Protection
      </div>
    </div>
  );
}

function TradeCheckForm({
  scenario,
  scenarioId,
  notional,
  slippage,
  objective,
  loading,
  routesLoading,
  error,
  routeOptions,
  onScenarioChange,
  onNotionalChange,
  onSlippageChange,
  onObjectiveChange,
  onSubmit,
}: {
  scenario: Scenario;
  scenarioId: string;
  notional: string;
  slippage: string;
  objective: Objective;
  loading: boolean;
  routesLoading: boolean;
  error: string | null;
  routeOptions: Scenario[];
  onScenarioChange: (value: string) => void;
  onNotionalChange: (value: string) => void;
  onSlippageChange: (value: string) => void;
  onObjectiveChange: (value: Objective) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="intel-panel p-5" aria-busy={loading}>
      <fieldset className="space-y-5">
        <legend className="data-label mb-1">Protection Check</legend>

        <div className="space-y-2">
          <label htmlFor="scenario" className="block text-xs tracking-[0.12em] text-foreground">
            Route
          </label>
          <select
            id="scenario"
            value={scenarioId}
            onChange={(event) => onScenarioChange(event.target.value)}
            className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {routeOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {routesLoading ? "Refreshing live route list..." : `${routeOptions.length} routes loaded`} · {scenario.headline} · {scenario.plainEnglishRisk}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="space-y-2">
            <label htmlFor="notional" className="block text-xs tracking-[0.12em] text-foreground">
              Size USD
            </label>
            <input
              id="notional"
              type="text"
              inputMode="decimal"
              value={notional}
              onChange={(event) => onNotionalChange(event.target.value)}
              className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="slippage" className="block text-xs tracking-[0.12em] text-foreground">
              Slippage bps
            </label>
            <input
              id="slippage"
              type="text"
              inputMode="decimal"
              value={slippage}
              onChange={(event) => onSlippageChange(event.target.value)}
              className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="objective" className="block text-xs tracking-[0.12em] text-foreground">
            Objective
          </label>
          <select
            id="objective"
            value={objective}
            onChange={(event) => onObjectiveChange(event.target.value as Objective)}
            className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(Object.keys(objectiveLabels) as Objective[]).map((key) => (
              <option key={key} value={key}>{objectiveLabels[key]}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full border border-primary bg-primary px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {loading ? "Checking..." : "Run guard"}
        </button>

        {error && (
          <div className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </fieldset>
    </form>
  );
}

function DecisionReceipt({ guard, loading }: { guard: PreventionGuard | null; loading: boolean }) {
  const reduceMotion = useReducedMotion();

  if (loading && !guard) {
    return (
      <div className="intel-panel-glow p-6">
        <div className="h-4 w-40 animate-pulse bg-muted" />
        <div className="mt-5 h-16 animate-pulse bg-muted/60" />
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="h-24 animate-pulse bg-muted/40" />
          <div className="h-24 animate-pulse bg-muted/40" />
          <div className="h-24 animate-pulse bg-muted/40" />
          <div className="h-24 animate-pulse bg-muted/40" />
        </div>
      </div>
    );
  }

  const proof = guard?.savings_proof;
  const policy = guard?.protected_send_policy;

  return (
    <motion.section
      key={`${guard?.action ?? "empty"}-${guard?.expected_loss_at_risk_usd ?? 0}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28 }}
      className="intel-panel-glow overflow-hidden"
    >
      <div className="border-b border-border/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="data-label mb-3">// Decision Receipt</p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              {decisionHeadline(guard?.action)}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              {decisionExplanation(guard)}
            </p>
          </div>
          <div className={`border px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] ${actionTone(guard?.action)}`}>
            {formatAction(guard?.action)}
          </div>
        </div>
        {guard?.ai_brief && (
          <div className="mt-5 border border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">// AI Analysis</span>
              <span className="font-mono text-[9px] text-muted-foreground">gpt-4o-mini</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{guard.ai_brief}</p>
          </div>
        )}
      </div>

      <div className="grid border-b border-border/70 md:grid-cols-4">
        <ReceiptMetric label="Expected loss" value={formatUsd(guard?.expected_loss_at_risk_usd)} />
        <ReceiptMetric label="Prevented now" value={formatUsd(proof?.estimated_loss_prevented_usd)} />
        <ReceiptMetric label="Monthly saved" value={formatUsd(proof?.monthly_savings_projection_usd)} />
        <ReceiptMetric label="Submit via" value={policy ? formatAction(policy.submit_via) : "Waiting"} />
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="space-y-3">
            {compactSteps(guard).map((step, index) => (
              <div key={step} className="grid grid-cols-[2rem_1fr] gap-3 border border-border/60 bg-background/25 p-3">
                <div className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</div>
                <div className="text-sm text-muted-foreground">{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(guard?.reason_codes.length ? guard.reason_codes : ["route_not_checked"]).map((reason) => (
                <span key={reason} className="border border-border/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                  {formatAction(reason)}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="Bps saved" value={proof ? `${proof.estimated_bps_saved.toFixed(2)}` : "0"} />
              <MiniMetric label="Safe size" value={formatUsd(guard?.recommended_max_notional_usd)} />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ReceiptMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-xl text-primary md:text-2xl">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/60 bg-background/25 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg text-primary">{value}</div>
    </div>
  );
}

function AdvancedIntel({
  ranking,
  liquidationFirewall,
  loading,
}: {
  ranking: RouteRanking | null;
  liquidationFirewall: LiquidationFirewallRecord[];
  loading: boolean;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <div className="intel-panel p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="data-label mb-2">// Routes</p>
            <h3 className="text-lg font-semibold text-foreground">Best fallback paths.</h3>
          </div>
        </div>
        {loading && !ranking ? (
          <div className="h-32 animate-pulse bg-muted/50" />
        ) : (
          <div className="space-y-2">
            {(ranking?.ranked_candidates ?? []).slice(0, 3).map((candidate) => (
              <div key={`${candidate.rank}-${candidate.route_key}`} className="grid gap-2 border border-border/60 bg-background/25 p-3 font-mono text-xs sm:grid-cols-[2rem_1fr_auto] sm:items-center">
                <span className="text-muted-foreground">#{candidate.rank}</span>
                <span className="truncate text-foreground">{candidate.label}</span>
                <span className={`${actionTone(candidate.decision)} w-fit border px-2 py-1 uppercase tracking-[0.12em]`}>
                  {candidate.estimated_bps_at_risk.toFixed(2)} bps
                </span>
              </div>
            ))}
            {!ranking && <div className="text-sm text-muted-foreground">Run the guard to rank candidate routes.</div>}
          </div>
        )}
      </div>

      <div className="intel-panel p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="data-label mb-2">// Liquidations</p>
            <h3 className="text-lg font-semibold text-foreground">Keeper regime watch.</h3>
          </div>
        </div>
        {loading && liquidationFirewall.length === 0 ? (
          <div className="h-32 animate-pulse bg-muted/50" />
        ) : (
          <div className="space-y-2">
            {liquidationFirewall.slice(0, 4).map((row) => (
              <div key={`${row.protocol}-${row.market}`} className="grid gap-2 border border-border/60 bg-background/25 p-3 text-sm sm:grid-cols-[5rem_1fr_auto] sm:items-center">
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-primary">{row.protocol}</span>
                <span className="truncate text-muted-foreground">{row.market}</span>
                <span className={`${actionTone(row.regime)} w-fit border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]`}>
                  {formatAction(row.regime)} · {formatUsd(row.estimated_loss_preventable_usd_24h)}
                </span>
              </div>
            ))}
            {liquidationFirewall.length === 0 && <div className="text-sm text-muted-foreground">No liquidation regimes loaded yet.</div>}
          </div>
        )}
      </div>
    </section>
  );
}

function SdkExplainer() {
  const snippet = `await intelleum.planProtectedSend(route);`;

  return (
    <div className="intel-panel p-5">
      <p className="data-label mb-3">// What Is The SDK?</p>
      <h2 className="text-lg font-semibold text-foreground">SDK = code integration.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Teams call Intelleum inside their own app before sending a transaction.
      </p>
      <pre className="mt-4 overflow-x-auto border border-border/70 bg-background/60 p-4 text-xs leading-6 text-foreground">
        <code>{snippet}</code>
      </pre>
      <Link
        to="/intel-api"
        className="mt-4 inline-flex min-h-10 items-center border border-primary/50 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Open API docs
      </Link>
    </div>
  );
}
