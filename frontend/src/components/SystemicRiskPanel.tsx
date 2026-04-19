import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, Entity, ValidatorIntel } from "@/lib/api";
import InfoHint from "@/components/InfoHint";

function formatUSD(n: number) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function truncate(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function SystemicRiskPanel() {
  const [validators, setValidators] = useState<ValidatorIntel[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    const load = async () => {
      const [validatorData, entityData] = await Promise.all([
        api.validatorRegimes(6),
        api.entities({ sort: "risk", limit: "12" }),
      ]);
      setValidators(validatorData);
      setEntities(entityData);
    };

    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, []);

  const avgCentralizationRisk =
    validators.length > 0
      ? validators.reduce((sum, validator) => sum + (validator.stake_centralization_risk ?? 0), 0) / validators.length
      : 0;
  const highRiskLeaders = validators.filter((validator) => (validator.stake_centralization_risk ?? 0) >= 65).length;
  const concentratedEntities = entities.filter((entity) => entity.wallet_count >= 2 && entity.risk_score >= 0.7).length;
  const concentratedProfit = entities
    .slice(0, 3)
    .reduce((sum, entity) => sum + (entity.total_profit_usd ?? 0), 0);
  const recommendedLeaderAction =
    avgCentralizationRisk >= 72
      ? "reroute away from high-risk leaders"
      : avgCentralizationRisk >= 52
        ? "monitor leader concentration closely"
        : "observe and keep routing flexible";

  return (
    <div className="intel-panel p-4 font-mono">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Systemic Risk
          <InfoHint text="Translate toxic-flow extraction into validator concentration and operator concentration risk, following the stake-centralization and sandwich-rate concerns raised in current Solana MEV research." />
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          network health
        </div>
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Centralization Risk</div>
          <div className="mt-2 text-lg text-red-300">{avgCentralizationRisk.toFixed(0)}</div>
        </div>
        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">High-Risk Leaders</div>
          <div className="mt-2 text-lg text-foreground">{highRiskLeaders}</div>
        </div>
        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Clustered Entities</div>
          <div className="mt-2 text-lg text-foreground">{concentratedEntities}</div>
        </div>
        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Top-3 Extracted</div>
          <div className="mt-2 text-lg text-primary">{formatUSD(concentratedProfit)}</div>
        </div>
      </div>

      <div className="mb-3 border border-border/60 bg-background/30 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Recommended posture:
        <span className="ml-2 text-primary">{recommendedLeaderAction}</span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="border border-border/60 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Leader Exposure
          </div>
          <div className="space-y-2">
            {validators.slice(0, 4).map((validator, index) => (
              <motion.div
                key={validator.validator}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="grid grid-cols-[1.15fr,0.6fr,0.6fr] gap-2 border border-border/50 px-3 py-2 text-xs"
              >
                <div className="truncate text-foreground" title={validator.validator}>
                  {truncate(validator.validator)}
                </div>
                <div className="text-muted-foreground">{(validator.observed_sandwich_rate ?? validator.sandwich_share).toFixed(1)}% sandwich</div>
                <div className="text-muted-foreground">{(validator.stake_centralization_risk ?? 0).toFixed(0)} centralize</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="border border-border/60 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Concentrated Operators
          </div>
          <div className="space-y-2">
            {entities.slice(0, 4).map((entity, index) => (
              <motion.div
                key={entity.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="grid grid-cols-[1.1fr,0.55fr,0.55fr] gap-2 border border-border/50 px-3 py-2 text-xs"
              >
                <div className="truncate text-foreground">
                  {entity.label ?? `ENT-${entity.id.slice(0, 8).toUpperCase()}`}
                </div>
                <div className="text-muted-foreground">{entity.wallet_count} wallets</div>
                <div className="text-muted-foreground">{(entity.risk_score * 100).toFixed(0)} risk</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
