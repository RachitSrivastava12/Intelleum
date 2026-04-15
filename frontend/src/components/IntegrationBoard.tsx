import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, LiveAlert, RouteRecommendation } from "@/lib/api";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";
import { formatRelativeTime } from "@/lib/utils";

function severityTone(value: LiveAlert["severity"]) {
  if (value === "critical") return "text-red-300";
  if (value === "high") return "text-yellow-300";
  return "text-cyan-300";
}

function actionTone(value: LiveAlert["action"]) {
  if (value === "block") return "text-red-300";
  if (value === "penalize") return "text-yellow-300";
  return "text-cyan-300";
}

export default function IntegrationBoard() {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [recommendations, setRecommendations] = useState<RouteRecommendation[]>([]);

  useEffect(() => {
    const load = async () => {
      const [nextAlerts, nextRecommendations] = await Promise.all([
        api.liveAlerts(4),
        api.routeRecommendations(3),
      ]);
      setAlerts(nextAlerts);
      setRecommendations(nextRecommendations);
    };

    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
      <div className="intel-panel p-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Live Alert Feed <InfoHint text="Webhook-style alert output that protocols, routers, or risk systems could ingest directly." />
        </div>
        <div className="space-y-3 font-mono">
          {alerts.map((alert) => (
            <div key={alert.id} className="border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-[10px] uppercase tracking-[0.2em] ${severityTone(alert.severity)}`}>
                    {alert.severity} · {alert.attack_type}
                  </div>
                  <div className="mt-1 text-sm text-foreground">{alert.summary}</div>
                  <CopyableValue
                    value={alert.route_key}
                    display={alert.route_label}
                    className="mt-1 block text-xs text-primary"
                  />
                </div>
                <div className="text-right">
                  <div className={`text-[10px] uppercase tracking-[0.2em] ${actionTone(alert.action)}`}>
                    {alert.action}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {formatRelativeTime(alert.block_time)}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <div>confidence {alert.confidence.toFixed(0)}%</div>
                <div>bundle {alert.bundle_likelihood.toFixed(0)}%</div>
                <CopyableValue value={alert.attacker_wallet} display={`actor ${alert.attacker_wallet.slice(0, 4)}...${alert.attacker_wallet.slice(-4)}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="intel-panel p-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Route Recommendations <InfoHint text="Actionable routing guidance generated from current route-risk and hostile-flow pressure." />
        </div>
        <div className="space-y-3 font-mono">
          {recommendations.map((entry, index) => (
            <motion.div
              key={`${entry.input_mint}-${entry.output_mint}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="border border-border/60 p-3"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                pair recommendation
              </div>
              {entry.recommended_routes.map((route) => (
                <div key={route.route_key} className="mt-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                    {route.recommendation}
                  </div>
                  <CopyableValue value={route.route_key} display={route.label} className="mt-1 block text-sm text-foreground" />
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    risk {route.risk_score.toFixed(0)} · {route.rationale[0]}
                  </div>
                </div>
              ))}
              {entry.avoid_routes[0] && (
                <div className="mt-3 border-t border-border/50 pt-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-red-300">avoid</div>
                  <CopyableValue
                    value={entry.avoid_routes[0].route_key}
                    display={entry.avoid_routes[0].label}
                    className="mt-1 block text-sm text-foreground"
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    risk {entry.avoid_routes[0].risk_score.toFixed(0)} · {entry.avoid_routes[0].rationale[0]}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
