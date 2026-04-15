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
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="intel-panel p-5 font-mono">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">// Validator Risk Surface</p>
        {error && <span className="text-xs text-yellow-300">{error}</span>}
      </div>

      <div className="mb-4 text-[11px] leading-5 text-muted-foreground">
        Risk is currently based on confirmed attack share, sandwich and wide-sandwich concentration, attack mix, entity concentration, extracted value, and observed priority-fee behavior.
        It is not a direct proof of validator collusion.
      </div>

      <div className="space-y-2">
        {validators.length === 0 && !error && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Waiting for validator intelligence...
          </div>
        )}

        {validators.map((validator) => (
          <div key={validator.validator} className="grid gap-3 border border-border/70 p-3 md:grid-cols-[1.7fr,0.65fr,0.75fr,0.75fr,0.8fr,0.8fr]">
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
                {formatMix(validator)}
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
              <div className="mt-1 text-sm text-foreground">{validator.sandwich_share.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Confirmed <InfoHint text="Share of attacks on this validator that reached the stronger confirmed quality bucket rather than a weaker likely classification." />
              </div>
              <div className="mt-1 text-sm text-foreground">{validator.confirmed_share.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Extracted <InfoHint text="Estimated attacker-side extracted value associated with attacks landing on this validator." />
              </div>
              <div className="mt-1 text-sm text-primary">{formatUSD(validator.total_extracted)}</div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Wide / Priority Fee</div>
                  <div className="mt-1 text-sm text-foreground">
                    {validator.wide_sandwich_share.toFixed(1)}% / {validator.avg_tip_lamports > 0 ? Math.round(validator.avg_tip_lamports).toLocaleString() : "—"}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Wide means the share of sandwich attacks that were classified as multi-slot brackets. The fee value is observed compute-budget priority fee, not full Jito or validator payment measurement.
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
}
