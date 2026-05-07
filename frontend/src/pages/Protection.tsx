import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, PreventionGuard, RouteEvaluation, RouteRanking } from "@/lib/api";
import InfoHint from "@/components/InfoHint";

type Objective = "best_execution" | "protect_users" | "protect_lp" | "monitor_only";

type Scenario = {
  id: string;
  label: string;
  headline: string;
  protocol: string;
  route_key: string;
  input_mint: string;
  output_mint: string;
  defaultNotional: number;
  slippageBps: number;
  notes: string[];
};

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const scenarios: Scenario[] = [
  {
    id: "raydium-toxic",
    label: "Toxic SOL/USDC Raydium Route",
    headline: "Known sandwich pressure",
    protocol: "raydium_amm",
    route_key: `route:raydium_amm:${SOL}->${USDC}`,
    input_mint: SOL,
    output_mint: USDC,
    defaultNotional: 85_000,
    slippageBps: 50,
    notes: ["High sandwich concentration", "Bundle pressure", "Repeat operator surface"],
  },
  {
    id: "meteora-jit",
    label: "Meteora JIT Liquidity Window",
    headline: "JIT liquidity pressure",
    protocol: "meteora_dlmm",
    route_key: `venue:meteora_dlmm:${SOL}->${USDC}`,
    input_mint: SOL,
    output_mint: USDC,
    defaultNotional: 42_500,
    slippageBps: 40,
    notes: ["LP add/remove bracket risk", "Adverse selection", "Route quality decay"],
  },
  {
    id: "orca-monitor",
    label: "Orca Monitored Alternative",
    headline: "Safer fallback candidate",
    protocol: "orca_whirlpool",
    route_key: `venue:orca_whirlpool:${USDC}->${SOL}`,
    input_mint: USDC,
    output_mint: SOL,
    defaultNotional: 25_000,
    slippageBps: 30,
    notes: ["Lower route pressure", "Monitor instead of block", "Candidate for reroute"],
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

function formatAction(value: string | undefined) {
  if (!value) return "Waiting";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function actionTone(action: PreventionGuard["action"] | RouteEvaluation["decision"] | undefined) {
  if (action === "block" || action === "avoid") return "border-red-500/50 bg-red-500/10 text-red-300";
  if (action === "reroute" || action === "penalize") return "border-yellow-500/50 bg-yellow-500/10 text-yellow-300";
  if (action === "allow") return "border-green-500/50 bg-green-500/10 text-green-300";
  return "border-primary/40 bg-primary/10 text-primary";
}

function buildCandidates(current: Scenario) {
  return scenarios.map((scenario) => ({
    route_key: scenario.route_key,
    label: scenario.label,
    protocol: scenario.protocol,
    input_mint: scenario.input_mint,
    output_mint: scenario.output_mint,
  })).filter((candidate) => candidate.route_key !== current.route_key).concat({
    route_key: current.route_key,
    label: current.label,
    protocol: current.protocol,
    input_mint: current.input_mint,
    output_mint: current.output_mint,
  });
}

export default function Protection() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const [notional, setNotional] = useState(String(scenario.defaultNotional));
  const [slippage, setSlippage] = useState(String(scenario.slippageBps));
  const [objective, setObjective] = useState<Objective>("protect_users");
  const [guard, setGuard] = useState<PreventionGuard | null>(null);
  const [ranking, setRanking] = useState<RouteRanking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const notionalUsd = useMemo(() => Number(notional.replace(/,/g, "")) || 0, [notional]);
  const slippageBps = useMemo(() => Number(slippage.replace(/,/g, "")) || 0, [slippage]);
  const weeklySavingsProxy = (guard?.expected_loss_at_risk_usd ?? 0) * 280;

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
        candidates: buildCandidates(scenario),
      };
      const [nextGuard, nextRanking] = await Promise.all([
        api.preventionGuard(payload),
        api.rankRoutes(payload),
      ]);
      setGuard(nextGuard);
      setRanking(nextRanking);
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
      <section className="relative overflow-hidden px-4 py-5 md:px-6 md:py-6">
        <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.12),transparent_28%),radial-gradient(circle_at_90%_0%,hsl(var(--destructive)/0.10),transparent_22%)]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-3 border-b border-border/70 pb-4 font-mono text-xs tracking-[0.18em] text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3">
            <Link to="/" className="min-h-10 border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Home
            </Link>
            <Link to="/dashboard" className="min-h-10 border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Dashboard
            </Link>
            <Link to="/intel-api" className="min-h-10 border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              API
            </Link>
            </div>
            <div className="flex min-h-10 items-center gap-2 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-glow" />
              Protection Firewall
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-5 grid gap-4 lg:grid-cols-3"
          >
            <div className="intel-panel-glow p-5 md:p-6 lg:col-span-2">
              <p className="data-label mb-3">// Pre-Trade Enforcement</p>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                Block toxic routes before execution.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                Pick a route, trade size, and protection objective. Intelleum scores the execution surface before the trade lands, then returns a policy decision with estimated loss at risk.
              </p>
            </div>

            <div className="intel-panel p-5 md:p-6">
              <p className="data-label mb-3">// What It Does</p>
              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>It acts like a firewall for Solana order flow.</p>
                <p>Routers, wallets, LP desks, and trading systems can call this before execution to block, reroute, or downrank a toxic route.</p>
              </div>
            </div>
          </motion.div>

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Decision", formatAction(guard?.action)],
                  ["Loss at risk", formatUsd(guard?.expected_loss_at_risk_usd)],
                  ["Projected weekly risk", formatUsd(weeklySavingsProxy)],
                ].map(([label, value]) => (
                  <div key={label} className="intel-panel p-4">
                    <div className="text-[10px] tracking-[0.18em] text-muted-foreground">{label}</div>
                    <div className="mt-2 font-mono text-lg text-primary">{value}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="intel-panel p-5 md:p-6" aria-busy={loading}>
                <fieldset className="space-y-4">
                  <legend className="mb-4 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    Route Simulator <InfoHint text="This calls the same prevention guard endpoint an integrator would use before sending a route." />
                  </legend>

                  <div className="space-y-2">
                    <label htmlFor="scenario" className="block text-xs tracking-[0.12em] text-foreground">
                      Execution Surface
                    </label>
                    <select
                      id="scenario"
                      value={scenarioId}
                      onChange={(event) => setScenarioId(event.target.value)}
                      className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {scenarios.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{scenario.headline}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label htmlFor="notional" className="block text-xs tracking-[0.12em] text-foreground">
                        Notional USD
                      </label>
                      <input
                        id="notional"
                        type="text"
                        inputMode="decimal"
                        value={notional}
                        onChange={(event) => setNotional(event.target.value)}
                        className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-describedby="notional-help"
                      />
                      <p id="notional-help" className="text-xs text-muted-foreground">Trade size used to estimate dollars at risk.</p>
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
                        onChange={(event) => setSlippage(event.target.value)}
                        className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-describedby="slippage-help"
                      />
                      <p id="slippage-help" className="text-xs text-muted-foreground">Current route tolerance from the app/router.</p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="objective" className="block text-xs tracking-[0.12em] text-foreground">
                        Objective
                      </label>
                      <select
                        id="objective"
                        value={objective}
                        onChange={(event) => setObjective(event.target.value as Objective)}
                        className="min-h-11 w-full border border-border bg-background px-3 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {(Object.keys(objectiveLabels) as Objective[]).map((key) => (
                          <option key={key} value={key}>{objectiveLabels[key]}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">Tune the policy for wallets, LPs, or routers.</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="min-h-11 w-full border border-primary bg-primary px-5 py-3 font-mono text-xs font-bold tracking-[0.18em] text-background transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:w-auto"
                  >
                    {loading ? "Running guard..." : "Run protection guard"}
                  </button>
                </fieldset>
              </form>

              {error && (
                <div className="mt-4 border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-4 xl:sticky xl:top-5">
              <DecisionPanel guard={guard} loading={loading} ranking={ranking} />
              <SdkProofCard scenario={scenario} notionalUsd={notionalUsd} slippageBps={slippageBps} objective={objective} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function DecisionPanel({
  guard,
  loading,
  ranking,
}: {
  guard: PreventionGuard | null;
  loading: boolean;
  ranking: RouteRanking | null;
}) {
  if (loading && !guard) {
    return (
      <div className="intel-panel p-5">
        <div className="h-4 w-40 animate-pulse bg-muted" />
        <div className="mt-4 h-24 animate-pulse bg-muted/60" />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="h-20 animate-pulse bg-muted/50" />
          <div className="h-20 animate-pulse bg-muted/50" />
          <div className="h-20 animate-pulse bg-muted/50" />
        </div>
      </div>
    );
  }

  if (!guard) {
    return (
      <div className="intel-panel p-5 text-sm text-muted-foreground">
        Run the protection guard to see the route decision.
      </div>
    );
  }

  return (
    <motion.div
      key={`${guard.action}-${guard.expected_loss_at_risk_usd}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="intel-panel-glow p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="data-label">// Guard Decision</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {guard.warning}
          </h2>
        </div>
        <div className={`border px-4 py-2 font-mono text-xs tracking-[0.18em] ${actionTone(guard.action)}`}>
          {formatAction(guard.action)}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Metric label="Expected loss" value={formatUsd(guard.expected_loss_at_risk_usd)} />
        <Metric label="Bps at risk" value={`${guard.expected_loss_at_risk_bps.toFixed(2)} bps`} />
        <Metric label="Safe size" value={formatUsd(guard.recommended_max_notional_usd)} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="border border-border/70 bg-background/25 p-4">
          <div className="text-[10px] tracking-[0.18em] text-muted-foreground">Reason codes</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {guard.reason_codes.length > 0 ? guard.reason_codes.map((reason) => (
              <span key={reason} className="border border-border/70 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-primary">
                {formatAction(reason)}
              </span>
            )) : (
              <span className="text-xs text-muted-foreground">No severe reason codes attached.</span>
            )}
          </div>
        </div>

        <div className="border border-border/70 bg-background/25 p-4">
          <div className="text-[10px] tracking-[0.18em] text-muted-foreground">Safer alternatives</div>
          <div className="mt-3 space-y-2">
            {guard.safer_alternatives.length > 0 ? guard.safer_alternatives.map((route) => (
              <div key={route.route_key} className="flex items-center justify-between gap-3 border border-border/50 px-3 py-2 font-mono text-xs">
                <span className="truncate text-foreground">{route.label}</span>
                <span className="shrink-0 text-cyan-300">{route.estimated_bps_saved.toFixed(2)} bps saved</span>
              </div>
            )) : (
              <div className="text-xs text-muted-foreground">No better same-pair route found yet. Monitor or cap size.</div>
            )}
          </div>
        </div>
      </div>

      {ranking && (
        <div className="mt-5 border border-border/70 bg-background/25 p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Candidate Ranking <InfoHint text="This is what a router can use to sort or remove routes before submitting the swap." />
          </div>
          <div className="space-y-2">
            {ranking.ranked_candidates.slice(0, 3).map((candidate) => (
              <div key={`${candidate.rank}-${candidate.route_key}`} className="grid gap-2 border border-border/50 px-3 py-2 font-mono text-xs md:grid-cols-4 md:items-center">
                <span className="text-muted-foreground">#{candidate.rank}</span>
                <span className="truncate text-foreground">{candidate.label}</span>
                <span className={`w-fit border px-2 py-1 ${actionTone(candidate.decision)}`}>{formatAction(candidate.decision)}</span>
                <span className="text-primary">{candidate.estimated_bps_at_risk.toFixed(2)} bps risk</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/70 bg-background/25 p-4">
      <div className="text-[10px] tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-xl text-primary">{value}</div>
    </div>
  );
}

function SdkProofCard({
  scenario,
  notionalUsd,
  slippageBps,
  objective,
}: {
  scenario: Scenario;
  notionalUsd: number;
  slippageBps: number;
  objective: Objective;
}) {
  const snippet = `await intelleum.assertSafeToExecute({
  route_key: "${scenario.route_key}",
  protocol: "${scenario.protocol}",
  notional_usd: ${notionalUsd},
  slippage_bps: ${slippageBps},
  objective: "${objective}"
});`;

  return (
    <div className="intel-panel p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="data-label">// Integration Proof</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Same decision, usable in code.</h2>
        </div>
        <div className="hidden border border-primary/40 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-primary md:block">
          SDK ready
        </div>
      </div>
      <pre className="overflow-x-auto border border-border/70 bg-background/60 p-4 text-xs leading-6 text-foreground">
        <code>{snippet}</code>
      </pre>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {scenario.notes.map((note) => (
          <div key={note} className="border border-border/60 px-3 py-2 text-[10px] tracking-[0.14em] text-muted-foreground">
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}
