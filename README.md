# INTELLEUM V3
### MEV Intelligence Layer for Solana

Real-time detection and attribution of MEV (Maximal Extractable Value) extraction on Solana. Exposes sandwich attacks, arbitrage, JIT liquidity, liquidation sniping — clustered into named entities with behavioral fingerprints.

---

## Architecture

```
Helius RPC (you own this)
    │
    ▼
API Ingestion Loop / QuickNode Webhook
  ├─ Streams or receives Solana activity in real-time
  ├─ Extracts token flows (pre/post balance deltas)
  ├─ Detects: sandwich | arbitrage | JIT | liquidation
  └─ Clusters wallets → entities every ~80 slots
    │
    ▼
PostgreSQL (Render Starter $7/mo)
  ├─ mev_attacks
  ├─ entities + entity_wallets
  ├─ token_flows
  ├─ pool_toxicity
  └─ validator_stats
    │
    ▼
API Server (Render Web $7/mo)
  └─ /api/stats | /attacks | /entities | /pools | /validators | /routes | /wallet/:addr
    │
    ▼
TypeScript Protection SDK
  ├─ Drop-in guard for wallets, routers, trading backends, and LP desks
  ├─ Jupiter quote adapter
  └─ Block | reroute | penalize | allow decisions before execution
    │
    ▼
Frontend (Vercel free OR Render Static free)
  ├─ Landing page (your existing design, kept)
  ├─ Live dashboard (feed | entities | pools)
  ├─ Toxic Flow Terminal (route candles | markout | prevented loss)
  └─ Entity detail pages
```

**Total infra cost: ~$14/month on Render** (web service + Postgres starter)

---

## Deployment

Hostinger VPS backend deploy notes: [HOSTINGER_BACKEND_DEPLOY.md](./HOSTINGER_BACKEND_DEPLOY.md).

### 1. Render — Backend

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your repo and select `render.yaml`
4. Render will create: API web service + Postgres
5. In API service env vars, add:
   - `HELIUS_RPC_URL` = your Helius RPC URL (e.g. `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`)
   - `FRONTEND_URL` = your frontend URL (for CORS)
6. Optional: configure QuickNode Streams to post to `/api/streams/quicknode`

### 2. Frontend (Vercel — free)

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: set VITE_API_URL to your Render API URL
```

Then push to GitHub and connect to Vercel. Auto-deploys on every push.

### 3. Manual Deploy

```bash
# Backend API
cd backend
npm install
cp .env.example .env  # fill in DATABASE_URL and HELIUS_RPC_URL
npm run build
npm start             # starts API on port 8081

# Frontend
cd frontend
npm install
npm run dev           # dev server on localhost:5173
```

## Hackathon Strategy

For Frontier submission positioning, demo script, and next highest-leverage work, see [HACKATHON_STRATEGY.md](./HACKATHON_STRATEGY.md).

## Protection SDK

The dashboard explains the problem; the SDK helps teams stop leaking money before execution.

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

console.log(protectedSwap.savingsProof.estimated_loss_prevented_usd);
console.log(protectedSwap.protectedSendPolicy.submit_via);
```

SDK source and Jupiter adapter: [sdk/typescript](./sdk/typescript).

---

## API Reference

| Endpoint | Description |
|---|---|
| `GET /api/stats` | Global MEV stats (attacks, extracted USD, entities) |
| `GET /api/attacks?type=sandwich&limit=50` | Live attack feed |
| `GET /api/entities?sort=profit&strategy=sandwich` | Entity list |
| `GET /api/entities/:id` | Full entity profile |
| `GET /api/pools` | Pool toxicity rankings |
| `GET /api/pools/:address` | Pool detail |
| `GET /api/validators` | Validator MEV capture stats |
| `GET /api/routes/risk` | Route and venue risk rankings |
| `POST /api/routes/evaluate` | Pre-trade route decision |
| `POST /api/routes/rank` | Rank candidate routes by toxic execution risk |
| `POST /api/prevention/guard` | Wallet/protocol pre-trade guardrail |
| `POST /api/prevention/protected-send` | Guard decision plus savings proof and execution policy |
| `GET /api/terminal/toxic-flow` | Dexscreener-style toxic-flow candles with markout, loss-at-risk, and prevented loss |
| `GET /api/liquidations/firewall` | Liquidation regime firewall for lending/perps protocols |
| `GET /api/savings/summary` | Estimated loss avoided across routes and pools |
| `GET /api/wallet/:address` | Check if wallet is MEV actor |
| `POST /api/access/request` | Submit early access request |

---

## Entity Detection Logic

Entities are clustered using **behavioral signals**, not just wallet graph:

| Signal | Weight | Description |
|---|---|---|
| Fee Aggression | 25% | Pays 5-20x median priority fee |
| Position Dominance | 25% | Consistently lands in tx slot 0-3 |
| Pool Concentration | 15% | Targets 1-3 specific pools |
| Profit Consistency | 20% | Almost every interaction is profitable |
| Attack Count Bonus | 15% | Already detected in MEV attacks |

Two wallets are clustered into the same entity if:
- Both score >0.5 on behavioral fingerprint
- Pool targeting Jaccard similarity >0.3
- OR appear as attacker in same slot + pool

---

## What's Different From V1

| V1 | V2 |
|---|---|
| CSV-based batch pipeline | Real-time streaming |
| Shared accounts clustering (noisy) | Behavioral fingerprinting (precise) |
| No token flow analysis | Full pre/post balance delta extraction |
| One waitlist route only | Full REST API (7 endpoints) |
| Hardcoded fake data in frontend | Real API-connected frontend |
| Broken sandwich detection | Token-delta verified detection |
| No profit calculation | USD profit/loss per attack |
| No entity profiles | Full entity detail pages |
