import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, Entity } from "@/lib/api";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";
import { truncateAddress } from "@/lib/utils";

// ============================================================
// ENTITY EXPLORER PAGE
// Real data from /api/entities
// ============================================================

const RISK_COLORS: Record<string, string> = {
  high:   "text-red-400 border-red-500/40 bg-red-500/10",
  medium: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  low:    "text-green-400 border-green-500/40 bg-green-500/10",
};

function riskLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function formatUSD(n: number | null) {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const STRATEGY_COLORS: Record<string, string> = {
  sandwich:    "text-red-400",
  arbitrage:   "text-yellow-400",
  jit:         "text-orange-400",
  liquidation: "text-purple-400",
  backrun:     "text-blue-400",
};

function EntityCard({ entity, selected, onSelect }: {
  entity: Entity;
  selected: boolean;
  onSelect: () => void;
}) {
  const risk = riskLevel(entity.risk_score);
  const isCluster = entity.wallet_count > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`intel-panel p-4 cursor-pointer transition-all ${
        selected ? "border-primary/60" : "hover:border-primary/30"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        {/* Left: Identity */}
        <div className="flex items-center gap-3">
          <div className={`px-2 py-0.5 border text-xs font-bold ${RISK_COLORS[risk]}`}>
            {risk.toUpperCase()}
          </div>
          {isCluster && (
            <div className="px-2 py-0.5 border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 text-xs font-bold">
              CLUSTER
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-foreground">
              {entity.label ?? `ENT-${entity.id.slice(0, 8).toUpperCase()}`}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {entity.wallet_count} wallet{entity.wallet_count !== 1 ? "s" : ""} •{" "}
              {entity.sample_wallets?.[0] ? (
                <CopyableValue
                  value={entity.sample_wallets[0]}
                  display={truncateAddress(entity.sample_wallets[0], 6, 4)}
                  className="inline-block max-w-[120px] align-middle"
                />
              ) : "—"}
            </div>
          </div>
        </div>

        {/* Middle: Strategy badges */}
        <div className="hidden md:flex items-center gap-2">
          {(entity.strategies_used ?? []).slice(0, 3).map(s => (
            <span key={s} className={`text-xs ${STRATEGY_COLORS[s] ?? "text-foreground"}`}>
              [{s.toUpperCase()}]
            </span>
          ))}
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-8 text-right">
          <div>
            <div className="text-xs text-muted-foreground">Total Profit</div>
            <div className="text-sm font-bold text-primary">{formatUSD(entity.total_profit_usd)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">24h</div>
            <div className="text-sm text-foreground">{formatUSD(entity.profit_24h_usd)}</div>
          </div>
          {entity.mev_market_share_pct !== undefined && entity.mev_market_share_pct > 0 && (
            <div>
              <div className="text-xs text-muted-foreground">
                MEV Share <InfoHint text="This entity's share of total extracted value across all tracked operators. Higher = more dominant player in the MEV supply chain." />
              </div>
              <div className="text-sm font-bold text-cyan-400">{entity.mev_market_share_pct.toFixed(1)}%</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Attacks</div>
            <div className="text-sm text-foreground">{entity.attack_count.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Risk <InfoHint text="Composite entity risk derived from observed strategy mix, wallet clustering, fee aggression, pool concentration, and extracted value patterns." />
            </div>
            <div className="text-sm font-bold">{(entity.risk_score * 100).toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Expanded: behavioral fingerprint */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Fee Aggression", val: entity.fee_aggression },
                { label: "Position Dominance", val: entity.position_dominance },
                { label: "Pool Concentration", val: entity.pool_concentration },
                { label: "Profit Consistency", val: entity.profit_consistency },
                { label: "Risk Score", val: entity.risk_score },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="text-xs text-muted-foreground mb-1">
                    {label}
                    <InfoHint text={`${label} is a normalized 0-100 behavior score inferred from the entity's observed activity in the current dataset.`} />
                  </div>
                  <div className="w-full h-1.5 bg-border">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${(val ?? 0) * 100}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                  <div className="text-xs text-primary mt-1">{((val ?? 0) * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
            {entity.operator_wallet && (
              <div className="mt-3 text-xs">
                <span className="text-muted-foreground">
                  Primary operator wallet
                  <InfoHint text="The attacker signer that authorized the observed MEV transactions. This is wallet-level attribution, not a real-world identity label." />
                  {": "}
                </span>
                <CopyableValue
                  value={entity.operator_wallet}
                  display={truncateAddress(entity.operator_wallet, 8, 4)}
                  className="inline-block text-yellow-400 font-mono"
                />
              </div>
            )}
            <div className="mt-3 flex gap-3">
              <a
                href={`/entities/${entity.id}`}
                className="text-xs text-primary border border-primary/40 px-3 py-1 hover:bg-primary/10 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                Full Profile →
              </a>
              {entity.sample_wallets?.[0] && (
                <a
                  href={`https://solscan.io/account/${entity.sample_wallets[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground border border-border px-3 py-1 hover:bg-border/30 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  View on Solscan ↗
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function EntityExplorer() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState("profit");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.entities({
        sort,
        strategy: filterStrategy || undefined,
        limit: "100",
      });
      setEntities(data);
      setError(null);
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sort, filterStrategy]);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const clusters = entities.filter(e => e.wallet_count > 1);
  const solos = entities.filter(e => e.wallet_count === 1);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs text-primary tracking-widest uppercase mb-1">// Entity Intelligence</p>
            <h1 className="text-2xl font-bold text-foreground">MEV Entity Explorer</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Signer-based attribution: each attacker signer is treated as its own entity until funding,
              sweep, or profit-sink evidence proves wallets belong together.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="bg-background border border-border text-foreground text-xs px-3 py-2 font-mono"
            >
              <option value="profit">Sort: Profit</option>
              <option value="attacks">Sort: Attacks</option>
              <option value="risk">Sort: Risk</option>
            </select>
            <select
              value={filterStrategy}
              onChange={e => setFilterStrategy(e.target.value)}
              className="bg-background border border-border text-foreground text-xs px-3 py-2 font-mono"
            >
              <option value="">All Strategies</option>
              <option value="sandwich">Sandwich</option>
              <option value="arbitrage">Arbitrage</option>
              <option value="jit">JIT Liquidity</option>
              <option value="liquidation">Liquidation</option>
              <option value="liquidity_snipe">Launch Snipe</option>
              <option value="liquidity_drain">Liquidity Drain</option>
            </select>
            <motion.div
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </div>

        {loading && entities.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-20">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
              Scanning entity clusters...
            </motion.div>
          </div>
        )}

        {error && (
          <div className="intel-panel p-4 border-red-500/40 text-red-400 text-sm mb-4">
            ⚠ API connection failed: {error}
          </div>
        )}

        {/* Clustered entities */}
        {clusters.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">
                Clustered Operators
              </span>
              <div className="flex-1 h-px bg-cyan-500/20" />
              <span className="text-[10px] font-mono text-muted-foreground">{clusters.length}</span>
            </div>
            <div className="grid gap-3">
              {clusters.map(entity => (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  selected={selectedId === entity.id}
                  onSelect={() => setSelectedId(selectedId === entity.id ? null : entity.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Solo operators */}
        {solos.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                Solo Operators
              </span>
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[10px] font-mono text-muted-foreground">{solos.length}</span>
            </div>
            <div className="grid gap-3">
              {solos.map(entity => (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  selected={selectedId === entity.id}
                  onSelect={() => setSelectedId(selectedId === entity.id ? null : entity.id)}
                />
              ))}
            </div>
          </div>
        )}

        {entities.length === 0 && !loading && !error && (
          <div className="text-center text-muted-foreground text-sm py-20">
            No entities found. Worker may still be indexing.
          </div>
        )}
      </div>
    </div>
  );
}
