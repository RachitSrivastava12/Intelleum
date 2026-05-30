import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, IssuedApiKeyResponse } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuyerTeam = {
  name: string;
  domain: string;
  type: string;
  buy: string;
};

type InputParam = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

type ResponseField = {
  name: string;
  type: string;
  description: string;
};

type EndpointDoc = {
  id: string;
  badge: string;
  title: string;
  method: "GET" | "POST";
  endpoint: string;
  description: string;
  whenToUse: string;
  inputs: InputParam[];
  responseFields: ResponseField[];
  teams: BuyerTeam[];
  curl: string;
  typescript: string;
  response: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.intelleum.in";
const LOCAL_BASE_URL = "http://localhost:8081";
const AUTH_HEADER = "x-api-key";
const EXAMPLE_API_KEY = "intelleum_local_dev_key";
const EXAMPLE_WALLET = "7W8B9uM1pT4qZ5xC6vN7mK2rS3dF8hJ9lP2qR4tY6uA";

const buyerTeams: BuyerTeam[] = [
  { name: "Jupiter",  domain: "jup.ag",        type: "Aggregator",      buy: "Route risk + ranking"            },
  { name: "Orca",     domain: "orca.so",        type: "DEX",             buy: "Pool toxicity + venue health"    },
  { name: "Kamino",   domain: "kamino.finance", type: "Protocol",        buy: "LP protection + route intel"     },
  { name: "Helius",   domain: "helius.dev",     type: "Infra",           buy: "Intel exports + ops feeds"       },
  { name: "Sanctum",  domain: "sanctum.so",     type: "Staking Infra",   buy: "Validator risk context"          },
  { name: "Jito",     domain: "jito.network",   type: "Validator Infra", buy: "Bundle-aware execution analytics"},
  { name: "Keyrock",  domain: "keyrock.com",    type: "Market Maker",    buy: "Operator + venue intelligence"   },
];

const endpoints: EndpointDoc[] = [
  {
    id: "route-evaluate",
    badge: "Decision API",
    title: "Pre-Trade Route Evaluation",
    method: "POST",
    endpoint: "/api/routes/evaluate",
    description:
      "Before a user's trade touches a route, ask Intelleum whether it is safe. The API returns a decision (allow / monitor / penalize / avoid / reroute) backed by live MEV detections, attacker concentration, bundle share, and historical extraction on that surface.",
    whenToUse:
      "Call this endpoint inside your router logic immediately before final route selection. If the decision is reroute or avoid, swap to one of the safer_alternatives returned in the response.",
    inputs: [
      { name: "input_mint",   type: "string", required: true,  description: "Base token mint address (Solana pubkey)"                    },
      { name: "output_mint",  type: "string", required: true,  description: "Quote token mint address (Solana pubkey)"                   },
      { name: "protocol",     type: "string", required: true,  description: "Route protocol slug, e.g. raydium_amm, orca_whirlpool"      },
      { name: "notional_usd", type: "number", required: true,  description: "Trade size in USD"                                          },
      { name: "slippage_bps", type: "number", required: true,  description: "Max slippage tolerance in basis points"                     },
      { name: "objective",    type: "enum",   required: false, description: "protect_users | best_execution | protect_lp (default: protect_users)" },
    ],
    responseFields: [
      { name: "decision",              type: "string",  description: "allow | monitor | penalize | avoid | reroute"          },
      { name: "risk_score",            type: "number",  description: "0–100, higher = more toxic"                             },
      { name: "estimated_bps_at_risk", type: "number",  description: "Expected slippage loss in basis points"                 },
      { name: "estimated_loss_usd",    type: "number",  description: "Estimated dollar loss at the given notional"            },
      { name: "confidence_band",       type: "string",  description: "high | medium | low — detector confidence tier"         },
      { name: "safer_alternatives",    type: "array",   description: "Ranked list of lower-risk routes with estimated savings" },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Kamino"].includes(t.name)),
    curl: `curl -X POST ${BASE_URL}/api/routes/evaluate \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "input_mint":   "So11111111111111111111111111111111111111112",
    "output_mint":  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "protocol":     "raydium_amm",
    "notional_usd": 25000,
    "slippage_bps": 30,
    "objective":    "protect_users"
  }'`,
    typescript: `const res = await fetch("${BASE_URL}/api/routes/evaluate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.INTELLEUM_API_KEY!,
  },
  body: JSON.stringify({
    input_mint:   "So11111111111111111111111111111111111111112",
    output_mint:  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    protocol:     "raydium_amm",
    notional_usd: 25000,
    slippage_bps: 30,
    objective:    "protect_users",
  }),
});

const data = await res.json();

if (data.decision === "avoid" || data.decision === "reroute") {
  // Route to safer alternative
  return router.useFallback(data.safer_alternatives[0].route_key);
}`,
    response: `{
  "route_key":             "route:raydium_amm:SOL->USDC",
  "label":                 "RAYDIUM_AMM route · SOL / USDC",
  "decision":              "reroute",
  "risk_score":            86.4,
  "estimated_bps_at_risk": 13.72,
  "estimated_loss_usd":    34.3,
  "confidence_band":       "high",
  "safer_alternatives": [
    {
      "route_key":           "venue:orca_whirlpool:SOL->USDC",
      "label":               "ORCA_WHIRLPOOL venue · SOL / USDC",
      "risk_score":          29.1,
      "estimated_bps_saved": 8.47
    }
  ]
}`,
  },
  {
    id: "route-rank",
    badge: "Routing API",
    title: "Candidate Route Ranking",
    method: "POST",
    endpoint: "/api/routes/rank",
    description:
      "Send multiple candidate routes and receive them ranked by execution risk. The API returns the safest route as selected_route_key plus a full ranked list with per-route risk scores and estimated savings. Ideal for smart order routers that already compute multiple quote paths.",
    whenToUse:
      "Call after your quote engine has produced N candidate routes but before final route selection. Use selected_route_key as your primary route and log estimated_loss_avoided_usd for ROI tracking.",
    inputs: [
      { name: "input_mint",   type: "string", required: true,  description: "Base token mint address"                          },
      { name: "output_mint",  type: "string", required: true,  description: "Quote token mint address"                         },
      { name: "notional_usd", type: "number", required: true,  description: "Trade size in USD"                                },
      { name: "objective",    type: "enum",   required: false, description: "best_execution | protect_users | protect_lp"      },
      { name: "slippage_bps", type: "number", required: false, description: "Slippage tolerance in basis points"               },
      { name: "candidates",   type: "array",  required: true,  description: "Array of { route_key: string } to rank"          },
    ],
    responseFields: [
      { name: "selected_route_key",         type: "string", description: "Best route to use"                                 },
      { name: "primary_action",             type: "string", description: "route | monitor | fallback"                        },
      { name: "estimated_loss_avoided_usd", type: "number", description: "Estimated savings vs worst candidate"              },
      { name: "ranked_candidates",          type: "array",  description: "All candidates ordered by risk with decision + bps" },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Keyrock"].includes(t.name)),
    curl: `curl -X POST ${BASE_URL}/api/routes/rank \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "input_mint":   "So11111111111111111111111111111111111111112",
    "output_mint":  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "notional_usd": 50000,
    "objective":    "best_execution",
    "candidates": [
      { "route_key": "route:raydium_amm:SOL->USDC" },
      { "route_key": "venue:orca_whirlpool:SOL->USDC" },
      { "route_key": "route:meteora_dlmm:SOL->USDC" }
    ]
  }'`,
    typescript: `const res = await fetch("${BASE_URL}/api/routes/rank", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.INTELLEUM_API_KEY!,
  },
  body: JSON.stringify({
    input_mint:   "So11111111111111111111111111111111111111112",
    output_mint:  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    notional_usd: 50000,
    objective:    "best_execution",
    candidates:   routePlan.map((r) => ({ route_key: r.route_key })),
  }),
});

const { selected_route_key, estimated_loss_avoided_usd } = await res.json();
router.select(selected_route_key);
analytics.track("loss_avoided_usd", estimated_loss_avoided_usd);`,
    response: `{
  "selected_route_key":         "venue:orca_whirlpool:SOL->USDC",
  "primary_action":             "route",
  "estimated_loss_avoided_usd": 57.84,
  "ranked_candidates": [
    {
      "rank":       1,
      "route_key":  "venue:orca_whirlpool:SOL->USDC",
      "decision":   "allow",
      "risk_score": 24.6,
      "estimated_bps_at_risk": 3.1
    },
    {
      "rank":       2,
      "route_key":  "route:meteora_dlmm:SOL->USDC",
      "decision":   "monitor",
      "risk_score": 51.2,
      "estimated_bps_at_risk": 7.4
    },
    {
      "rank":       3,
      "route_key":  "route:raydium_amm:SOL->USDC",
      "decision":   "avoid",
      "risk_score": 86.4,
      "estimated_bps_at_risk": 13.7
    }
  ]
}`,
  },
  {
    id: "prevention-guard",
    badge: "Protection API",
    title: "Protected Send",
    method: "POST",
    endpoint: "/api/prevention/protected-send",
    description:
      "The main production protection endpoint. It returns the action plus savings proof and a protected-send policy: submit lane, fail-closed mode, max safe size, and immediate execution action.",
    whenToUse:
      "Use this before a wallet, router, or trading backend submits a transaction.",
    inputs: [
      { name: "route_key",    type: "string", required: false, description: "Exact route or venue key if known" },
      { name: "protocol",     type: "string", required: false, description: "Protocol slug, e.g. raydium_amm" },
      { name: "input_mint",   type: "string", required: true,  description: "Input token mint" },
      { name: "output_mint",  type: "string", required: true,  description: "Output token mint" },
      { name: "notional_usd", type: "number", required: true,  description: "Trade size in USD" },
      { name: "slippage_bps", type: "number", required: false, description: "Slippage tolerance in bps" },
      { name: "candidates",   type: "array",  required: false, description: "Candidate routes for reroute proof" },
    ],
    responseFields: [
      { name: "action",                 type: "string", description: "allow | monitor | penalize | reroute | block" },
      { name: "savings_proof",          type: "object", description: "Loss prevented, bps saved, monthly projection" },
      { name: "protected_send_policy",  type: "object", description: "Submit lane, fail-closed, TTL, max safe notional" },
      { name: "customer_impact",        type: "array",  description: "Who benefits: wallet, router, LP, lending, desk" },
      { name: "safer_alternatives",     type: "array",  description: "Cleaner paths when action is reroute/block" },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Kamino", "Keyrock"].includes(t.name)),
    curl: `curl -X POST ${BASE_URL}/api/prevention/protected-send \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "route_key":    "route:raydium_amm:SOL->USDC",
    "input_mint":   "So11111111111111111111111111111111111111112",
    "output_mint":  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "notional_usd": 85000,
    "slippage_bps": 50,
    "objective":    "protect_users"
  }'`,
    typescript: `const guard = await fetch("${BASE_URL}/api/prevention/protected-send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.INTELLEUM_API_KEY!,
  },
  body: JSON.stringify(route),
}).then((r) => r.json());

if (guard.action === "block") stopExecution();
if (guard.action === "reroute") useRoute(guard.safer_alternatives[0]);`,
    response: `{
  "action": "block",
  "expected_loss_at_risk_usd": 174.2,
  "savings_proof": {
    "estimated_loss_prevented_usd": 174.2,
    "monthly_savings_projection_usd": 627120,
    "estimated_bps_saved": 11.4
  },
  "protected_send_policy": {
    "mode": "block",
    "submit_via": "do_not_submit",
    "fail_closed": true,
    "max_notional_usd": 126200
  }
}`,
  },
  {
    id: "liquidation-firewall",
    badge: "Risk API",
    title: "Liquidation Firewall",
    method: "GET",
    endpoint: "/api/liquidations/firewall",
    description:
      "Protocol-level liquidation regime watch for lending and perps teams. Returns pressure, toxic liquidator share, bad-debt risk, preventable loss, and a recommended action.",
    whenToUse:
      "Pull this for risk dashboards or keeper controls. Use throttle/pause actions to protect markets during toxic liquidation regimes.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max protocol markets to return" },
    ],
    responseFields: [
      { name: "protocol",                            type: "string", description: "drift | kamino | save | marginfi" },
      { name: "regime",                              type: "string", description: "normal | watch | toxic | stress" },
      { name: "liquidation_pressure",                type: "number", description: "0-100 pressure score" },
      { name: "bad_debt_risk_bps",                   type: "number", description: "Estimated bad-debt risk in bps" },
      { name: "estimated_loss_preventable_usd_24h",  type: "number", description: "Estimated preventable loss" },
      { name: "recommended_action",                  type: "string", description: "monitor | route_private | throttle | pause" },
    ],
    teams: buyerTeams.filter((t) => ["Kamino", "Keyrock"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/liquidations/firewall?limit=4" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const regimes = await fetch("${BASE_URL}/api/liquidations/firewall?limit=4", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
}).then((r) => r.json());

for (const row of regimes) {
  if (row.recommended_action === "pause") risk.pauseMarket(row.market);
}`,
    response: `[
  {
    "protocol": "kamino",
    "market": "SOL collateral loans",
    "regime": "watch",
    "liquidation_pressure": 58,
    "bad_debt_risk_bps": 14.2,
    "estimated_loss_preventable_usd_24h": 3408,
    "recommended_action": "route_private"
  }
]`,
  },
  {
    id: "toxic-flow-terminal",
    badge: "Terminal API",
    title: "Toxic Flow Terminal",
    method: "GET",
    endpoint: "/api/terminal/toxic-flow",
    description:
      "Dexscreener-style route candles for toxic orderflow. Each surface returns price proxy candles, toxicity score, markout, LVR pressure, attack overlays, loss-at-risk, and estimated loss prevented.",
    whenToUse:
      "Use this for internal trading/risk screens. Watch toxic_flow_score and prevented_loss_24h_usd to decide when to block, reroute, or cap orderflow.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max route surfaces to return" },
      { name: "interval", type: "enum", required: false, description: "Latest detection window: 1m | 5m | 15m | 1h" },
    ],
    responseFields: [
      { name: "summary",                    type: "object", description: "Portfolio-level loss-at-risk and prevented loss" },
      { name: "surfaces",                   type: "array",  description: "Route/venue surfaces with chart candles" },
      { name: "candles.toxic_flow_score",   type: "number", description: "0-100 toxicity score per candle" },
      { name: "candles.markout_bps",        type: "number", description: "Post-trade adverse markout in bps" },
      { name: "prevented_loss_24h_usd",     type: "number", description: "Estimated loss prevented by current action" },
      { name: "overlays",                   type: "array",  description: "Attack events overlaid on the chart" },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Orca", "Kamino", "Keyrock"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/terminal/toxic-flow?limit=8&interval=1m" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const terminal = await fetch("${BASE_URL}/api/terminal/toxic-flow?limit=8&interval=1m", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
}).then((r) => r.json());

for (const surface of terminal.surfaces) {
  if (surface.action === "avoid" || surface.toxic_flow_score > 80) {
    router.block(surface.route_key);
  }
}`,
    response: `{
  "summary": {
    "surfaces_tracked": 8,
    "routes_in_block": 2,
    "estimated_prevented_loss_24h_usd": 48210
  },
  "surfaces": [
    {
      "pair": "SOL/USDC",
      "action": "reroute",
      "toxic_flow_score": 84,
      "markout_30s_bps": 18.4,
      "prevented_loss_24h_usd": 12840,
      "candles": [
        { "label": "14:05", "close": 142.12, "toxic_flow_score": 82, "markout_bps": 17.6 }
      ]
    }
  ]
}`,
  },
  {
    id: "live-alerts",
    badge: "Ops API",
    title: "Live Alerts",
    method: "GET",
    endpoint: "/api/integrations/live-alerts",
    description:
      "A live stream of hostile-flow alerts — one entry per detected MEV event on a route. Each alert includes severity, the recommended action, validator context, confidence score, bundle likelihood, and the rationale behind the classification. Poll this endpoint or hook it into your ops stack via a simple scheduler.",
    whenToUse:
      "Poll every 15–30 seconds. Pipe critical-severity alerts into Slack, PagerDuty, or your internal ops dashboard. Use action === block to auto-pause a route.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max alerts to return — default 10, max 100" },
    ],
    responseFields: [
      { name: "severity",          type: "string", description: "critical | high | medium"                      },
      { name: "action",            type: "string", description: "block | penalize | monitor"                    },
      { name: "route_label",       type: "string", description: "Human-readable route identifier"               },
      { name: "validator",         type: "string", description: "Validator that confirmed the block"            },
      { name: "confidence",        type: "number", description: "Detector confidence 0–100"                     },
      { name: "bundle_likelihood", type: "number", description: "Jito bundle probability 0–100"                 },
      { name: "rationale",         type: "array",  description: "Ordered list of supporting signals"            },
    ],
    teams: buyerTeams.filter((t) => ["Helius", "Sanctum"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/integrations/live-alerts?limit=5" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `// Poll every 15 seconds and forward critical alerts to Slack
setInterval(async () => {
  const res = await fetch(
    "${BASE_URL}/api/integrations/live-alerts?limit=10",
    { headers: { "x-api-key": process.env.INTELLEUM_API_KEY! } }
  );
  const alerts = await res.json();

  for (const alert of alerts) {
    if (alert.severity === "critical") {
      await slack.post("#mev-alerts", {
        text: \`[\${alert.action.toUpperCase()}] \${alert.route_label}\`,
        blocks: alert.rationale.map((r) => ({ type: "section", text: r })),
      });
    }
  }
}, 15_000);`,
    response: `[
  {
    "severity":          "critical",
    "action":            "block",
    "route_label":       "RAYDIUM_AMM route · SOL / USDC",
    "validator":         "Jito-Validator-Alpha",
    "confidence":        94,
    "bundle_likelihood": 68,
    "rationale": [
      "Sandwich detector fired at 94% confidence",
      "Bundle likelihood elevated at 68%",
      "B91 Cluster detected 14 times on this route in past hour"
    ]
  },
  {
    "severity":          "high",
    "action":            "penalize",
    "route_label":       "METEORA_DLMM route · SOL / USDC",
    "validator":         "Stakewiz-Pro-7",
    "confidence":        81,
    "bundle_likelihood": 22,
    "rationale": [
      "JIT liquidity detected at 81% confidence",
      "Elevated attacker concentration on this pair"
    ]
  }
]`,
  },
  {
    id: "route-risk",
    badge: "Intel API",
    title: "Route Risk Feed",
    method: "GET",
    endpoint: "/api/routes/risk",
    description:
      "Scored risk rankings for all active routes in the system. Each entry includes a composite risk score, a recommendation, bundle share, unique attacker count, and a breakdown of attack types observed. Use this to build blocklists, seed routing model features, or display route health in internal dashboards.",
    whenToUse:
      "Pull on a schedule (every 15–60 minutes) to keep your routing model's risk feature cache fresh. Filter by recommendation === 'avoid' to populate a blocklist.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max routes to return — default 20, max 100" },
    ],
    responseFields: [
      { name: "route_key",        type: "string", description: "Unique surface identifier"                            },
      { name: "protocol",         type: "string", description: "Protocol slug (e.g. raydium_amm)"                    },
      { name: "risk_score",       type: "number", description: "0–100 composite MEV risk"                            },
      { name: "recommendation",   type: "string", description: "avoid | penalize | monitor"                          },
      { name: "bundle_share",     type: "number", description: "Percent of attacks that appear Jito-aligned"         },
      { name: "unique_attackers", type: "number", description: "Distinct operator entities hitting this route"        },
      { name: "attack_mix",       type: "object", description: "{ S, B, J, A, L } counts for each attack type"       },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Orca", "Kamino"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/routes/risk?limit=20" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/routes/risk?limit=50", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const routes = await res.json();

const blocklist  = routes.filter((r) => r.recommendation === "avoid");
const penalizeList = routes.filter((r) => r.recommendation === "penalize");

// Store in your routing config
await db.routeRisk.upsertMany(routes);`,
    response: `[
  {
    "route_key":        "route:raydium_amm:SOL->USDC",
    "protocol":         "raydium_amm",
    "risk_score":       93,
    "recommendation":   "avoid",
    "bundle_share":     67,
    "unique_attackers": 11,
    "attack_mix":       { "S": 6, "B": 2, "J": 3, "A": 12, "L": 0 }
  },
  {
    "route_key":        "venue:orca_whirlpool:SOL->USDC",
    "protocol":         "orca_whirlpool",
    "risk_score":       28,
    "recommendation":   "monitor",
    "bundle_share":     14,
    "unique_attackers": 3,
    "attack_mix":       { "S": 0, "B": 1, "J": 2, "A": 4, "L": 0 }
  }
]`,
  },
  {
    id: "pool-toxicity",
    badge: "Liquidity API",
    title: "Pool Toxicity Feed",
    method: "GET",
    endpoint: "/api/pools",
    description:
      "Pools ranked by extraction pressure. Each entry includes a composite toxicity score, total value extracted by attackers, unique attacker count, attack type breakdown, and the top entity responsible. Use this to protect LP incentives and flag pools that are underperforming due to MEV.",
    whenToUse:
      "Pull daily or on a schedule to update LP risk dashboards. Flag pools above toxicity_score 70 for incentive rebalancing or governance review.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max pools to return — default 25, max 100" },
    ],
    responseFields: [
      { name: "pool_address",        type: "string", description: "On-chain pool address or synthetic route key" },
      { name: "protocol",            type: "string", description: "Protocol name (orca, raydium, meteora, ...)"  },
      { name: "toxicity_score",      type: "number", description: "0–100 composite extraction pressure"          },
      { name: "total_extracted_usd", type: "number", description: "Total value extracted on this pool"           },
      { name: "unique_attackers",    type: "number", description: "Distinct entities targeting this pool"        },
      { name: "attack_breakdown",    type: "object", description: "{ sandwich, arb, jit } incident counts"       },
      { name: "top_entity_label",    type: "string", description: "Highest-impact entity name on this pool"      },
    ],
    teams: buyerTeams.filter((t) => ["Orca", "Kamino", "Keyrock"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/pools?limit=25" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/pools?limit=50", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const pools = await res.json();

// Flag high-toxicity pools for governance review
const flagged = pools.filter((p) => p.toxicity_score >= 70);
console.log(\`\${flagged.length} pools need attention\`);`,
    response: `[
  {
    "pool_address":        "route:raydium_amm:SOL->USDC",
    "protocol":            "raydium_amm",
    "toxicity_score":      86,
    "total_extracted_usd": 52480,
    "unique_attackers":    14,
    "attack_breakdown":    { "sandwich": 6, "arb": 74, "jit": 11 },
    "top_entity_label":    "B91 Sandwich Cluster"
  },
  {
    "pool_address":        "venue:orca_whirlpool:SOL->USDC",
    "protocol":            "orca_whirlpool",
    "toxicity_score":      31,
    "total_extracted_usd": 8120,
    "unique_attackers":    4,
    "attack_breakdown":    { "sandwich": 0, "arb": 18, "jit": 3 },
    "top_entity_label":    "Orca Cross-Pool Arb"
  }
]`,
  },
  {
    id: "validator-risk",
    badge: "Validator API",
    title: "Validator Risk Feed",
    method: "GET",
    endpoint: "/api/validators",
    description:
      "Per-validator MEV metrics — sandwich share, wide-bracket share, confirmed attack rate, total extracted value, and a composite risk score. Wide-sandwich share specifically indicates ordering agreements (e.g. Jito bundles). Use this for staking allocation quality scoring and tx-delivery analytics.",
    whenToUse:
      "Pull hourly or daily to update validator quality scores. Sort by risk_score descending and flag validators with sandwich_share above 0.5 for staking reallocation review.",
    inputs: [],
    responseFields: [
      { name: "validator",           type: "string", description: "Validator identity name or pubkey"         },
      { name: "risk_score",          type: "number", description: "0–100 composite MEV risk"                  },
      { name: "sandwich_share",      type: "number", description: "Fraction of blocks with sandwich attacks"   },
      { name: "wide_sandwich_share", type: "number", description: "Multi-slot brackets — implies bundle ordering" },
      { name: "confirmed_share",     type: "number", description: "High-confidence attack fraction"            },
      { name: "total_extracted_usd", type: "number", description: "Total attacker-side value on this validator" },
      { name: "unique_entities",     type: "number", description: "Distinct operator entities seen"           },
    ],
    teams: buyerTeams.filter((t) => ["Sanctum", "Jito", "Helius"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/validators" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/validators", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const validators = await res.json();

// Downrank high-risk validators in staking allocation
const risky = validators
  .filter((v) => v.sandwich_share > 0.5 || v.risk_score > 70)
  .sort((a, b) => b.risk_score - a.risk_score);`,
    response: `[
  {
    "validator":           "Jito-Validator-Alpha",
    "risk_score":          84,
    "sandwich_share":      0.62,
    "wide_sandwich_share": 0.39,
    "confirmed_share":     0.78,
    "total_extracted_usd": 18420,
    "unique_entities":     5
  },
  {
    "validator":           "Stakewiz-Pro-12",
    "risk_score":          24,
    "sandwich_share":      0.11,
    "wide_sandwich_share": 0.04,
    "confirmed_share":     0.62,
    "total_extracted_usd": 2140,
    "unique_entities":     2
  }
]`,
  },
  {
    id: "execution-quality",
    badge: "Execution API",
    title: "Execution Quality",
    method: "GET",
    endpoint: "/api/analytics/execution-quality",
    description:
      "Markouts, realized slippage, and quote freshness per route. Markouts measure how much a price moved against you after execution (1s / 5s / 30s). A high markout means you executed into stale quotes. Use this alongside route risk to score venue quality on both safety and execution dimensions.",
    whenToUse:
      "Pull and combine with route risk scores to create a two-dimensional venue ranking. Routes with high risk AND high markout decay should be the first candidates for blocklisting.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max routes to return — default 10, max 50" },
    ],
    responseFields: [
      { name: "route_key",               type: "string", description: "Surface identifier"                              },
      { name: "execution_quality_score", type: "number", description: "0–100, higher = better execution"                },
      { name: "realized_slippage_bps",   type: "number", description: "Average actual slippage vs quoted price"         },
      { name: "markout_1s_bps",          type: "number", description: "Price move 1 second after execution"             },
      { name: "markout_5s_bps",          type: "number", description: "Price move 5 seconds after execution"            },
      { name: "markout_30s_bps",         type: "number", description: "Price move 30 seconds after execution"           },
      { name: "quote_freshness_ms",      type: "number", description: "Avg ms between quote creation and execution"     },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Keyrock"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/analytics/execution-quality?limit=10" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/analytics/execution-quality?limit=20", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const quality = await res.json();

// Flag routes with poor execution (high markout decay)
const stale = quality.filter(
  (r) => r.markout_30s_bps < -10 || r.execution_quality_score < 40
);`,
    response: `[
  {
    "route_key":               "route:raydium_amm:SOL->USDC",
    "execution_quality_score": 18,
    "realized_slippage_bps":   14.8,
    "markout_1s_bps":          -3.2,
    "markout_5s_bps":          -8.1,
    "markout_30s_bps":         -20.4,
    "quote_freshness_ms":      118
  },
  {
    "route_key":               "venue:orca_whirlpool:SOL->USDC",
    "execution_quality_score": 81,
    "realized_slippage_bps":   2.1,
    "markout_1s_bps":          -0.4,
    "markout_5s_bps":          -1.1,
    "markout_30s_bps":         -2.8,
    "quote_freshness_ms":      34
  }
]`,
  },
  {
    id: "lp-protection",
    badge: "LP API",
    title: "LP Protection / LVR",
    method: "GET",
    endpoint: "/api/pools/lp-protection",
    description:
      "Loss-versus-rebalancing (LVR) proxy scores and LP drag estimates per pool. LVR quantifies how much liquidity is being extracted specifically through stale-quote arbitrage — the main source of LP underperformance that isn't visible in sandwich counts. Use this to tune fees, spreads, or LP incentives at the pool level.",
    whenToUse:
      "Pull weekly for governance decisions and daily for active fee management. Prioritize pools where lp_drag_estimate_usd is highest relative to their TVL.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max pools to return — default 10, max 50" },
    ],
    responseFields: [
      { name: "pool_address",               type: "string", description: "Pool identifier"                                    },
      { name: "lvr_proxy_score",            type: "number", description: "0–100 LVR pressure estimate"                        },
      { name: "lp_drag_estimate_usd",       type: "number", description: "Estimated LP capital loss to stale-quote arb"       },
      { name: "stale_quote_arb_frequency",  type: "number", description: "Fraction of arb events that are stale-quote-driven" },
      { name: "primary_cause",              type: "string", description: "sandwich pressure | stale-quote arb | jit drain"    },
      { name: "saved_fee_bps_if_segmented", type: "number", description: "Estimated fee savings if LP flow is segmented"      },
    ],
    teams: buyerTeams.filter((t) => ["Orca", "Kamino", "Keyrock"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/pools/lp-protection?limit=10" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/pools/lp-protection?limit=10", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const pools = await res.json();

// Pools with highest LP drag → priority for fee tuning
const priority = pools
  .filter((p) => p.lvr_proxy_score >= 60)
  .sort((a, b) => b.lp_drag_estimate_usd - a.lp_drag_estimate_usd);`,
    response: `[
  {
    "pool_address":               "route:raydium_amm:SOL->USDC",
    "lvr_proxy_score":            78,
    "lp_drag_estimate_usd":       36119,
    "stale_quote_arb_frequency":  0.41,
    "primary_cause":              "sandwich pressure",
    "saved_fee_bps_if_segmented": 4.2
  }
]`,
  },
  {
    id: "route-recommendations",
    badge: "Policy API",
    title: "Route Recommendations",
    method: "GET",
    endpoint: "/api/routes/recommendations",
    description:
      "Pair-level prefer / monitor / avoid guidance without the overhead of full evaluation logic. Each entry maps an input/output mint pair to a short list of recommended venues and a list to avoid, with a risk score per route. Ideal for teams that want to seed routing config or show safety badges in a UI without building their own policy engine.",
    whenToUse:
      "Pull on startup or hourly to populate default venue weights. Use recommended_routes to prefer lower-risk venues and avoid_routes to blocklist hostile ones per pair.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max pairs to return — default 12, max 50" },
    ],
    responseFields: [
      { name: "input_mint",          type: "string", description: "Base token mint address"                       },
      { name: "output_mint",         type: "string", description: "Quote token mint address"                      },
      { name: "recommended_routes",  type: "array",  description: "Preferred venues with risk_score and label"    },
      { name: "avoid_routes",        type: "array",  description: "Hostile venues with risk_score and label"      },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Orca"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/routes/recommendations?limit=12" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/routes/recommendations?limit=12", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const recommendations = await res.json();

// Seed routing config per pair
for (const pair of recommendations) {
  router.setVenueWeights({
    input:   pair.input_mint,
    output:  pair.output_mint,
    prefer:  pair.recommended_routes.map((r) => r.route_key),
    avoid:   pair.avoid_routes.map((r) => r.route_key),
  });
}`,
    response: `[
  {
    "input_mint":  "So11111111111111111111111111111111111111112",
    "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "recommended_routes": [
      {
        "route_key":      "venue:orca_whirlpool:SOL->USDC",
        "label":          "ORCA_WHIRLPOOL venue · SOL / USDC",
        "recommendation": "prefer",
        "risk_score":     24.6
      }
    ],
    "avoid_routes": [
      {
        "route_key":  "route:raydium_amm:SOL->USDC",
        "label":      "RAYDIUM_AMM route · SOL / USDC",
        "risk_score": 93.0
      }
    ]
  }
]`,
  },
  {
    id: "flow-segments",
    badge: "Segmentation API",
    title: "Flow Segmentation",
    method: "GET",
    endpoint: "/api/flows/segments",
    description:
      "Classifies current Solana orderflow into named segments — retail, informed-toxic, arbitrage — with a flow share percentage and toxicity probability per segment. Also returns source attribution labels (aggregator-routed, direct, wallet-initiated). Use this to understand the composition of flow hitting your venues and build segment-aware routing policy.",
    whenToUse:
      "Pull periodically to track how the flow mix changes over time. Use informed-toxic flow_share as a risk signal — a spike means more hostile volume is hitting the chain right now.",
    inputs: [],
    responseFields: [
      { name: "segments",              type: "array",  description: "Flow segments with share %, toxicity probability, and confidence"   },
      { name: "segment",               type: "string", description: "retail | informed-toxic | arbitrage | passive"                       },
      { name: "flow_share",            type: "number", description: "Percentage of total flow in this segment"                            },
      { name: "toxicity_probability",  type: "number", description: "0–100 probability that flow in this segment is MEV-hostile"          },
      { name: "sources",               type: "array",  description: "Source labels with endorser_inference classification"                },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter", "Jito", "Kamino"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/flows/segments" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/flows/segments", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const flow = await res.json();

// Check current toxic flow share
const toxicSegment = flow.segments.find((s) => s.segment === "informed-toxic");
const toxicShare = toxicSegment?.flow_share ?? 0;

if (toxicShare > 50) {
  alerts.raise("HIGH_TOXIC_FLOW_SHARE", { share: toxicShare });
}`,
    response: `{
  "segments": [
    {
      "segment":              "retail",
      "flow_share":           38,
      "toxicity_probability": 12,
      "avg_confidence":       0.81
    },
    {
      "segment":              "informed-toxic",
      "flow_share":           40,
      "toxicity_probability": 88,
      "avg_confidence":       0.93
    },
    {
      "segment":              "arbitrage",
      "flow_share":           22,
      "toxicity_probability": 31,
      "avg_confidence":       0.87
    }
  ],
  "sources": [
    { "label": "aggregator-routed",  "endorser_inference": "endorsed-like" },
    { "label": "direct-wallet",      "endorser_inference": "uninformed"    }
  ]
}`,
  },
  {
    id: "savings-summary",
    badge: "ROI API",
    title: "Savings Summary",
    method: "GET",
    endpoint: "/api/savings/summary",
    description:
      "A single-call 24-hour ROI readout — estimated loss avoided in USD, average basis points saved, number of routes flagged, and pools protected. Designed for exec dashboards and business reviews where you need a top-line number that justifies Intelleum spend without diving into individual events.",
    whenToUse:
      "Pull once per day for business reporting. Attach to weekly/monthly reviews and internal ROI dashboards. Use estimated_loss_avoided_usd_24h as your primary metric for justifying API usage.",
    inputs: [],
    responseFields: [
      { name: "estimated_loss_avoided_usd_24h", type: "number", description: "Total estimated dollar loss prevented in the past 24h"    },
      { name: "estimated_bps_saved_avg",        type: "number", description: "Average basis points saved across flagged routes"         },
      { name: "routes_flagged",                 type: "number", description: "Number of routes flagged as avoid or penalize in past 24h" },
      { name: "pools_protected",                type: "number", description: "Number of pools flagged for LP protection review"          },
    ],
    teams: buyerTeams.filter((t) => ["Orca", "Kamino", "Helius"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/savings/summary" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/savings/summary", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const savings = await res.json();

// Report to internal dashboard
metrics.gauge("intelleum.loss_avoided_usd_24h", savings.estimated_loss_avoided_usd_24h);
metrics.gauge("intelleum.bps_saved_avg",         savings.estimated_bps_saved_avg);`,
    response: `{
  "estimated_loss_avoided_usd_24h": 108.5,
  "estimated_bps_saved_avg":        7.23,
  "routes_flagged":                 2,
  "pools_protected":                3
}`,
  },
  {
    id: "prediction-execution",
    badge: "Prediction API",
    title: "Prediction Market Execution",
    method: "GET",
    endpoint: "/api/prediction-markets/execution",
    description:
      "Execution context specifically for thin, event-driven markets where standard route scoring misses the market-type dimension. Returns execution quality score, liquidity stress, toxic flow flag, and recommended action per market. Prediction markets are especially vulnerable to MEV during volatile or low-liquidity windows — this endpoint surfaces exactly those windows.",
    whenToUse:
      "Poll before routing large prediction-market orders. Gate execution when liquidity_stress_score is high or toxic_flow_flag is true. Surface recommended_action in your venue UI.",
    inputs: [
      { name: "limit", type: "number", required: false, description: "Max markets to return — default 6, max 20" },
    ],
    responseFields: [
      { name: "market_type",             type: "string",  description: "prediction | event-driven | specialized"              },
      { name: "route_key",               type: "string",  description: "Surface identifier"                                   },
      { name: "execution_quality_score", type: "number",  description: "0–100, higher = better execution"                     },
      { name: "liquidity_stress_score",  type: "number",  description: "0–100 current liquidity pressure"                     },
      { name: "toxic_flow_flag",         type: "boolean", description: "True if informed-toxic flow is dominant on this market" },
      { name: "recommended_action",      type: "string",  description: "allow | monitor | gate"                               },
      { name: "estimated_slippage_bps",  type: "number",  description: "Expected slippage in basis points"                    },
    ],
    teams: buyerTeams.filter((t) => ["Jupiter"].includes(t.name)),
    curl: `curl "${BASE_URL}/api/prediction-markets/execution?limit=6" \\
  -H "x-api-key: YOUR_API_KEY"`,
    typescript: `const res = await fetch("${BASE_URL}/api/prediction-markets/execution?limit=6", {
  headers: { "x-api-key": process.env.INTELLEUM_API_KEY! },
});
const markets = await res.json();

// Gate execution on stressed markets
for (const market of markets) {
  if (market.liquidity_stress_score > 60 || market.toxic_flow_flag) {
    router.gate(market.route_key, { reason: market.recommended_action });
  }
}`,
    response: `[
  {
    "market_type":             "prediction",
    "route_key":               "venue:orca_whirlpool:SOL->USDC",
    "execution_quality_score": 54,
    "liquidity_stress_score":  38,
    "toxic_flow_flag":         false,
    "recommended_action":      "monitor",
    "estimated_slippage_bps":  7.2
  },
  {
    "market_type":             "event-driven",
    "route_key":               "route:raydium_amm:SOL->USDC",
    "execution_quality_score": 19,
    "liquidity_stress_score":  81,
    "toxic_flow_flag":         true,
    "recommended_action":      "gate",
    "estimated_slippage_bps":  22.4
  }
]`,
  },
];

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const sections = [
  { id: "overview",         label: "Overview"          },
  { id: "quickstart",       label: "Quickstart"        },
  { id: "integration-flow", label: "Integration Flow"  },
  { id: "___divider___",    label: ""                  },
  ...endpoints.map((e) => ({ id: e.id, label: e.title })),
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const faviconUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// ─── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── TeamPills ────────────────────────────────────────────────────────────────

function TeamPills({ teams }: { teams: BuyerTeam[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((team) => (
        <Tooltip key={team.name}>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 border border-border/60 bg-background/60 px-3 py-2">
              <img src={faviconUrl(team.domain)} alt={team.name} className="h-4 w-4 object-contain" loading="lazy" />
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-foreground">{team.name}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs">{team.name} · {team.type} · {team.buy}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// ─── API Key Modal ────────────────────────────────────────────────────────────

function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "duplicate" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [issued, setIssued] = useState<IssuedApiKeyResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createdKey = issued?.api_key ?? null;

  function copy() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerate() {
    const trimmedWallet = walletAddress.trim();
    if (!trimmedWallet) {
      setStatus("error");
      setErrorMessage("Enter a Solana wallet address to create a trial key.");
      return;
    }

    setStatus("submitting");
    setIssued(null);
    setErrorMessage(null);

    try {
      const response = await api.issueApiKey({ walletAddress: trimmedWallet });
      setIssued(response);
      setStatus("success");
    } catch (error) {
      const typedError = error as Error & {
        status?: number;
        payload?: {
          error?: string;
          wallet_address?: string;
          api_key_prefix?: string;
          remaining_requests?: number;
        };
      };

      if (typedError.status === 409) {
        const prefix = typedError.payload?.api_key_prefix;
        const remaining = typedError.payload?.remaining_requests;
        setStatus("duplicate");
        setErrorMessage(
          [
            "This wallet already has a trial key.",
            prefix ? `Issued key: ${prefix}` : null,
            typeof remaining === "number" ? `${remaining} requests remaining.` : null,
            "You cannot create another key with the same wallet. Click Request Access for a managed account.",
          ].filter(Boolean).join(" "),
        );
        return;
      }

      setStatus("error");
      setErrorMessage(
        typedError.payload?.error ??
          "Could not create an API key right now. Please try again or use Request Access.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-[760px] overflow-y-auto border border-border/70 bg-background p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Authentication</div>
            <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-foreground">How API Keys Work</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[13px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        {/* Key display */}
        <div className="mt-6 border border-border/70 bg-surface/40 p-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">Wallet-Bound Trial Key</div>
          <div className="mt-3">
            <label htmlFor="walletAddress" className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
              Solana Wallet Address
            </label>
            <input
              id="walletAddress"
              value={walletAddress}
              onChange={(event) => {
                setWalletAddress(event.target.value);
                if (status !== "idle") {
                  setStatus("idle");
                  setIssued(null);
                  setErrorMessage(null);
                }
              }}
              placeholder={EXAMPLE_WALLET}
              className="mt-2 w-full border border-border/70 bg-background px-4 py-3 font-mono text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={status === "submitting"}
              className="border border-primary bg-primary px-5 py-2.5 font-mono text-[13px] uppercase tracking-[0.16em] text-background transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "submitting" ? "Generating..." : "Generate Trial Key"}
            </button>
            <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
              5 Requests Max
            </div>
          </div>

          {createdKey && (
            <div className="mt-4 border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <code className="flex-1 break-all font-mono text-[12px] text-primary">{createdKey}</code>
                <button
                  type="button"
                  onClick={copy}
                  className="shrink-0 border border-border/70 px-4 py-2 font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-[13px] text-muted-foreground sm:grid-cols-2">
                <div>
                  Header: <code className="text-foreground">{AUTH_HEADER}</code>
                </div>
                <div>
                  Remaining: <code className="text-foreground">{issued?.remaining_requests ?? 5}</code>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              className={`mt-4 border p-4 text-[13px] leading-6 ${
                status === "duplicate"
                  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                  : "border-red-500/30 bg-red-500/10 text-red-200"
              }`}
            >
              {errorMessage}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="border border-primary/20 bg-primary/5 p-4">
            <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-primary">Managed Trial Flow</div>
            <p className="mt-2 text-[13px] leading-6 text-foreground">
              Enter a Solana wallet address once and Intelleum issues a trial key backed by the database. That key is capped at <code className="text-foreground">5</code> requests.
            </p>
            <pre className="mt-3 overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[10px] leading-5 text-primary whitespace-pre">
{`curl -X POST ${BASE_URL}/api/access/api-key \\
  -H "Content-Type: application/json" \\
  -d '{
    "walletAddress": "${EXAMPLE_WALLET}"
  }'`}
            </pre>
          </div>
          <div className="border border-border/70 bg-surface/30 p-4">
            <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-primary">Duplicate Wallet Rule</div>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              If the same wallet tries to generate another key, Intelleum blocks it. The next step is <span className="text-foreground">Request Access</span> for a managed account instead of minting multiple trial keys.
            </p>
            <pre className="mt-3 overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[10px] leading-5 text-primary whitespace-pre">
{`409 CONFLICT
{
  "error": "API key already issued for this wallet"
}`}
            </pre>
          </div>
        </div>

        {/* How to use */}
        <div className="mt-4">
          <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-muted-foreground">Pass it as a header</div>
          <pre className="mt-2 border border-border/70 bg-background p-3 font-mono text-[12px] text-primary">
{`${AUTH_HEADER}: ${createdKey ?? "YOUR_ISSUED_KEY"}`}
          </pre>
        </div>

        {/* CTA */}
        <div className="mt-5 border-t border-border/40 pt-4">
          <p className="text-[13px] text-muted-foreground">
            Need more than a 5-request trial or hit the duplicate-wallet rule?
          </p>
          <div className="mt-3 flex gap-3">
            <Link
              to="/#access"
              onClick={onClose}
              className="border border-primary bg-primary px-6 py-3 font-mono text-[13px] uppercase tracking-[0.2em] text-background transition-colors hover:bg-primary/90"
            >
              Request Access
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="border border-border/70 px-6 py-3 font-mono text-[13px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Back To Docs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EndpointSection ──────────────────────────────────────────────────────────

function EndpointSection({
  endpoint,
  codeOpen,
  onToggleCode,
}: {
  endpoint: EndpointDoc;
  codeOpen: boolean;
  onToggleCode: () => void;
}) {
  const methodColor =
    endpoint.method === "POST"
      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
      : "border-primary/40 bg-primary/10 text-primary";

  return (
    <section id={endpoint.id} className="scroll-mt-24 border border-border/70 bg-surface/35 p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary">{endpoint.badge}</div>
          <h2 className="mt-2 text-[1.85rem] font-semibold tracking-tight text-foreground">{endpoint.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.1em] ${methodColor}`}>
              {endpoint.method}
            </span>
            <code className="font-mono text-[13px] tracking-[0.04em] text-muted-foreground">{endpoint.endpoint}</code>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCode}
          className={`border px-5 py-2.5 font-mono text-[13px] uppercase tracking-[0.2em] transition-colors ${
            codeOpen
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/70 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
        >
          {codeOpen ? "Close Integration" : "How to Integrate"}
        </button>
      </div>

      {/* Description */}
      <p className="mt-5 max-w-3xl text-[15px] leading-8 text-muted-foreground">{endpoint.description}</p>

      {/* When to use */}
      <div className="mt-4 border-l-2 border-primary/40 pl-4">
        <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">When to Use · </span>
        <span className="text-[14px] leading-7 text-foreground">{endpoint.whenToUse}</span>
      </div>

      {/* Parameters + Response Fields */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Parameters */}
        <div className="border border-border/70 bg-background/40 p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
            {endpoint.method === "POST" ? "Request Body" : "Query Parameters"}
          </div>
          {endpoint.inputs.length === 0 ? (
            <div className="mt-4 font-mono text-[12px] text-muted-foreground">No parameters required</div>
          ) : (
            <div className="mt-4 space-y-4">
              {endpoint.inputs.map((inp) => (
                <div key={inp.name}>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-[13px] text-foreground">{inp.name}</code>
                    <span className="border border-border/50 px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground">{inp.type}</span>
                    {inp.required ? (
                      <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">required</span>
                    ) : (
                      <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground/60">optional</span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{inp.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Response Fields */}
        <div className="border border-border/70 bg-background/40 p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">Response Fields</div>
          <div className="mt-4 space-y-4">
            {endpoint.responseFields.map((field) => (
              <div key={field.name}>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[13px] text-foreground">{field.name}</code>
                  <span className="border border-border/50 px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground">{field.type}</span>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{field.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teams */}
      {endpoint.teams.length > 0 && (
        <div className="mt-5">
          <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-muted-foreground">Relevant Buyers</div>
          <div className="mt-2">
            <TeamPills teams={endpoint.teams} />
          </div>
        </div>
      )}
    </section>
  );
}

// ─── StickyCodePanel ──────────────────────────────────────────────────────────

function StickyCodePanel({
  endpoint,
  onClose,
}: {
  endpoint: EndpointDoc;
  onClose: () => void;
}) {
  const normalizedCurl = endpoint.curl.replaceAll("x-api-key", AUTH_HEADER);
  const normalizedTypeScript = endpoint.typescript.replaceAll("x-api-key", AUTH_HEADER);
  const methodColor =
    endpoint.method === "POST"
      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
      : "border-primary/40 bg-primary/10 text-primary";

  return (
    <div className="sticky top-8 flex h-[calc(100vh-4rem)] flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="border border-border/70 bg-surface/50 p-4">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">{endpoint.badge}</div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          >
            ✕ Close
          </button>
        </div>
        <div className="mt-2 text-[15px] font-semibold text-foreground">{endpoint.title}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`border px-2 py-0.5 font-mono text-[12px] font-bold tracking-[0.1em] ${methodColor}`}>
            {endpoint.method}
          </span>
          <code className="font-mono text-[11px] text-muted-foreground">{endpoint.endpoint}</code>
        </div>
      </div>

      {/* Code tabs */}
      <div className="flex-1 overflow-auto border border-border/70 bg-background/70 p-4">
        <Tabs defaultValue="curl" className="flex h-full flex-col">
          <TabsList className="grid w-full shrink-0 grid-cols-3 bg-surface/60">
            <TabsTrigger value="curl"       className="font-mono text-[12px] uppercase tracking-[0.14em]">cURL</TabsTrigger>
            <TabsTrigger value="typescript" className="font-mono text-[12px] uppercase tracking-[0.14em]">TypeScript</TabsTrigger>
            <TabsTrigger value="response"   className="font-mono text-[12px] uppercase tracking-[0.14em]">Response</TabsTrigger>
          </TabsList>

          <TabsContent value="curl" className="flex-1 overflow-auto">
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">cURL</span>
              <CopyButton text={normalizedCurl} />
            </div>
            <pre className="mt-2 overflow-x-auto border border-border/70 bg-background p-4 font-mono text-[12px] leading-6 text-primary whitespace-pre">
{normalizedCurl}
            </pre>
          </TabsContent>

          <TabsContent value="typescript" className="flex-1 overflow-auto">
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">TypeScript</span>
              <CopyButton text={normalizedTypeScript} />
            </div>
            <pre className="mt-2 overflow-x-auto border border-border/70 bg-background p-4 font-mono text-[12px] leading-6 text-primary whitespace-pre">
{normalizedTypeScript}
            </pre>
          </TabsContent>

          <TabsContent value="response" className="flex-1 overflow-auto">
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">Example Response</span>
              <CopyButton text={endpoint.response} />
            </div>
            <pre className="mt-2 overflow-x-auto border border-border/70 bg-background p-4 font-mono text-[12px] leading-6 text-primary whitespace-pre">
{endpoint.response}
            </pre>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntelApi() {
  const [activeId, setActiveId] = useState<string>("overview");
  const [codeEndpointId, setCodeEndpointId] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Resizable panel
  const [codeWidth, setCodeWidth] = useState(420);
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  const activeEndpoint = useMemo(
    () => endpoints.find((e) => e.id === activeId) ?? null,
    [activeId],
  );

  const codeEndpoint = useMemo(
    () => endpoints.find((e) => e.id === codeEndpointId) ?? null,
    [codeEndpointId],
  );

  // Drag-to-resize handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, width: codeWidth };
  }, [codeWidth]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current || !dragStart.current) return;
      const delta = dragStart.current.x - e.clientX;
      setCodeWidth(Math.max(320, Math.min(680, dragStart.current.width + delta)));
    }
    function onUp() {
      isDragging.current = false;
      dragStart.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function navigate(id: string) {
    setActiveId(id);
    // Does NOT touch codeEndpointId — code panel is independent
  }

  function toggleCode(endpointId: string) {
    setCodeEndpointId((prev) => (prev === endpointId ? null : endpointId));
  }

  const gridCols = codeEndpoint
    ? `280px minmax(0,1fr) 4px ${codeWidth}px`
    : "280px minmax(0,1fr)";

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      {showKeyModal && <ApiKeyModal onClose={() => setShowKeyModal(false)} />}

      <div className="mx-auto max-w-[1700px]">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="font-mono text-[12px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-primary"
          >
            ← Back Home
          </Link>
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="border border-primary bg-primary px-6 py-2.5 font-mono text-[13px] uppercase tracking-[0.2em] text-background transition-colors hover:bg-primary/90"
          >
            Auth Setup
          </button>
        </div>

        {/* Layout */}
        <div
          className="mt-8 grid gap-6"
          style={{ gridTemplateColumns: gridCols }}
        >
          {/* ── Sidebar ── */}
          <aside className="self-start">
            <div className="sticky top-8 border border-border/70 bg-surface/35 p-5">
              <div className="font-mono text-[12px] uppercase tracking-[0.26em] text-primary">Intelleum API</div>
              <code className="mt-1 block font-mono text-[12px] text-muted-foreground">{BASE_URL}</code>

              <nav className="mt-5 space-y-px">
                {sections.map((section) => {
                  if (section.id === "___divider___") {
                    return <div key="div" className="my-3 h-px bg-border/40" />;
                  }
                  const ep = endpoints.find((e) => e.id === section.id);
                  const isActive = section.id === activeId;
                  const hasCode = codeEndpointId === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => navigate(section.id)}
                      className={`group flex w-full items-center gap-2 py-1.5 text-left transition-colors ${
                        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ep ? (
                        <span
                          className={`w-8 shrink-0 font-mono text-[11px] font-bold tracking-[0.06em] ${
                            ep.method === "POST" ? "text-yellow-500/70" : "text-primary/60"
                          } ${isActive ? "opacity-100" : "opacity-70"}`}
                        >
                          {ep.method}
                        </span>
                      ) : (
                        <span className="w-7 shrink-0" />
                      )}
                      <span className={`font-mono text-[13px] uppercase tracking-[0.1em] leading-7 ${isActive ? "text-primary" : ""}`}>
                        {section.label}
                      </span>
                      {hasCode && (
                        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Create key CTA */}
              <div className="mt-6 border-t border-border/40 pt-5">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className="w-full border border-primary/40 py-2.5 font-mono text-[12px] uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary/10"
                >
                  Auth Setup
                </button>
                <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Header + env guide
                </p>
              </div>
            </div>
          </aside>

          {/* ── Main Content ── */}
          <div className="min-w-0 space-y-5">

            {/* Overview */}
            {activeId === "overview" && (
              <section id="overview" className="border border-border/70 bg-surface/35 p-8">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Intelleum API</div>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                  MEV Intelligence API
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                  REST endpoints for protected send, route scoring, live alerts, liquidation risk, LP protection, and validator-side execution intelligence.
                </p>

                {/* Auth + Base URL */}
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  <div className="border border-border/70 bg-background/50 p-5">
                    <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">Base URL</div>
                    <code className="mt-3 block font-mono text-[12px] text-foreground">{BASE_URL}</code>
                  </div>
                  <div className="border border-border/70 bg-background/50 p-5">
                    <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">Authentication</div>
                    <div className="mt-3 font-mono text-[12px] text-muted-foreground">
                      Header: <code className="text-foreground">{AUTH_HEADER}</code>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      Wallet-bound issued keys with 5-call trial limits, or a local master key
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowKeyModal(true)}
                      className="mt-3 font-mono text-[13px] uppercase tracking-[0.16em] text-primary hover:underline"
                    >
                      → View auth setup
                    </button>
                  </div>
                  <div className="border border-border/70 bg-background/50 p-5">
                    <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">Data Source Header</div>
                    <div className="mt-3 font-mono text-[12px] text-muted-foreground">
                      <code className="text-foreground">X-Intelleum-Source</code>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      chain = live data · fallback = backend fallback
                    </div>
                  </div>
                  <div className="border border-border/70 bg-background/50 p-5">
                    <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">RPC Requirement</div>
                    <div className="mt-3 font-mono text-[12px] text-muted-foreground">
                      Clients do not need Solana RPC for these APIs.
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      RPC is only needed by the Intelleum backend for live ingestion.
                    </div>
                  </div>
                </div>

                {/* Endpoint index */}
                <div className="mt-8">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">All Endpoints</div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {endpoints.map((ep) => (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => navigate(ep.id)}
                        className="flex items-center gap-3 border border-border/60 bg-background/40 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <span
                          className={`w-9 shrink-0 font-mono text-[12px] font-bold ${
                            ep.method === "POST" ? "text-yellow-400" : "text-primary"
                          }`}
                        >
                          {ep.method}
                        </span>
                        <div className="min-w-0">
                          <code className="block truncate font-mono text-[12px] text-muted-foreground">{ep.endpoint}</code>
                          <span className="mt-0.5 block font-mono text-[12px] uppercase tracking-[0.1em] text-foreground">{ep.title}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buyer map */}
                <div className="mt-8">
                  <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-muted-foreground">Target Buyers</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {buyerTeams.map((team) => (
                      <div key={team.name} className="flex items-center gap-3 border border-border/60 bg-surface/40 px-3 py-2.5">
                        <img src={faviconUrl(team.domain)} alt={team.name} className="h-5 w-5 shrink-0 object-contain" loading="lazy" />
                        <div className="min-w-0">
                          <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-foreground">{team.name}</div>
                          <div className="truncate font-mono text-[12px] text-muted-foreground">{team.buy}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 font-mono text-[12px] text-muted-foreground/50">
                    Target buyer profiles. Not claims of existing commercial relationships.
                  </p>
                </div>
              </section>
            )}

            {/* Quickstart */}
            {activeId === "quickstart" && (
              <section id="quickstart" className="border border-border/70 bg-surface/35 p-8">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Quickstart</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Go from auth to guarded routing in minutes</h2>
                <p className="mt-3 max-w-2xl text-[14px] leading-7 text-muted-foreground">
                  Set the auth header, call a decision endpoint, then route or block based on the response. This flow matches the real backend behavior.
                </p>

                <div className="mt-8 grid gap-4 xl:grid-cols-[1.05fr,1.2fr]">
                  <div className="space-y-4">
                    <div className="border border-border/70 bg-background/40 p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-primary/50 font-mono text-[11px] text-primary">1</span>
                        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">Issue Trial Key</div>
                      </div>
                      <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
                        The managed flow is wallet-bound. Post the client Solana wallet to <code className="text-foreground">/api/access/api-key</code>, store the returned key once, and use it in <code className="text-foreground">{AUTH_HEADER}</code>. The backend tracks usage and blocks the key after 5 requests.
                      </p>
                      <pre className="mt-4 overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[11px] leading-6 text-primary whitespace-pre">
{`curl -X POST ${LOCAL_BASE_URL}/api/access/api-key \\
  -H "Content-Type: application/json" \\
  -d '{
    "walletAddress": "${EXAMPLE_WALLET}",
    "name": "Ops Team",
    "organization": "Router Co",
    "useCase": "pre-trade route protection"
  }'`}
                      </pre>
                    </div>

                    <div className="border border-border/70 bg-background/40 p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-primary/50 font-mono text-[11px] text-primary">2</span>
                        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">Track Quota</div>
                      </div>
                      <pre className="mt-4 overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[11px] leading-6 text-primary whitespace-pre">
{`curl ${LOCAL_BASE_URL}/api/access/api-key/status/${EXAMPLE_WALLET}

// response
{
  "api_key_prefix": "itl_live_abc123...",
  "request_limit": 5,
  "request_count": 2,
  "remaining_requests": 3,
  "status": "active"
}`}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-border/70 bg-background/40 p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-primary/50 font-mono text-[11px] text-primary">3</span>
                          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">Protect A Route</div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border border-border/70 bg-surface/40 px-4 py-2">
                        <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">cURL</span>
                        <CopyButton text={`curl -X POST ${BASE_URL}/api/prevention/protected-send \\\n  -H "Content-Type: application/json" \\\n  -H "${AUTH_HEADER}: YOUR_API_KEY" \\\n  -d '{\n    "input_mint":   "So11111111111111111111111111111111111111112",\n    "output_mint":  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",\n    "protocol":     "raydium_amm",\n    "notional_usd": 25000,\n    "slippage_bps": 30,\n    "objective":    "protect_users"\n  }'`} />
                      </div>
                      <pre className="overflow-x-auto border border-t-0 border-border/70 bg-background p-4 font-mono text-[11px] leading-6 text-primary whitespace-pre">
{`curl -X POST ${BASE_URL}/api/prevention/protected-send \\
  -H "Content-Type: application/json" \\
  -H "${AUTH_HEADER}: YOUR_API_KEY" \\
  -d '{
    "input_mint":   "So11111111111111111111111111111111111111112",
    "output_mint":  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "protocol":     "raydium_amm",
    "notional_usd": 25000,
    "slippage_bps": 30,
    "objective":    "protect_users"
  }'`}
                      </pre>
                    </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                      <div className="border border-border/70 bg-background/40 p-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-primary/50 font-mono text-[11px] text-primary">4</span>
                          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">Read The Decision</div>
                        </div>
                        <pre className="mt-4 overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[11px] leading-6 text-primary whitespace-pre">
{`{
  "action": "reroute",
  "expected_loss_at_risk_usd": 174.2,
  "savings_proof": { "estimated_bps_saved": 11.4 },
  "protected_send_policy": { "submit_via": "jito_dontfront" },
  "safer_alternatives": [
    { "route_key": "venue:orca_whirlpool:SOL->USDC" }
  ]
}`}
                        </pre>
                      </div>

                      <div className="border border-border/70 bg-background/40 p-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-primary/50 font-mono text-[11px] text-primary">5</span>
                          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">Act On It</div>
                        </div>
                        <pre className="mt-4 overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[11px] leading-6 text-primary whitespace-pre">
{`if (data.action === "block") stopExecution();
if (data.action === "reroute") {
  router.useFallback(data.safer_alternatives[0].route_key);
}`}
                        </pre>
                      </div>
                    </div>

                    <div className="border border-border/70 bg-background/40 p-5">
                      <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">Local Admin Mode</div>
                      <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
                        For local demos you can still use one master key instead of wallet-issued keys.
                      </p>
                      <pre className="mt-4 overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[11px] leading-6 text-primary whitespace-pre">
{`# backend/.env
INTELLEUM_API_KEY=${EXAMPLE_API_KEY}
REQUIRE_API_KEYS=true

# frontend/.env
VITE_API_URL=${LOCAL_BASE_URL}
VITE_INTELLEUM_API_KEY=${EXAMPLE_API_KEY}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Integration Flow */}
            {activeId === "integration-flow" && (
              <section id="integration-flow" className="border border-border/70 bg-surface/35 p-8">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Integration Flow</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">How Teams Integrate</h2>
                <p className="mt-3 max-w-xl text-[14px] leading-7 text-muted-foreground">
                  A production integration calls protected-send before execution, monitors alerts, and pulls savings summary for ROI reporting.
                </p>

                {/* 4 steps */}
                <div className="mt-8 grid gap-3 md:grid-cols-4">
                  {([
                    { n: "1", label: "Pre-Trade",  code: "POST /api/prevention/\nprotected-send"               },
                    { n: "2", label: "Decide",     code: "allow → proceed\nreroute / block →\nprotect flow"       },
                    { n: "3", label: "Monitor",    code: "GET /api/integrations/\nlive-alerts every 15s"        },
                    { n: "4", label: "Measure",    code: "GET /api/savings/summary\n24h ROI readout"             },
                  ] as { n: string; label: string; code: string }[]).map((item) => (
                    <div key={item.n} className="border border-border/70 bg-background/40 p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center border border-primary/50 font-mono text-[12px] text-primary">{item.n}</span>
                        <span className="font-mono text-[13px] uppercase tracking-[0.16em] text-foreground">{item.label}</span>
                      </div>
                      <pre className="mt-3 font-mono text-[11px] leading-6 text-muted-foreground whitespace-pre">{item.code}</pre>
                    </div>
                  ))}
                </div>

                {/* Full example */}
                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-primary">Full TypeScript Integration</div>
                    <CopyButton text={`// 1. Protect route pre-trade\nconst res = await fetch("${BASE_URL}/api/prevention/protected-send", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", "${AUTH_HEADER}": process.env.INTELLEUM_API_KEY! },\n  body: JSON.stringify({ input_mint, output_mint, protocol, notional_usd, slippage_bps, objective: "protect_users" }),\n});\nconst guard = await res.json();\n\n// 2. Act on policy\nif (guard.action === "block") return stopExecution();\nif (guard.action === "reroute") return router.useFallback(guard.safer_alternatives[0].route_key);\n\n// 3. Monitor alerts in background\nsetInterval(async () => {\n  const alerts = await fetch("${BASE_URL}/api/integrations/live-alerts?limit=10", {\n    headers: { "${AUTH_HEADER}": process.env.INTELLEUM_API_KEY! },\n  }).then((r) => r.json());\n  alerts.filter((a) => a.severity === "critical").forEach((a) => slack.post("#mev-alerts", a.rationale[0]));\n}, 15_000);`} />
                  </div>
                  <pre className="mt-2 overflow-x-auto border border-border/70 bg-background p-5 font-mono text-[12px] leading-7 text-primary whitespace-pre">
{`// 1. Protect route pre-trade
const res = await fetch("${BASE_URL}/api/prevention/protected-send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "${AUTH_HEADER}": process.env.INTELLEUM_API_KEY!,
  },
  body: JSON.stringify({
    input_mint, output_mint, protocol,
    notional_usd, slippage_bps,
    objective: "protect_users",
  }),
});
const guard = await res.json();

// 2. Act on policy
if (guard.action === "block") return stopExecution();
if (guard.action === "reroute") return router.useFallback(guard.safer_alternatives[0].route_key);

// 3. Monitor alerts in background (every 15s)
setInterval(async () => {
  const alerts = await fetch("${BASE_URL}/api/integrations/live-alerts?limit=10", {
    headers: { "${AUTH_HEADER}": process.env.INTELLEUM_API_KEY! },
  }).then((r) => r.json());

  alerts
    .filter((a) => a.severity === "critical")
    .forEach((a) => slack.post("#mev-alerts", a.rationale[0]));
}, 15_000);`}
                  </pre>
                </div>
              </section>
            )}

            {/* Endpoint sections */}
            {activeEndpoint && (
              <EndpointSection
                endpoint={activeEndpoint}
                codeOpen={codeEndpointId === activeEndpoint.id}
                onToggleCode={() => toggleCode(activeEndpoint.id)}
              />
            )}
          </div>

          {/* ── Drag handle ── */}
          {codeEndpoint && (
            <div
              className="flex cursor-col-resize items-center justify-center"
              onMouseDown={onDragStart}
            >
              <div className="h-16 w-[3px] rounded-full bg-border/60 transition-colors hover:bg-primary/60" />
            </div>
          )}

          {/* ── Sticky Code Panel ── */}
          {codeEndpoint && (
            <div style={{ width: codeWidth }}>
              <StickyCodePanel
                endpoint={codeEndpoint}
                onClose={() => setCodeEndpointId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
