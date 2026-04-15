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
    const load = async () => {
      try {
        const data = await api.routeRisks(20);
        setRoutes(data);
      } finally {
        setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-2 font-mono">
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
          <div className="grid gap-4 md:grid-cols-[1.7fr,0.6fr,0.75fr,0.8fr,0.7fr,0.75fr]">
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
              <div className={`mt-1 text-sm uppercase ${recommendationTone(route.recommendation)}`}>
                {route.recommendation}
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
          </div>
        </motion.div>
      ))}
    </div>
  );
}
