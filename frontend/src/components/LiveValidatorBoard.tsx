import { useEffect, useState } from "react";
import { api, ValidatorIntel } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";

function truncate(value: string) {
  if (!value) return "—";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatUSD(n: number) {
  if (!n) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatMix(validator: ValidatorIntel) {
  const parts = [
    validator.sandwich_count > 0 ? `S ${validator.sandwich_count}` : null,
    validator.arbitrage_count > 0 ? `A ${validator.arbitrage_count}` : null,
    validator.jit_count > 0 ? `J ${validator.jit_count}` : null,
    validator.liquidation_count > 0 ? `L ${validator.liquidation_count}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No classified attacks";
}

export default function LiveValidatorBoard() {
  const [validators, setValidators] = useState<ValidatorIntel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.validators();
        setValidators(data.slice(0, 12));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown validator error");
      }
    };

    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  const jitoDominant = validators.filter((validator) => (validator.jito_bundle_share ?? 0) >= 60).length;
  const avgBundleShare =
    validators.length > 0
      ? validators.reduce((sum, validator) => sum + (validator.jito_bundle_share ?? 0), 0) / validators.length
      : 0;
  const avgMarkoutQuality =
    validators.length > 0
      ? validators.reduce((sum, validator) => sum + (validator.markout_quality_score ?? 0), 0) / validators.length
      : 0;
  const avgCentralizationRisk =
    validators.length > 0
      ? validators.reduce((sum, validator) => sum + (validator.stake_centralization_risk ?? 0), 0) / validators.length
      : 0;
  const highRiskLeaders = validators.filter((validator) => (validator.stake_centralization_risk ?? 0) >= 65).length;

  return (
    <div className="intel-panel p-5 font-mono">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Validator Risk Surface</p>
        {error && <span className="text-xs text-yellow-300">{error}</span>}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="border border-border/60 bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Jito Pressure <InfoHint text="How much of the validator surface currently looks bundle-lane dominated rather than normal low-toxicity flow." />
          </div>
          <div className="mt-2 text-lg text-cyan-300">{avgBundleShare.toFixed(0)}%</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {jitoDominant} validators in jito-dominant regime
          </div>
        </div>
        <div className="border border-border/60 bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Markout Quality <InfoHint text="Higher means validator-associated flow is landing with cleaner downstream execution quality. Lower means worse post-trade deterioration." />
          </div>
          <div className="mt-2 text-lg text-foreground">{avgMarkoutQuality.toFixed(0)}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            validator-side execution quality
          </div>
        </div>
        <div className="border border-border/60 bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Centralization Risk <InfoHint text="Directional risk that toxic-flow profits are concentrated enough on this validator surface to reinforce future routing or stake power. This is not a delegated-stake reading." />
          </div>
          <div className="mt-2 text-lg text-red-300">{avgCentralizationRisk.toFixed(0)}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {highRiskLeaders} validators in concentration-risk regime
          </div>
        </div>
        <div className="border border-border/60 bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Reading <InfoHint text="This panel is directional intelligence, not proof of collusion. High risk means the validator is repeatedly co-occurring with toxic flow, bundle pressure, or weak post-trade quality." />
          </div>
          <div className="mt-2 text-sm leading-5 text-muted-foreground">
            Bundle share, priority-fee pressure, markout quality, sandwich concentration, and operator density in one surface.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {validators.length === 0 && !error && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Waiting for validator intelligence...
          </div>
        )}

        {validators.map((validator) => (
          <div key={validator.validator} className="grid gap-3 border border-border/70 p-3 md:grid-cols-[1.5fr,0.58fr,0.58fr,0.62fr,0.68fr,0.68fr,0.68fr,0.82fr]">
            <div>
              <CopyableValue
                value={validator.validator}
                display={truncate(validator.validator)}
                className="text-xs text-foreground"
                title={validator.validator}
              />
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {validator.total_mev_attacks} attacks · {validator.unique_entities} entities
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {formatMix(validator)} · {validator.regime ?? "mixed"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Risk <InfoHint text="Composite validator-side risk based on sandwich share, confirmed share, wide-bracket activity, entity concentration, extracted value, and observed priority-fee behavior." />
              </div>
              <div className="mt-1 text-sm text-red-300">{(validator.risk_score * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Sandwich <InfoHint text="Percent of observed attacks on this validator that were classified as sandwiches." />
              </div>
              <div className="mt-1 text-sm text-foreground">{(validator.observed_sandwich_rate ?? validator.sandwich_share).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Jito <InfoHint text="Approximate share of observed validator-side toxic flow that looks Jito-aligned or bundle-lane dominated." />
              </div>
              <div className="mt-1 text-sm text-cyan-300">{(validator.jito_bundle_share ?? 0).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Priority Fee <InfoHint text="Priority-fee / tip pressure proxy associated with flow landing on this validator." />
              </div>
              <div className="mt-1 text-sm text-foreground">{(validator.priority_fee_pressure ?? 0).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Markout <InfoHint text="Validator-level markout quality. Higher is cleaner; lower suggests worse downstream execution quality after flow lands." />
              </div>
              <div className="mt-1 text-sm text-foreground">{(validator.markout_quality_score ?? 0).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Concentration <InfoHint text="How concentrated the observed toxic-flow surface is into a small number of entities. Higher means fewer operators are dominating the validator-associated activity." />
              </div>
              <div className="mt-1 text-sm text-foreground">{(validator.entity_concentration_score ?? 0).toFixed(0)}</div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Extracted / Centralize</div>
                  <div className="mt-1 text-sm text-foreground">
                    {formatUSD(validator.total_extracted)} / {(validator.stake_centralization_risk ?? 0).toFixed(0)}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Extracted is estimated attacker-side value associated with this validator. Centralize is a directional risk score that the validator’s toxic-flow surface is concentrated enough to reinforce future routing or stake power.
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
}
