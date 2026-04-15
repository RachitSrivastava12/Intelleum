# INTELLEUM V2
### MEV Intelligence Layer for Solana

Real-time detection and attribution of MEV (Maximal Extractable Value) extraction on Solana. Exposes sandwich attacks, arbitrage, JIT liquidity, liquidation sniping — clustered into named entities with behavioral fingerprints.

---

## Architecture

```
Helius RPC (you own this)
    │
    ▼
Background Worker (Render Worker $7/mo)
  ├─ Streams blocks in real-time
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
  └─ /api/stats | /attacks | /entities | /pools | /validators | /wallet/:addr
    │
    ▼
Frontend (Vercel free OR Render Static free)
  ├─ Landing page (your existing design, kept)
  ├─ Live dashboard (feed | entities | pools)
  └─ Entity detail pages
```

**Total infra cost: ~$21/month on Render**

---

## Deployment

### 1. Render — Backend

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your repo and select `render.yaml`
4. Render will create: API web service + worker + Postgres
5. In API service env vars, add:
   - `HELIUS_RPC_URL` = your Helius RPC URL (e.g. `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`)
   - `FRONTEND_URL` = your frontend URL (for CORS)
6. In Worker env vars, add same `HELIUS_RPC_URL`

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

# Background worker (separate terminal)
npm run start:worker

# Frontend
cd frontend
npm install
npm run dev           # dev server on localhost:5173
```

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
