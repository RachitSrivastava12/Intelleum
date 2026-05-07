# @intelleum/protect

Drop-in toxic order-flow protection for Solana wallets, routers, trading backends, LP desks, and market makers.

Intelleum should not just be a dashboard someone checks after value leaked. This SDK lets teams call the prevention engine before a swap, route, or order lands.

## Install

```bash
npm install @intelleum/protect
```

For local development in this repo:

```bash
cd sdk/typescript
npm run build
```

## Pre-Trade Guard

```ts
import { IntelleumProtectClient } from "@intelleum/protect";

const intelleum = new IntelleumProtectClient({
  baseUrl: "https://api.your-intelleum.app",
  apiKey: process.env.INTELLEUM_API_KEY,
});

const protectedSwap = await intelleum.assertSafeToExecute({
  route_key: "venue:orca_whirlpool:So11111111111111111111111111111111111111112->EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  protocol: "orca_whirlpool",
  input_mint: "So11111111111111111111111111111111111111112",
  output_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  notional_usd: 50_000,
  slippage_bps: 50,
  objective: "protect_users",
});

console.log(protectedSwap.action);
console.log(protectedSwap.expectedLossAtRiskUsd);
```

## Jupiter Quote Guard

```ts
import {
  IntelleumProtectClient,
  guardRequestFromJupiterQuote,
} from "@intelleum/protect";

const intelleum = new IntelleumProtectClient({
  baseUrl: process.env.INTELLEUM_API_URL!,
  apiKey: process.env.INTELLEUM_API_KEY,
});

const quote = await fetch("https://api.jup.ag/swap/v2/quote?...").then((res) => res.json());

const guard = await intelleum.guard(
  guardRequestFromJupiterQuote(quote, {
    notionalUsd: 25_000,
    slippageBps: 50,
    objective: "protect_users",
  }),
);

if (guard.action === "block" || guard.action === "avoid") {
  throw new Error(guard.warning);
}
```

## What This Unlocks

- Wallets can warn or block users before routing into toxic surfaces.
- Aggregators can downrank routes by expected toxic-flow cost, not just quoted output.
- LP protocols can protect pools by segmenting or throttling flow when adverse selection rises.
- Trading desks can cap order size dynamically using `recommended_max_notional_usd`.
- Market makers can monitor route and bundle-lane pressure without building a full detector.

## Core Calls

- `client.guard(request)` calls `POST /api/prevention/guard`.
- `client.evaluateRoute(request)` calls `POST /api/routes/evaluate`.
- `client.rankRoutes(request)` calls `POST /api/routes/rank`.
- `client.getPolicies()` calls `GET /api/routes/policies`.
- `client.getLiveAlerts()` calls `GET /api/integrations/live-alerts`.
- `client.getSavingsSummary()` calls `GET /api/savings/summary`.
