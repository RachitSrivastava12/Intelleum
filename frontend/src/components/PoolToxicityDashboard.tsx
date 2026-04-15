import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api, PoolToxicity } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canOpenSolscanAccount, formatPoolLabel, surfaceProtocolLabel, truncateAddress } from "@/lib/utils";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";
function formatUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function toxicityColor(score: number): string {
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-yellow-400";
  return "text-green-400";
}

function toxicityBg(score: number): string {
  if (score >= 70) return "bg-red-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-green-500";
}

export default function PoolToxicityDashboard() {
  const [pools, setPools] = useState<PoolToxicity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.pools(50);
        setPools(data);
      } finally {
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="font-mono">
      <div className="grid gap-3">
        {loading && (
          <div className="text-center text-muted-foreground text-xs py-8">
            <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
              Loading pool intelligence...
            </motion.span>
          </div>
        )}

        {pools.map((pool, i) => (
          <motion.div
            key={pool.pool_address}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="intel-panel p-4"
          >
            <div className="flex items-center justify-between">
              {/* Pool address */}
              <div className="flex items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-sm font-bold ${toxicityColor(pool.toxicity_score)}`}>
                      {pool.toxicity_score.toFixed(0)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Pool toxicity is a composite score based on sandwich frequency, arbitrage/JIT activity, attacker concentration, and estimated extracted value on this surface.
                  </TooltipContent>
                </Tooltip>
                <div>
                  <div className="text-sm text-foreground font-mono">
                    {surfaceProtocolLabel(pool.pool_address, pool.protocol)} ·{" "}
                    {canOpenSolscanAccount(pool.pool_address) ? (
                      <CopyableValue
                        value={pool.pool_address}
                        display={`${truncateAddress(pool.pool_address)} ↗`}
                        className="text-muted-foreground"
                      />
                    ) : (
                      <CopyableValue
                        value={pool.pool_address}
                        display={formatPoolLabel(pool.pool_address)}
                        className="text-muted-foreground"
                        title={formatPoolLabel(pool.pool_address)}
                      />
                    )}
                  </div>
                  {pool.top_entity_label && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Top extractor: <span className="text-yellow-400">{pool.top_entity_label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Attack breakdown */}
              <div className="hidden md:flex items-center gap-6 text-xs">
                <div>
                  <span className="text-muted-foreground">SANDWICH </span>
                  <span className="text-red-400">{pool.sandwich_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ARB </span>
                  <span className="text-yellow-400">{pool.arbitrage_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">JIT </span>
                  <span className="text-orange-400">{pool.jit_count}</span>
                </div>
              </div>

              {/* Extraction stats */}
              <div className="flex items-center gap-6 text-right">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Extracted <InfoHint text="Estimated searcher-side extracted value attributed to this pool or venue surface in the current dataset." />
                  </div>
                  <div className="text-sm font-bold text-primary">{formatUSD(pool.total_extracted_usd)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Attackers <InfoHint text="Unique attacker wallets observed on this pool or route surface." />
                  </div>
                  <div className="text-sm">{pool.unique_attackers}</div>
                </div>
              </div>
            </div>

            {/* Toxicity bar */}
            <div className="mt-3 w-full h-1 bg-border">
              <motion.div
                className={`h-full ${toxicityBg(pool.toxicity_score)}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pool.toxicity_score)}%` }}
                transition={{ duration: 0.8, delay: i * 0.03 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
