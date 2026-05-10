import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, RouteRisk } from "@/lib/api";
import { formatPoolLabel, surfaceProtocolLabel } from "@/lib/utils";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";

function formatUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function recommendationTone(value: RouteRisk["recommendation"]) {
  if (value === "avoid") return "text-red-300";
  if (value === "penalize") return "text-yellow-300";
  return "text-cyan-300";
}

function riskTone(score: number) {
  if (score >= 80) return "text-red-400";
  if (score >= 55) return "text-yellow-300";
  return "text-green-300";
}

function attackMix(route: RouteRisk) {
  return [
    route.sandwich_count > 0 ? `S ${route.sandwich_count}` : null,
    route.backrun_count > 0 ? `B ${route.backrun_count}` : null,
    route.jit_count > 0 ? `J ${route.jit_count}` : null,
    route.arbitrage_count > 0 ? `A ${route.arbitrage_count}` : null,
    route.liquidation_count > 0 ? `L ${route.liquidation_count}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function RouteRiskBoard() {
  const [routes, setRoutes] = useState<RouteRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let first = true;
    const load = async () => {
      try {
        const data = await api.routeRisks(20);
        setRoutes(data);
      } finally {
        if (first) { setLoading(false); first = false; }
      }
    };

    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  const totalAvoided = routes.reduce((sum, route) => sum + route.estimated_savings_usd, 0);
  const avgMarkout = routes.length > 0 ? routes.reduce((sum, route) => sum + route.markout_30s_bps, 0) / routes.length : 0;
  const flaggedRoutes = routes.filter((route) => route.policy_action === "avoid" || route.policy_action === "reroute").length;

  return (
    <div className="space-y-2 font-mono">
      {!loading && routes.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="intel-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Estimated Savings <InfoHint text="Protected execution value if currently flagged routes are rerouted or blocked instead of sent through toxic surfaces." />
            </div>
            <div className="mt-2 text-lg text-primary">{formatUSD(totalAvoided)}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">current route surface</div>
          </div>
          <div className="intel-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Markout 30s <InfoHint text="Average post-trade adverse markout across ranked route surfaces. Lower is better." />
            </div>
            <div className="mt-2 text-lg text-foreground">{avgMarkout.toFixed(1)} bps</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">execution deterioration</div>
          </div>
          <div className="intel-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Routes to Act On <InfoHint text="Routes currently serious enough to reroute or avoid based on risk, markouts, bundle pressure, and LP adverse selection." />
            </div>
            <div className="mt-2 text-lg text-cyan-300">{flaggedRoutes}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">reroute or avoid</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
            Building route risk surface...
          </motion.span>
        </div>
      )}

      {routes.map((route, index) => (
        <motion.div
          key={route.route_key}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03 }}
          className="intel-panel p-4"
        >
          <div className="grid gap-4 md:grid-cols-[1.55fr,0.55fr,0.7fr,0.7fr,0.65fr,0.65fr,0.7fr]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {surfaceProtocolLabel(route.route_key, route.protocol)} · {route.route_kind}
              </div>
              <CopyableValue
                value={route.route_key}
                display={route.label || formatPoolLabel(route.route_key)}
                className="mt-1 block text-sm text-foreground"
              />
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {attackMix(route) || "No classified mix"} · {route.unique_attackers} operators
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Risk <InfoHint text="Composite route risk score that weights sandwiches, backruns, JIT activity, liquidation pressure, extracted value, attacker diversity, and average confidence." />
              </div>
              <div className={`mt-1 text-sm ${riskTone(route.risk_score)}`}>{route.risk_score.toFixed(0)}</div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Action <InfoHint text="Suggested routing treatment. Avoid means the route looks structurally toxic, penalize means it should likely be downranked, and monitor means keep watching." />
              </div>
              <div className={`mt-1 text-sm uppercase ${recommendationTone(route.policy_action === "reroute" ? "penalize" : route.recommendation)}`}>
                {route.policy_action}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Extracted <InfoHint text="Estimated attacker-side value captured on this route or venue surface in the current dataset." />
              </div>
              <div className="mt-1 text-sm text-primary">{formatUSD(route.total_extracted_usd)}</div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Bundle <InfoHint text="Approximate share of detections on this route that look Jito-aligned or otherwise bundle-like." />
              </div>
              <div className="mt-1 text-sm text-foreground">{route.bundle_share.toFixed(0)}%</div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Confidence <InfoHint text="Average confidence of the detections contributing to this route-risk surface." />
              </div>
              <div className="mt-1 text-sm text-foreground">{route.avg_confidence.toFixed(0)}%</div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Quality <InfoHint text="Execution-quality score based on markouts, realized slippage, quote freshness, and observed toxic-flow pressure." />
              </div>
              <div className="mt-1 text-sm text-cyan-300">{route.execution_quality_score.toFixed(0)}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 border-t border-border/50 pt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:grid-cols-6">
            <div>
              Markout 30s <InfoHint text="Expected post-trade adverse markout proxy. Higher = more stale-quote / toxic-flow risk after execution." />
              <div className="mt-1 text-foreground">{route.markout_30s_bps.toFixed(1)} bps</div>
            </div>
            <div>
              LVR Proxy <InfoHint text="Loss-versus-rebalancing style proxy capturing how much LPs are likely being picked off on this execution surface." />
              <div className="mt-1 text-foreground">{route.lvr_proxy_score.toFixed(0)}</div>
            </div>
            <div>
              Toxic Flow <InfoHint text="Composite estimate of hostile / informed flow pressure on this route." />
              <div className="mt-1 text-foreground">{route.toxic_flow_rate.toFixed(0)}%</div>
            </div>
            <div>
              Quote Freshness <InfoHint text="Lower means quotes are likely going stale faster before they are consumed." />
              <div className="mt-1 text-foreground">{route.quote_freshness_ms.toFixed(0)} ms</div>
            </div>
            <div>
              Safe Size <InfoHint text="Approximate max notional to route before toxicity and adverse selection likely worsen materially." />
              <div className="mt-1 text-foreground">{formatUSD(route.recommended_max_notional_usd)}</div>
            </div>
            <div>
              Saved <InfoHint text="Estimated routing value preserved if this surface is downranked or avoided." />
              <div className="mt-1 text-foreground">{route.estimated_savings_bps.toFixed(2)} bps · {formatUSD(route.estimated_savings_usd)}</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/40 pt-3 text-[10px] uppercase tracking-[0.16em]">
            <span className="border border-border/60 px-2 py-1 text-muted-foreground">
              Source · <span className="text-foreground">{route.source_hint}</span>
            </span>
            {route.reason_codes.slice(0, 3).map((reason) => (
              <span key={reason} className="border border-border/60 px-2 py-1 text-muted-foreground">
                {reason.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
