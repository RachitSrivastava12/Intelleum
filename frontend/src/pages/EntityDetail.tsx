import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, EntityDetail as EntityDetailType } from "@/lib/api";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";
import { canOpenSolscanAccount, formatCalendarDate, formatDayLabel, formatPoolLabel, formatRelativeTime, truncateAddress } from "@/lib/utils";

function truncate(addr: string, chars = 8) {
  if (!addr) return "—";
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`;
}
function formatUSD(n: number | null | undefined) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function riskColor(score: number) {
  if (score >= 0.7) return "text-red-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-green-400";
}

const TYPE_COLORS: Record<string, string> = {
  sandwich:    "text-red-400",
  arbitrage:   "text-yellow-400",
  jit:         "text-orange-400",
  liquidation: "text-purple-400",
  backrun:     "text-blue-400",
  liquidity_snipe: "text-pink-400",
  liquidity_drain: "text-cyan-300",
};

export default function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EntityDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.entity(id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center font-mono text-muted-foreground">
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
        Loading entity intelligence...
      </motion.div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center font-mono text-red-400">
      Entity not found or API unreachable.
    </div>
  );

  const { entity, wallets, recent_attacks, targeted_pools, validator_correlation, profit_timeline } = data;
  const maxProfit = Math.max(...profit_timeline.map(d => d.profit), 1);
  const maxTargetedPoolAttacks = Math.max(...targeted_pools.map((pool) => pool.attack_count), 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-6">
          <Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <span>/</span>
          <Link to="/entities" className="hover:text-primary transition-colors">Entities</Link>
          <span>/</span>
          <span className="text-foreground">{entity.label ?? `ENT-${entity.id.slice(0, 8).toUpperCase()}`}</span>
        </div>

        {/* Entity Header */}
        <div className="intel-panel p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-red-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className={`text-xs font-mono font-bold ${riskColor(entity.risk_score)}`}>
                  RISK: {(entity.risk_score * 100).toFixed(0)}/100
                </span>
                {entity.dominant_strategy && (
                  <span className={`text-xs font-mono ${TYPE_COLORS[entity.dominant_strategy] ?? ""}`}>
                    [{entity.dominant_strategy.toUpperCase()}]
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold font-mono text-foreground">
                {entity.label ?? `ENTITY ${entity.id.slice(0, 16).toUpperCase()}`}
              </h1>
              {entity.operator_wallet && (
                <div className="mt-1 text-sm text-muted-foreground">
                  Operator:{" "}
                  <CopyableValue
                    value={entity.operator_wallet}
                    display={`${truncateAddress(entity.operator_wallet, 12, 4)} ↗`}
                    className="inline-block text-yellow-400 font-mono hover:text-yellow-300"
                  />
                </div>
              )}
              <div className="mt-1 text-xs text-muted-foreground font-mono">
                Active: {formatCalendarDate(entity.first_seen)} → {formatCalendarDate(entity.last_seen)}
                {" · "}{entity.wallet_count} wallets
              </div>
            </div>

            {/* Top-level stats */}
            <div className="flex items-center gap-8 text-right">
              <div>
                <div className="text-xs text-muted-foreground">Total Extracted</div>
                <div className="text-2xl font-bold text-primary">{formatUSD(entity.total_profit_usd)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">24h</div>
                <div className="text-lg font-bold text-foreground">{formatUSD(entity.profit_24h_usd)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Attacks</div>
                <div className="text-lg font-bold text-foreground">{entity.attack_count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Victims</div>
                <div className="text-lg text-red-400">{entity.victim_count.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Behavioral fingerprint bars */}
          <div className="mt-6 pt-6 border-t border-border grid grid-cols-5 gap-6">
            {[
              { label: "Fee Aggression",      val: entity.fee_aggression },
              { label: "Position Dominance",  val: entity.position_dominance },
              { label: "Pool Concentration",  val: entity.pool_concentration },
              { label: "Profit Consistency",  val: entity.profit_consistency },
              { label: "Overall Risk",         val: entity.risk_score },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">
                    {label}
                    <InfoHint text={`${label} is a normalized 0-100 behavioral score inferred from this entity’s current attack history and execution profile.`} />
                  </span>
                  <span className={riskColor(val ?? 0)}>{((val ?? 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-border">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(val ?? 0) * 100}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column: 2/3 width */}
          <div className="col-span-2 space-y-6">

            {/* Profit timeline (7 days) */}
            {profit_timeline.length > 0 && (
              <div className="intel-panel p-5">
                <p className="text-xs font-mono text-muted-foreground mb-4">// Profit Timeline (7 days)</p>
                <div className="flex items-end gap-1 h-24">
                  {profit_timeline.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        className="w-full bg-primary/60 hover:bg-primary transition-colors"
                        style={{ height: `${Math.max(4, (d.profit / maxProfit) * 80)}px` }}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(4, (d.profit / maxProfit) * 80)}px` }}
                        transition={{ delay: i * 0.05 }}
                        title={`${formatCalendarDate(d.day)}: ${formatUSD(d.profit)}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatDayLabel(d.day)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent attacks */}
            <div className="intel-panel p-5">
              <p className="text-xs font-mono text-muted-foreground mb-4">// Recent Attacks</p>
              <div className="space-y-2">
                {recent_attacks.length === 0 && (
                  <p className="text-xs text-muted-foreground">No attacks recorded yet.</p>
                )}
                {recent_attacks.slice(0, 15).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono font-bold ${TYPE_COLORS[a.attack_type] ?? ""}`}>
                        {a.attack_type.toUpperCase()}
                      </span>
                      <CopyableValue
                        value={a.pool_address}
                        display={canOpenSolscanAccount(a.pool_address) ? truncate(a.pool_address) : formatPoolLabel(a.pool_address)}
                        className="text-xs text-muted-foreground font-mono"
                        title={formatPoolLabel(a.pool_address)}
                      />
                      {a.victim_wallet && (
                        <span className="text-xs text-red-400/70">
                          → victim:{" "}
                          <CopyableValue
                            value={a.victim_wallet}
                            display={truncate(a.victim_wallet)}
                            className="inline-block text-red-400/70"
                          />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {a.profit_usd != null && (
                        <span className="text-xs font-mono text-primary">{formatUSD(a.profit_usd)}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(a.block_time)}
                      </span>
                      {a.frontrun_tx && (
                        <a
                          href={`https://solscan.io/tx/${a.frontrun_tx}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: 1/3 width */}
          <div className="space-y-6">

            {/* Member wallets */}
            <div className="intel-panel p-5">
              <p className="text-xs font-mono text-muted-foreground mb-4">// Member Wallets ({entity.wallet_count})</p>
              <div className="space-y-2">
                {wallets.slice(0, 10).map(w => (
                  <div key={w.wallet} className="flex items-center justify-between">
                    <div>
                      <CopyableValue
                        value={w.wallet}
                        display={`${truncate(w.wallet)} ↗`}
                        className="text-xs font-mono text-foreground hover:text-primary transition-colors"
                      />
                      {w.operator_label && (
                        <span className="ml-2 text-xs text-yellow-400">[{w.operator_label}]</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{w.role}</span>
                  </div>
                ))}
                {wallets.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">+{wallets.length - 10} more wallets</p>
                )}
              </div>
            </div>

            {/* Cluster evidence */}
            <div className="intel-panel p-5">
              <p className="text-xs font-mono text-muted-foreground mb-4">// Cluster Evidence</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border/70 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Shared Surfaces</div>
                  <div className="mt-2 text-lg text-foreground">{data.cluster_evidence.shared_surface_count}</div>
                </div>
                <div className="border border-border/70 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Shared Validators</div>
                  <div className="mt-2 text-lg text-foreground">{data.cluster_evidence.shared_validator_count}</div>
                </div>
                <div className="border border-border/70 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Shared Strategies</div>
                  <div className="mt-2 text-lg text-foreground">{data.cluster_evidence.shared_strategy_count}</div>
                </div>
                <div className="border border-border/70 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tight Windows</div>
                  <div className="mt-2 text-lg text-foreground">{data.cluster_evidence.coordinated_window_count}</div>
                </div>
              </div>
            </div>

            {data.related_surfaces.length > 0 && (
              <div className="intel-panel p-5">
                <p className="text-xs font-mono text-muted-foreground mb-4">// Shared Surfaces</p>
                <div className="space-y-3">
                  {data.related_surfaces.map((surface) => (
                    <div key={surface.surface} className="border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <CopyableValue
                          value={surface.surface}
                          display={formatPoolLabel(surface.surface)}
                          className="text-xs text-foreground"
                          title={formatPoolLabel(surface.surface)}
                        />
                        <span className="text-xs text-primary">{formatUSD(surface.total_profit)}</span>
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {surface.wallet_count} wallets · {surface.attacks} attacks
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Targeted pools */}
            <div className="intel-panel p-5">
              <p className="text-xs font-mono text-muted-foreground mb-4">// Targeted Pools</p>
              <div className="space-y-3">
                {targeted_pools.slice(0, 8).map((p, i) => (
                  <div key={p.pool_address}>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      {canOpenSolscanAccount(p.pool_address) ? (
                        <CopyableValue
                          value={p.pool_address}
                          display={`${truncate(p.pool_address)} ↗`}
                          className="text-foreground hover:text-primary"
                        />
                      ) : (
                        <CopyableValue
                          value={p.pool_address}
                          display={formatPoolLabel(p.pool_address)}
                          className="text-foreground"
                          title={formatPoolLabel(p.pool_address)}
                        />
                      )}
                      <span className="text-primary">{formatUSD(p.total_profit)}</span>
                    </div>
                    <div className="h-1 bg-border">
                      <motion.div
                        className="h-full bg-primary/50"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (p.attack_count / maxTargetedPoolAttacks) * 100)}%` }}
                        transition={{ delay: i * 0.05 }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{p.attack_count} attacks</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Validator correlation */}
            {validator_correlation.length > 0 && (
              <div className="intel-panel p-5">
                <p className="text-xs font-mono text-muted-foreground mb-4">// Validator Correlation</p>
                <div className="space-y-2">
                  {validator_correlation.map(v => (
                    <div key={v.validator} className="border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3 text-xs font-mono">
                        <CopyableValue
                          value={v.validator}
                          display={truncate(v.validator)}
                          className="text-foreground"
                        />
                        <span className="text-primary">{v.attacks} attacks</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        <div>share {v.exposure_share.toFixed(1)}%</div>
                        <div>risk {(v.validator_risk * 100).toFixed(0)}%</div>
                        <div>sandwich {v.observed_sandwich_rate.toFixed(1)}%</div>
                        <div>centralize {v.stake_centralization_risk.toFixed(0)}</div>
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-primary">
                        action: {v.recommended_action}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
