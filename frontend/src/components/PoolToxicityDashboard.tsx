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

  const totalLpDrag = pools.reduce((sum, pool) => sum + (pool.lp_drag_estimate_usd ?? 0), 0);
  const avgLvr = pools.length > 0 ? pools.reduce((sum, pool) => sum + (pool.lvr_proxy_score ?? 0), 0) / pools.length : 0;
  const stressedPools = pools.filter((pool) => (pool.quote_freshness_stress ?? 0) >= 50 || (pool.lvr_proxy_score ?? 0) >= 50).length;

  return (
    <div className="font-mono">
      {!loading && pools.length > 0 && (
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div className="intel-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              LP Drag <InfoHint text="Aggregate LP-side drag proxy across surfaced toxic pools." />
            </div>
            <div className="mt-2 text-lg text-primary">{formatUSD(totalLpDrag)}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">estimated adverse selection cost</div>
          </div>
          <div className="intel-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              LVR Pressure <InfoHint text="Average LVR-style pressure across currently surfaced pools." />
            </div>
            <div className="mt-2 text-lg text-foreground">{avgLvr.toFixed(0)}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">loss-versus-rebalancing proxy</div>
          </div>
          <div className="intel-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Stressed Pools <InfoHint text="Pools with materially stale quote pressure or elevated LVR proxy that deserve segmentation or reranking." />
            </div>
            <div className="mt-2 text-lg text-cyan-300">{stressedPools}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">segment or downrank</div>
          </div>
        </div>
      )}

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

            <div className="mt-3 grid gap-2 border-t border-border/50 pt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:grid-cols-6">
              <div>
                LVR Proxy <InfoHint text="Loss-versus-rebalancing style proxy for how much stale-quote drag LPs are experiencing on this pool." />
                <div className="mt-1 text-foreground">{pool.lvr_proxy_score?.toFixed(0) ?? "—"}</div>
              </div>
              <div>
                LP Drag <InfoHint text="Estimated LP-side drag proxy attributed to observed extraction on this pool." />
                <div className="mt-1 text-foreground">{pool.lp_drag_estimate_usd != null ? formatUSD(pool.lp_drag_estimate_usd) : "—"}</div>
              </div>
              <div>
                Stale Quote <InfoHint text="Frequency proxy for stale-quote arbitrage / quote pickup behavior on this pool." />
                <div className="mt-1 text-foreground">{pool.stale_quote_arb_frequency?.toFixed(0) ?? "—"}%</div>
              </div>
              <div>
                Adverse Sel. <InfoHint text="Adverse selection intensity proxy showing how often informed flow is likely picking off this venue." />
                <div className="mt-1 text-foreground">{pool.adverse_selection_intensity?.toFixed(0) ?? "—"}</div>
              </div>
              <div>
                Fee Saved <InfoHint text="Estimated fee basis points this pool could preserve if toxic flow is segmented or downranked." />
                <div className="mt-1 text-foreground">{pool.saved_fee_bps_if_segmented?.toFixed(1) ?? "—"} bps</div>
              </div>
              <div>
                Cause <InfoHint text="Dominant primary cause behind the pool’s current toxicity profile." />
                <div className="mt-1 text-foreground">{pool.primary_cause ?? "—"}</div>
              </div>
            </div>

            {pool.reason_codes && pool.reason_codes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {pool.reason_codes.slice(0, 3).map((reason) => (
                  <span key={reason} className="border border-border/60 px-2 py-1">
                    {reason.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            )}

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
