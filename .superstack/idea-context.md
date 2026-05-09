# Idea Context: Intelleum

## Domain

Solana toxic order-flow detection, prevention, and enforcement for routers, wallets, AMMs, LP venues, lending protocols, perps, launchpads, trading terminals, and infrastructure providers.

## Landscape

```json
{
  "direct_competitors": [
    {
      "name": "Jupiter Ultra / Swap API V2",
      "url": "https://dev.jup.ag/docs",
      "status": "live",
      "strength": "Best execution, managed landing, RTSE slippage, MEV protection through private execution paths.",
      "weakness": "Optimizes Jupiter execution; not a neutral cross-venue toxic-flow intelligence and policy layer."
    },
    {
      "name": "Jito DontFront / Block Engine",
      "url": "https://solana.com/developers/guides/advanced/mev-protection",
      "status": "live",
      "strength": "Concrete transaction-level primitive for reducing sandwich exposure.",
      "weakness": "Submission primitive, not a detection, route-ranking, savings-reporting, or entity-risk platform."
    },
    {
      "name": "Wallet token/security warnings",
      "url": "https://phantom.com/about",
      "status": "live",
      "strength": "Mass consumer distribution and simple user warnings.",
      "weakness": "Mostly token/account safety; does not explain live route toxicity, JIT pressure, liquidation regimes, or LP adverse selection."
    }
  ],
  "substitutes": [
    {
      "name": "Manual slippage tuning",
      "approach": "Users set tighter slippage in wallets/routers.",
      "why_users_stay": "Native, free, and familiar, but it does not understand route-specific toxicity."
    },
    {
      "name": "Private RPC / protected send",
      "approach": "Submit transactions through private or Jito-aware paths.",
      "why_users_stay": "Reduces exposure, but does not decide whether a route, pool, operator, or liquidation regime is toxic."
    },
    {
      "name": "Post-trade dashboards",
      "approach": "Analytics after value has already leaked.",
      "why_users_stay": "Good for visibility, weak for prevention."
    }
  ],
  "dead_projects": [],
  "crowdedness": "crowded",
  "moat_type": "cross-venue data + enforcement integration + savings proof",
  "differentiation": "Intelleum should be the neutral pre-trade toxic-flow firewall: detect, decide, enforce, and prove dollars saved across Solana execution surfaces."
}
```

## P0 Hackathon Focus

1. Savings Proof Console: every guard decision shows estimated dollars and bps saved.
2. Protected Route Middleware: SDK ranks routes, blocks toxic paths, caps notional, and recommends protected submission.
3. LP Toxicity Score: pool-level score for Raydium, Meteora, Orca, and PumpSwap showing adverse selection and JIT pressure.
4. Liquidation Firewall: Drift/Kamino/Save/marginfi liquidation regime monitor with operator quality signals.

## Pitch Line

Intelleum is the real-time toxic-flow firewall for Solana execution. It does not just chart attacks after the damage; it blocks, reroutes, or caps toxic routes before money leaks.
