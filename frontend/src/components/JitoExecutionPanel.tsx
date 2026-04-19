import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, ValidatorIntel } from "@/lib/api";
import InfoHint from "@/components/InfoHint";

function truncate(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function JitoExecutionPanel() {
  const [validators, setValidators] = useState<ValidatorIntel[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await api.validatorRegimes(4);
      setValidators(data);
    };

    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, []);

  const avgBundle =
    validators.length > 0
      ? validators.reduce((sum, validator) => sum + (validator.jito_bundle_share ?? 0), 0) / validators.length
      : 0;
  const avgMarkout =
    validators.length > 0
      ? validators.reduce((sum, validator) => sum + (validator.markout_quality_score ?? 0), 0) / validators.length
      : 0;
  const hotLanes = validators.filter((validator) => (validator.priority_fee_pressure ?? 0) >= 50).length;

  return (
    <div className="intel-panel p-4 font-mono">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Jito + Execution Lanes
          <InfoHint text="Bundle pressure, priority-fee pressure, and validator-side markout quality summarized in one compact execution-lane surface." />
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          blockspace intelligence
        </div>
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">bundle share</div>
          <div className="mt-2 text-lg text-cyan-300">{avgBundle.toFixed(0)}%</div>
        </div>
        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">markout quality</div>
          <div className="mt-2 text-lg text-foreground">{avgMarkout.toFixed(0)}</div>
        </div>
        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">hot lanes</div>
          <div className="mt-2 text-lg text-primary">{hotLanes}</div>
        </div>
      </div>

      <div className="space-y-2">
        {validators.map((validator, index) => (
          <motion.div
            key={validator.validator}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="grid grid-cols-[1.2fr,0.7fr,0.7fr,0.8fr] gap-2 border border-border/60 px-3 py-2 text-xs"
          >
            <div className="truncate text-foreground" title={validator.validator}>
              {truncate(validator.validator)} <span className="text-muted-foreground">· {validator.regime ?? "mixed"}</span>
            </div>
            <div className="text-muted-foreground">{(validator.jito_bundle_share ?? 0).toFixed(0)}% bundle</div>
            <div className="text-muted-foreground">{(validator.priority_fee_pressure ?? 0).toFixed(0)} fee</div>
            <div className="text-muted-foreground">{(validator.markout_quality_score ?? 0).toFixed(0)} markout</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
