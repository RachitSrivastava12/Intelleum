import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  api,
  ExecutionQualitySnapshot,
  FlowSegment,
  LpProtectionSnapshot,
  PredictionMarketExecution,
  PreventionGuard,
  RoutePolicy,
  RouteRisk,
  SavingsSummary,
  SourceAttribution,
  ValidatorIntel,
} from "@/lib/api";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPoolLabel, surfaceProtocolLabel } from "@/lib/utils";

function formatUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function OrderflowWorkbench() {
  const [execution, setExecution] = useState<ExecutionQualitySnapshot[]>([]);
  const [lpProtection, setLpProtection] = useState<LpProtectionSnapshot[]>([]);
  const [segments, setSegments] = useState<FlowSegment[]>([]);
  const [sources, setSources] = useState<SourceAttribution[]>([]);
  const [policies, setPolicies] = useState<Array<RoutePolicy & { route?: RouteRisk }>>([]);
  const [guard, setGuard] = useState<PreventionGuard | null>(null);
  const [validators, setValidators] = useState<ValidatorIntel[]>([]);
  const [prediction, setPrediction] = useState<PredictionMarketExecution[]>([]);
  const [savings, setSavings] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [nextExecution, nextLp, nextFlow, nextPolicies, nextGuard, nextValidators, nextPrediction, nextSavings, routeRisks] =
          await Promise.all([
            api.executionQuality(6),
            api.lpProtection(6),
            api.flowSegments(),
            api.routePolicies(6, "protect_users"),
            api.preventionGuard({
              input_mint: "So11111111111111111111111111111111111111112",
              output_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              notional_usd: 50_000,
              slippage_bps: 30,
              objective: "protect_users",
            }),
            api.validatorRegimes(4),
            api.predictionMarketExecution(4),
            api.savingsSummary(),
            api.routeRisks(6),
          ]);

        setExecution(nextExecution);
        setLpProtection(nextLp);
        setSegments(nextFlow.segments);
        setSources(nextFlow.sources);
        setPolicies(
          nextPolicies.map((policy) => ({
            ...policy,
            route: routeRisks.find((route: RouteRisk) => route.route_key === policy.route_key),
          })),
        );
        setGuard(nextGuard);
        setValidators(nextValidators);
        setPrediction(nextPrediction);
        setSavings(nextSavings);
      } finally {
        setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-5 font-mono">
      {loading && (
        <div className="grid gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="intel-panel p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-28" />
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-4">
        {savings && [
          { label: "Loss Avoided 24H", value: formatUSD(savings.estimated_loss_avoided_usd_24h), hint: "Estimated dollar loss Intelleum could help avoid across flagged routes in the current 24h-style sample." },
          { label: "Avg Bps Saved", value: `${savings.estimated_bps_saved_avg.toFixed(2)} bps`, hint: "Average estimated basis points saved by rerouting away from the most toxic routes." },
          { label: "Routes Flagged", value: String(savings.routes_flagged), hint: "Number of routes that currently look bad enough to reroute or avoid." },
          { label: "Pools Protected", value: String(savings.pools_protected), hint: "Pools with meaningful LVR / adverse-selection pressure that Intelleum is flagging right now." },
        ].map((card) => (
          <div key={card.label} className="intel-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {card.label} <InfoHint text={card.hint} />
            </div>
            <div className="mt-2 text-xl text-primary">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="intel-panel p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Execution Quality <InfoHint text="Route-level execution quality, quote freshness, realized slippage, and post-trade markout proxies." />
          </div>
          <div className="space-y-3">
            {execution.map((item, index) => (
              <motion.div
                key={item.route_key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="border border-border/60 p-3"
              >
                <CopyableValue value={item.route_key} display={item.label} className="text-sm text-foreground" />
                <div className="mt-2 grid gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:grid-cols-4">
                  <div>quality {item.execution_quality_score.toFixed(0)}</div>
                  <div>slippage {item.realized_slippage_bps.toFixed(1)}bps</div>
                  <div>quote {item.quote_freshness_ms.toFixed(0)}ms</div>
                  <div>toxic flow {item.toxic_flow_rate.toFixed(0)}%</div>
                </div>
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                  <div>markout 1s <span className="text-primary">{item.markout_1s_bps.toFixed(1)} bps</span></div>
                  <div>markout 5s <span className="text-primary">{item.markout_5s_bps.toFixed(1)} bps</span></div>
                  <div>markout 30s <span className="text-primary">{item.markout_30s_bps.toFixed(1)} bps</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="intel-panel p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Prevention Guard <InfoHint text="This is the decision layer buyers actually pay for: what to do before sending more user flow into a hostile surface." />
          </div>
          {guard && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Action</div>
                <div className="mt-1 text-lg text-primary">{guard.action.toUpperCase()}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{guard.reason_codes.slice(0, 3).join(" · ")}</div>
              </div>
              <div className="grid gap-2 text-xs md:grid-cols-2">
                <div>loss at risk <span className="text-primary">{guard.expected_loss_at_risk_bps.toFixed(1)} bps</span></div>
                <div>loss at risk usd <span className="text-primary">{formatUSD(guard.expected_loss_at_risk_usd)}</span></div>
                <div>max safe size <span className="text-primary">{formatUSD(guard.recommended_max_notional_usd)}</span></div>
                <div>route <span className="text-primary">{guard.selected_label}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="intel-panel p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            LP Protection <InfoHint text="Where LPs are getting picked off, how much drag is showing up, and what kind of stale-quote pressure is present." />
          </div>
          <div className="space-y-3">
            {lpProtection.map((pool) => (
              <div key={pool.pool_address} className="border border-border/60 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {surfaceProtocolLabel(pool.pool_address, pool.protocol)}
                </div>
                <CopyableValue value={pool.pool_address} display={formatPoolLabel(pool.pool_address)} className="mt-1 block text-sm text-foreground" />
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                  <div>lvr proxy <span className="text-primary">{pool.lvr_proxy_score.toFixed(0)}</span></div>
                  <div>lp drag <span className="text-primary">{formatUSD(pool.lp_drag_estimate_usd)}</span></div>
                  <div>stale quote arb <span className="text-primary">{pool.stale_quote_arb_frequency.toFixed(0)}%</span></div>
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {pool.primary_cause}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="intel-panel p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Flow Segments <InfoHint text="Orderflow segmentation turns raw MEV events into source-aware policy and venue decisions." />
          </div>
          <div className="space-y-3">
            {segments.slice(0, 4).map((segment) => (
              <div key={segment.segment} className="border border-border/60 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground">{segment.segment}</div>
                <div className="mt-2 grid gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:grid-cols-4">
                  <div>share {segment.flow_share.toFixed(0)}%</div>
                  <div>count {segment.attack_count}</div>
                  <div>confidence {segment.avg_confidence.toFixed(0)}%</div>
                  <div>toxicity {segment.toxicity_probability.toFixed(0)}%</div>
                </div>
              </div>
            ))}
            <div className="border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Top Sources</div>
              <div className="mt-2 space-y-2">
                {sources.slice(0, 4).map((source) => (
                  <div key={source.source_key} className="grid grid-cols-[1.2fr,0.7fr,0.7fr,0.7fr] gap-2 text-xs">
                    <div className="text-foreground">{source.label}</div>
                    <div>{source.flow_quality_score.toFixed(0)} fq</div>
                    <div>{source.toxicity_probability.toFixed(0)} tox</div>
                    <div>{source.endorser_inference}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr,1fr]">
        <div className="intel-panel p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Route Policy Engine <InfoHint text="This converts route analytics into explicit allow / monitor / penalize / reroute / avoid policies with evidence." />
          </div>
          <div className="space-y-3">
            {policies.map((policy) => (
              <div key={policy.route_key} className="border border-border/60 p-3">
                <CopyableValue value={policy.route_key} display={policy.label} className="text-sm text-foreground" />
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                  <div>action <span className="text-primary">{policy.policy_action}</span></div>
                  <div>safe size <span className="text-primary">{formatUSD(policy.recommended_max_notional_usd)}</span></div>
                  <div>save <span className="text-primary">{formatUSD(policy.estimated_savings_usd)}</span></div>
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {(policy.reason_codes ?? []).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="intel-panel p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Validator + Prediction Markets <InfoHint text="Tie bundle lanes and validator regimes back to execution quality, then reuse it for prediction-market style routing." />
          </div>
          <div className="space-y-3">
            {validators.slice(0, 3).map((validator) => (
              <div key={validator.validator} className="border border-border/60 p-3">
                <CopyableValue value={validator.validator} display={validator.validator} className="text-sm text-foreground" />
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-4">
                  <div>regime <span className="text-primary">{validator.regime}</span></div>
                  <div>bundle <span className="text-primary">{validator.jito_bundle_share?.toFixed(0)}%</span></div>
                  <div>fee pressure <span className="text-primary">{validator.priority_fee_pressure?.toFixed(0)}</span></div>
                  <div>markout q <span className="text-primary">{validator.markout_quality_score?.toFixed(0)}</span></div>
                </div>
              </div>
            ))}
            <div className="border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prediction-market routes</div>
              <div className="mt-2 space-y-2">
                {prediction.slice(0, 3).map((entry) => (
                  <div key={entry.route_key} className="grid grid-cols-[1.4fr,0.8fr,0.8fr] gap-2 text-xs">
                    <div className="text-foreground">{entry.label}</div>
                    <div>{entry.recommended_action}</div>
                    <div>{entry.estimated_slippage_bps.toFixed(1)} bps</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
