import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BuyerTeam = {
  name: string;
  domain: string;
  type: string;
  buy: string;
};

type EndpointDoc = {
  id: string;
  badge: string;
  title: string;
  method: "GET" | "POST";
  endpoint: string;
  summary: string;
  whyPay: string;
  saves: string;
  buyers: string[];
  teams: BuyerTeam[];
  inputs: string[];
  returns: string[];
  integration: string[];
  curl: string;
  typescript: string;
  response: string;
};

const buyerTeams: BuyerTeam[] = [
  { name: "Jupiter", domain: "jup.ag", type: "aggregator", buy: "route risk + route ranking" },
  { name: "Orca", domain: "orca.so", type: "dex", buy: "pool toxicity + venue health" },
  { name: "Drift", domain: "drift.trade", type: "trading venue", buy: "alerts + execution-lane risk" },
  { name: "Kamino", domain: "kamino.finance", type: "protocol", buy: "LP protection + route intelligence" },
  { name: "Helius", domain: "helius.dev", type: "infra", buy: "intel exports + ops feeds" },
  { name: "Sanctum", domain: "sanctum.so", type: "staking infra", buy: "validator risk context" },
  { name: "Jito", domain: "jito.network", type: "validator infra", buy: "bundle-aware execution analytics" },
  { name: "Keyrock", domain: "keyrock.com", type: "market maker", buy: "operator + venue intelligence" },
];

const endpoints: EndpointDoc[] = [
  {
    id: "route-evaluate",
    badge: "decision api",
    title: "Pre-Trade Route Evaluation",
    method: "POST",
    endpoint: "/api/routes/evaluate",
    summary:
      "Ask Intelleum if a route should be allowed, monitored, penalized, avoided, or rerouted before your user flow touches it.",
    whyPay:
      "This is the easiest path to saved money. A router, wallet, or trading venue can check a surface pre-trade and stop repeatedly sending flow into toxic venues.",
    saves:
      "Saves user execution quality, reduces hostile routing, and quantifies estimated bps-at-risk and expected dollar loss for each route decision.",
    buyers: ["aggregators", "wallets", "perp venues", "prediction markets", "protocol routing teams"],
    teams: buyerTeams.filter((team) => ["Jupiter", "Drift", "Kamino"].includes(team.name)),
    inputs: ["route key or protocol + pair", "notional usd", "slippage bps", "objective: best execution / protect users / protect lp"],
    returns: ["decision", "risk score", "estimated bps at risk", "estimated loss usd", "safer alternatives", "integration actions"],
    integration: ["call before route submission", "attach decision to router logs", "show user-protection mode warnings", "reroute or downrank if decision is reroute / avoid"],
    curl: `curl -X POST https://api.intelleum.xyz/api/routes/evaluate \\
  -H "content-type: application/json" \\
  -d '{
    "input_mint":"So11111111111111111111111111111111111111112",
    "output_mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "protocol":"raydium_amm",
    "notional_usd":25000,
    "slippage_bps":30,
    "objective":"protect_users"
  }'`,
    typescript: `const evaluation = await api.evaluateRoute({
  input_mint: "So11111111111111111111111111111111111111112",
  output_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  protocol: "raydium_amm",
  notional_usd: 25000,
  slippage_bps: 30,
  objective: "protect_users",
});

if (evaluation.decision === "reroute" || evaluation.decision === "avoid") {
  router.blockOrFallback(evaluation.safer_alternatives);
}`,
    response: `{
  "route_key": "route:raydium_amm:SOL->USDC",
  "label": "RAYDIUM_AMM route • SOL / USDC",
  "protocol": "raydium_amm",
  "decision": "reroute",
  "risk_score": 86.4,
  "estimated_bps_at_risk": 13.72,
  "estimated_loss_usd": 34.3,
  "confidence_band": "high",
  "safer_alternatives": [
    {
      "route_key": "venue:orca_whirlpool:SOL->USDC",
      "label": "ORCA_WHIRLPOOL venue • SOL / USDC",
      "risk_score": 29.1,
      "estimated_bps_saved": 8.47
    }
  ]
}`,
  },
  {
    id: "route-rank",
    badge: "routing api",
    title: "Candidate Route Ranking",
    method: "POST",
    endpoint: "/api/routes/rank",
    summary:
      "Send multiple candidate venues or route keys and get a ranked output that tells your system which path to take and how much loss you likely avoid.",
    whyPay:
      "Teams pay for this because it plugs directly into smart order routing. It is not just analytics after the fact — it is a policy engine for execution quality.",
    saves:
      "Saves money by selecting the lower-risk route among competing surfaces and quantifying estimated loss avoided on the trade.",
    buyers: ["aggregators", "wallets", "smart order routers", "trading infra"],
    teams: buyerTeams.filter((team) => ["Jupiter", "Drift", "Keyrock"].includes(team.name)),
    inputs: ["pair + candidate routes", "notional usd", "objective", "slippage bps"],
    returns: ["ranked candidates", "selected route", "primary action", "estimated loss avoided usd"],
    integration: ["run after quote generation", "rank route plans before final submission", "log avoided venues for routing model training"],
    curl: `curl -X POST https://api.intelleum.xyz/api/routes/rank \\
  -H "content-type: application/json" \\
  -d '{
    "input_mint":"So11111111111111111111111111111111111111112",
    "output_mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "notional_usd":50000,
    "objective":"best_execution",
    "candidates":[
      { "route_key":"route:raydium_amm:SOL->USDC" },
      { "route_key":"venue:orca_whirlpool:SOL->USDC" },
      { "route_key":"route:meteora_dlmm:SOL->USDC" }
    ]
  }'`,
    typescript: `const ranked = await api.rankRoutes({
  input_mint: "So11111111111111111111111111111111111111112",
  output_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  notional_usd: 50000,
  objective: "best_execution",
  candidates: routePlan.map((route) => ({ route_key: route.route_key })),
});

router.select(ranked.selected_route_key);
analytics.track("loss_avoided", ranked.estimated_loss_avoided_usd);`,
    response: `{
  "selected_route_key": "venue:orca_whirlpool:SOL->USDC",
  "selected_label": "ORCA_WHIRLPOOL venue • SOL / USDC",
  "primary_action": "route",
  "estimated_loss_avoided_usd": 57.84,
  "ranked_candidates": [
    {
      "rank": 1,
      "decision": "allow",
      "risk_score": 24.6,
      "estimated_bps_at_risk": 3.1
    },
    {
      "rank": 2,
      "decision": "penalize",
      "risk_score": 61.3,
      "estimated_bps_at_risk": 9.8
    }
  ]
}`,
  },
  {
    id: "live-alerts",
    badge: "ops api",
    title: "Live Alerts API",
    method: "GET",
    endpoint: "/api/integrations/live-alerts",
    summary:
      "Webhook-friendly live alerts that tell an ops, routing, or fraud system when a route or venue becomes actively hostile.",
    whyPay:
      "Minutes matter during repeated toxic flow. Teams pay to stop repeated damage, notify support, and quickly understand why a route should be blocked or penalized.",
    saves:
      "Cuts response time, reduces repeated harmful routing, and gives support/risk teams the exact rationale behind the action.",
    buyers: ["protocol ops teams", "wallet teams", "risk desks", "validators", "infra teams"],
    teams: buyerTeams.filter((team) => ["Drift", "Sanctum", "Helius"].includes(team.name)),
    inputs: ["limit", "live polling or webhook consumption"],
    returns: ["severity", "action", "route label", "bundle likelihood", "validator context", "rationale"],
    integration: ["poll or webhook into Slack/PagerDuty", "auto-open incidents on critical routes", "attach alerts to support dashboards"],
    curl: `curl https://api.intelleum.xyz/api/integrations/live-alerts?limit=10`,
    typescript: `const alerts = await api.liveAlerts(10);

for (const alert of alerts) {
  if (alert.action === "block") {
    ops.notify(alert.summary, alert.rationale);
  }
}`,
    response: `[
  {
    "severity": "critical",
    "action": "block",
    "route_label": "RAYDIUM_AMM route • SOL / USDC",
    "validator": "Jito-Validator-Alpha",
    "confidence": 94,
    "bundle_likelihood": 68,
    "rationale": [
      "sandwich detector fired at 94% confidence",
      "bundle likelihood is elevated at 68%"
    ]
  }
]`,
  },
  {
    id: "route-risk",
    badge: "intel api",
    title: "Route Risk API",
    method: "GET",
    endpoint: "/api/routes/risk",
    summary:
      "Surface-level risk rankings for venues, routes, and pair-specific execution surfaces, including bundle share and attacker concentration.",
    whyPay:
      "This is the route-weighting layer buyers use to calibrate routing models and venue exposure before they commit to full decision automation.",
    saves:
      "Helps teams downrank or monitor toxic surfaces before they turn into repeated bad fills or LP drag.",
    buyers: ["routers", "wallets", "dexes", "risk teams"],
    teams: buyerTeams.filter((team) => ["Jupiter", "Orca", "Kamino"].includes(team.name)),
    inputs: ["limit"],
    returns: ["risk score", "bundle share", "attack mix", "unique attackers", "recommendation"],
    integration: ["use as a feature in internal routing models", "display route health in internal ops dashboards", "store daily route-risk snapshots"],
    curl: `curl https://api.intelleum.xyz/api/routes/risk?limit=20`,
    typescript: `const routeRisk = await api.routeRisks(20);
const avoid = routeRisk.filter((route) => route.recommendation === "avoid");`,
    response: `[
  {
    "route_key": "route:raydium_amm:SOL->USDC",
    "protocol": "raydium_amm",
    "risk_score": 93,
    "recommendation": "avoid",
    "bundle_share": 67,
    "unique_attackers": 11
  }
]`,
  },
  {
    id: "route-recommendations",
    badge: "policy api",
    title: "Route Recommendations API",
    method: "GET",
    endpoint: "/api/routes/recommendations",
    summary:
      "Pair-level route recommendations that convert observed toxicity into a simpler prefer / monitor / avoid decision set.",
    whyPay:
      "Not every team wants full policy logic on day one. This gives them a lighter-weight recommendation layer that is still production-useful.",
    saves:
      "Helps teams reduce exposure to bad venues even if they are not yet ready to implement the full ranking or evaluation APIs.",
    buyers: ["dex frontends", "wallets", "protocol ops", "research teams"],
    teams: buyerTeams.filter((team) => ["Jupiter", "Orca"].includes(team.name)),
    inputs: ["limit"],
    returns: ["recommended routes", "avoid routes", "pair-level rationale"],
    integration: ["show route safety badges", "seed default venue weights", "feed internal dashboards and watchlists"],
    curl: `curl https://api.intelleum.xyz/api/routes/recommendations?limit=12`,
    typescript: `const recommendations = await api.routeRecommendations(12);
const solUsdc = recommendations.find((pair) => pair.input_mint && pair.output_mint);`,
    response: `[
  {
    "input_mint": "So111...",
    "output_mint": "EPjF...",
    "recommended_routes": [
      { "label": "ORCA_WHIRLPOOL venue • SOL / USDC", "recommendation": "prefer", "risk_score": 24.6 }
    ],
    "avoid_routes": [
      { "label": "RAYDIUM_AMM route • SOL / USDC", "risk_score": 93.0 }
    ]
  }
]`,
  },
  {
    id: "pool-toxicity",
    badge: "liquidity api",
    title: "Pool Toxicity Feed",
    method: "GET",
    endpoint: "/api/pools",
    summary:
      "Rank pools and venue surfaces by extraction pressure, attack counts, attacker concentration, and total extracted value.",
    whyPay:
      "DEXes, LP platforms, and market makers pay to know where liquidity is getting punished so they can protect incentives, rebalance, or de-emphasize bad venues.",
    saves:
      "Reduces LP drag, protects emissions and incentives, and helps internal teams spot where venue quality is degrading.",
    buyers: ["dexes", "lp venues", "vaults", "market makers"],
    teams: buyerTeams.filter((team) => ["Orca", "Kamino", "Keyrock"].includes(team.name)),
    inputs: ["limit"],
    returns: ["toxicity score", "extracted value", "attacker concentration", "top entity pressure"],
    integration: ["rank pools in internal LP dashboards", "adjust incentives", "drive venue health monitoring"],
    curl: `curl https://api.intelleum.xyz/api/pools?limit=25`,
    typescript: `const pools = await api.pools(25);
const highestToxicity = pools[0];`,
    response: `[
  {
    "protocol": "orca",
    "toxicity_score": 69,
    "total_extracted_usd": 39240,
    "unique_attackers": 14,
    "top_entity_label": "B91 Sandwich Cluster"
  }
]`,
  },
  {
    id: "validator-risk",
    badge: "validator api",
    title: "Validator Risk Feed",
    method: "GET",
    endpoint: "/api/validators",
    summary:
      "Track validator-linked MEV patterns, sandwich concentration, wide-bracket activity, and priority-fee pressure.",
    whyPay:
      "Teams that care about tx delivery, staking, validator allocation, or execution quality pay for validator context because ordering conditions shape downstream outcomes.",
    saves:
      "Improves validator monitoring, tx-delivery awareness, and execution-lane understanding in systems where latency and ordering quality matter.",
    buyers: ["validator infra", "staking protocols", "infra teams", "research desks"],
    teams: buyerTeams.filter((team) => ["Sanctum", "Jito", "Helius"].includes(team.name)),
    inputs: ["none"],
    returns: ["risk score", "sandwich share", "confirmed share", "tip pressure", "unique entities"],
    integration: ["score validator partners", "monitor bundle-heavy windows", "combine with tx-delivery analytics"],
    curl: `curl https://api.intelleum.xyz/api/validators`,
    typescript: `const validators = await api.validators();
const highestRisk = validators.sort((a, b) => b.risk_score - a.risk_score)[0];`,
    response: `[
  {
    "validator": "Jito-Validator-Alpha",
    "risk_score": 84,
    "sandwich_share": 0.62,
    "wide_sandwich_share": 0.39
  }
]`,
  },
];

const sections = [
  { id: "overview", label: "Overview" },
  { id: "integration-flow", label: "How They Integrate" },
  { id: "packages", label: "Products" },
  ...endpoints.map((endpoint) => ({ id: endpoint.id, label: endpoint.title })),
  { id: "commercial-proof", label: "Why They Pay" },
];

const faviconUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

function TeamPills({ teams }: { teams: BuyerTeam[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((team) => (
        <Tooltip key={team.name}>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 border border-border/70 bg-background/60 px-4 py-2.5">
              <img src={faviconUrl(team.domain)} alt={team.name} className="h-6 w-6 object-contain" loading="lazy" />
              <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-foreground">{team.name}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {team.name} · {team.type}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function EndpointSection({
  endpoint,
  active,
  onActivate,
}: {
  endpoint: EndpointDoc;
  active: boolean;
  onActivate: (id: string) => void;
}) {
  return (
    <section id={endpoint.id} className="scroll-mt-24 border border-border/70 bg-surface/35 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-primary">{endpoint.badge}</div>
          <h2 className="mt-3 text-[2.1rem] font-semibold tracking-tight text-foreground">{endpoint.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[13px] uppercase tracking-[0.14em] text-primary">
              {endpoint.method}
            </div>
            <div className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground">{endpoint.endpoint}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onActivate(endpoint.id)}
          className={`border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
            active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/70 bg-background/50 text-muted-foreground hover:text-primary"
          }`}
        >
          view examples
        </button>
      </div>

      <p className="mt-5 max-w-4xl text-[17px] leading-8 text-foreground">{endpoint.summary}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="border border-border/70 bg-background/50 p-5">
          <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-primary">Why Teams Pay</div>
          <p className="mt-3 text-[16px] leading-8 text-foreground">{endpoint.whyPay}</p>
        </div>
        <div className="border border-border/70 bg-background/50 p-5">
          <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-primary">How It Saves Money</div>
          <p className="mt-3 text-[16px] leading-8 text-foreground">{endpoint.saves}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr,1fr,1fr]">
        <div className="border border-border/70 bg-background/50 p-5">
          <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">Inputs</div>
          <div className="mt-3 space-y-2">
            {endpoint.inputs.map((item) => (
              <div key={item} className="flex gap-3">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="font-mono text-[14px] leading-7 text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-border/70 bg-background/50 p-5">
          <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">Returns</div>
          <div className="mt-3 space-y-2">
            {endpoint.returns.map((item) => (
              <div key={item} className="flex gap-3">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="font-mono text-[14px] leading-7 text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-border/70 bg-background/50 p-5">
          <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">Integration Pattern</div>
          <div className="mt-3 space-y-2">
            {endpoint.integration.map((item) => (
              <div key={item} className="flex gap-3">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="font-mono text-[14px] leading-7 text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">Buyer Profiles</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {endpoint.buyers.map((buyer) => (
            <div
              key={buyer}
              className="border border-border/70 bg-background/60 px-4 py-2 font-mono text-[13px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              {buyer}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">Relevant Buyer Teams</div>
        <div className="mt-3">
          <TeamPills teams={endpoint.teams} />
        </div>
      </div>
    </section>
  );
}

function StickyCodePanel({ endpoint }: { endpoint: EndpointDoc }) {
  return (
    <div className="sticky top-8 space-y-4">
      <div className="border border-border/70 bg-surface/50 p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Live Reference</div>
        <h3 className="mt-3 text-xl font-semibold text-foreground">{endpoint.title}</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
            {endpoint.method}
          </div>
          <div className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground">{endpoint.endpoint}</div>
        </div>
        <p className="mt-4 text-[15px] leading-8 text-muted-foreground">{endpoint.summary}</p>
      </div>

      <div className="border border-border/70 bg-background/70 p-4">
        <Tabs defaultValue="curl">
          <TabsList className="grid w-full grid-cols-3 bg-surface/60">
            <TabsTrigger value="curl" className="font-mono text-[11px] uppercase tracking-[0.12em]">Curl</TabsTrigger>
            <TabsTrigger value="typescript" className="font-mono text-[11px] uppercase tracking-[0.12em]">TS</TabsTrigger>
            <TabsTrigger value="response" className="font-mono text-[11px] uppercase tracking-[0.12em]">Response</TabsTrigger>
          </TabsList>
          <TabsContent value="curl">
            <pre className="mt-4 overflow-x-auto border border-border/70 bg-background p-4 font-mono text-[12px] leading-6 text-primary">
{endpoint.curl}
            </pre>
          </TabsContent>
          <TabsContent value="typescript">
            <pre className="mt-4 overflow-x-auto border border-border/70 bg-background p-4 font-mono text-[12px] leading-6 text-primary">
{endpoint.typescript}
            </pre>
          </TabsContent>
          <TabsContent value="response">
            <pre className="mt-4 overflow-x-auto border border-border/70 bg-background p-4 font-mono text-[12px] leading-6 text-primary">
{endpoint.response}
            </pre>
          </TabsContent>
        </Tabs>
      </div>

      <div className="border border-border/70 bg-surface/40 p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">Why This Matters</div>
        <p className="mt-3 text-[15px] leading-8 text-foreground">{endpoint.saves}</p>
      </div>
    </div>
  );
}

export default function IntelApi() {
  const [activeId, setActiveId] = useState<string>("overview");
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const activeEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === activeId) ?? null,
    [activeId],
  );
  const activeExampleEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === activeExampleId) ?? null,
    [activeExampleId],
  );

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-[1600px]">
        <Link
          to="/"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary"
        >
          ← back home
        </Link>

        <div className={`mt-8 grid gap-8 ${activeExampleEndpoint ? "xl:grid-cols-[360px,minmax(0,1fr),420px]" : "xl:grid-cols-[360px,minmax(0,1fr)]"}`}>
          <aside className="self-start">
            <div className="min-h-[calc(100vh-9rem)] border border-border/70 bg-surface/35 p-7">
              <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">On This Page</div>
              <div className="mt-5 space-y-2.5">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      const isEndpoint = endpoints.some((endpoint) => endpoint.id === section.id);
                      setActiveId(section.id);
                      if (!isEndpoint) {
                        setActiveExampleId(null);
                      }
                    }}
                    className={`block w-full text-left font-mono text-[14px] uppercase leading-7 tracking-[0.16em] transition-colors ${
                      section.id === activeId
                        ? "text-primary"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div>
            {activeId === "overview" && (
              <section id="overview" className="border border-border/70 bg-surface/35 p-8">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr),360px]">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">// intelleum api</div>
                    <h1 className="mt-4 max-w-5xl text-4xl font-semibold tracking-tight md:text-6xl">
                      Orderflow intelligence that routers, venues, and risk teams can actually integrate.
                    </h1>
                    <p className="mt-5 max-w-4xl text-base leading-8 text-muted-foreground md:text-lg">
                      Intelleum is not just a dashboard. It is a production-facing decision layer for Solana orderflow. The core
                      buyer story is simple: route less flow into toxic surfaces, react faster when hostile execution appears,
                      and quantify how much money better routing can save.
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                      <div className="border border-border/70 bg-background/50 p-5">
                        <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-primary">what teams buy</div>
                        <p className="mt-3 text-[15px] leading-7 text-foreground">decision APIs, route scoring, live alerts, pool toxicity, validator context, and operator intelligence.</p>
                      </div>
                      <div className="border border-border/70 bg-background/50 p-5">
                        <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-primary">how they integrate</div>
                        <p className="mt-3 text-[15px] leading-7 text-foreground">call pre-trade, rank route candidates, downrank bad venues, trigger alerts, and feed route policy back into execution systems.</p>
                      </div>
                      <div className="border border-border/70 bg-background/50 p-5">
                        <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-primary">why they pay</div>
                        <p className="mt-3 text-[15px] leading-7 text-foreground">because avoiding even small amounts of toxic routing or LP drag can justify recurring spend on meaningful volume.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-border/70 bg-background/50 p-5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">buyer map</div>
                    <div className="mt-4 space-y-3">
                      {buyerTeams.map((team) => (
                        <div key={team.name} className="flex items-center justify-between gap-3 border border-border/70 bg-surface/40 px-3 py-3">
                          <div className="flex items-center gap-3">
                            <img src={faviconUrl(team.domain)} alt={team.name} className="h-5 w-5 object-contain" loading="lazy" />
                            <div>
                              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">{team.name}</div>
                              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{team.type}</div>
                            </div>
                          </div>
                          <div className="max-w-[150px] text-right font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                            {team.buy}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs leading-6 text-muted-foreground">
                      These are target buyer profiles and example relevant teams, not claims of existing customers.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {activeId === "integration-flow" && (
              <section id="integration-flow" className="border border-border/70 bg-surface/35 p-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">How Teams Integrate</div>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  {[
                    ["1. score", "call route risk or route evaluation before submitting a route."],
                    ["2. decide", "allow, monitor, penalize, reroute, or block based on the policy output."],
                    ["3. observe", "listen to live alerts and validator context while the route stays in rotation."],
                    ["4. learn", "store avoided routes, toxic pools, and attacker patterns to keep improving execution."],
                  ].map(([title, body]) => (
                    <div key={title} className="border border-border/70 bg-background/50 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">{title}</div>
                      <p className="mt-3 text-[15px] leading-8 text-foreground">{body}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeId === "packages" && (
              <section id="packages" className="grid gap-4 lg:grid-cols-3">
                {[
                  {
                    name: "monitor",
                    fit: "researchers, funds, risk desks",
                    text: "entity intelligence, alerts, validator context, route snapshots, and pool exports for teams that want visibility first.",
                  },
                  {
                    name: "integrate",
                    fit: "routers, wallets, dexes, LP venues",
                    text: "route evaluation, route ranking, live alerts, route recommendations, and pool toxicity feeds for production systems.",
                  },
                  {
                    name: "enterprise",
                    fit: "high-volume protocols and infra teams",
                    text: "custom policies, higher limits, longer retention, tailored venue intelligence, and support for route-policy tuning.",
                  },
                ].map((pkg) => (
                  <motion.div
                    key={pkg.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-border/70 bg-surface/35 p-6"
                  >
                    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{pkg.name}</div>
                    <div className="mt-3 text-lg font-semibold text-foreground">{pkg.fit}</div>
                    <p className="mt-4 text-[15px] leading-8 text-foreground">{pkg.text}</p>
                  </motion.div>
                ))}
              </section>
            )}

            {activeEndpoint && (
              <EndpointSection
                endpoint={activeEndpoint}
                active={activeEndpoint.id === activeId}
                onActivate={(id) => {
                  setActiveId(id);
                  setActiveExampleId(id);
                }}
              />
            )}

            {activeId === "commercial-proof" && (
              <section id="commercial-proof" className="grid gap-6 lg:grid-cols-2">
                <div className="border border-border/70 bg-surface/35 p-6">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Where The Savings Come From</div>
                  <div className="mt-4 space-y-3 text-[15px] leading-8 text-foreground">
                    <p>Routers save money by downranking or avoiding routes that carry repeat sandwiching, bundle-heavy execution, or concentrated hostile operators.</p>
                    <p>DEXes and LP venues save money by detecting toxic pools earlier, protecting liquidity, and reducing repeated extraction drag on incentives and LP capital.</p>
                    <p>Wallets and trading venues save money by improving execution quality and preventing users from repeatedly touching hostile surfaces.</p>
                    <p>Validators, staking infra, and risk teams save money by understanding execution-lane pressure, bundle concentration, and repeat operator behavior faster.</p>
                  </div>
                </div>

                <div className="border border-border/70 bg-surface/35 p-6">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Why This Can Be Bought Today</div>
                  <div className="mt-4 space-y-3 text-[15px] leading-8 text-muted-foreground">
                    <p>The API surface now includes pre-trade scoring, candidate ranking, and live alerting, which means buyers can integrate actions, not just dashboards.</p>
                    <p>Each endpoint is built around a real operational workflow: scoring routes, ranking venue options, flagging toxic pools, monitoring validators, and tracking entities.</p>
                    <p>The core commercial pitch is that Intelleum helps teams spend less flow on bad execution and react faster when hostile behavior is already active.</p>
                  </div>
                </div>
              </section>
            )}
          </div>

          {activeExampleEndpoint && <StickyCodePanel endpoint={activeExampleEndpoint} />}
        </div>
      </div>
    </main>
  );
}
