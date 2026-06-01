import { useCallback, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, API_BASE, Attack, AttackDetail } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";
import { formatPoolLabel, formatRelativeTime, isSyntheticPool, truncateAddress } from "@/lib/utils";

// ============================================================
// LIVE ATTACK FEED
// Polls /api/attacks every 5s, shows new attacks at top
// ============================================================

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sandwich:    { label: "SANDWICH",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
  arbitrage:   { label: "ARB",         color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  jit:         { label: "JIT",         color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  liquidation: { label: "LIQUIDATION", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  backrun:     { label: "BACKRUN",     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
  liquidity_snipe: { label: "LAUNCH SNIPE", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/30" },
  liquidity_drain: { label: "LIQUIDITY DRAIN", color: "text-cyan-300", bg: "bg-cyan-500/10 border-cyan-500/30" },
};

function displayTypeLabel(attack: Attack) {
  return TYPE_CONFIG[attack.attack_type]?.label ?? "MEV";
}

function formatUSD(n: number | null) {
  if (!n) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.95) return "HIGH";
  if (confidence >= 0.85) return "STRONG";
  if (confidence >= 0.75) return "MED";
  return "LOW";
}

const TOKEN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};

function tokenLabel(mint?: string | null) {
  if (!mint) return "UNKNOWN";
  return TOKEN_SYMBOLS[mint] ?? truncateAddress(mint, 6, 4);
}

function profitLabel(attack: Attack) {
  if (attack.attack_type === "liquidation") return "Liquidator Gain";
  if (attack.attack_type === "jit") return "LP Capture";
  if (attack.attack_type === "liquidity_drain") return "Removed Value";
  if (attack.attack_type === "liquidity_snipe") return "First Fill";
  return "Searcher PnL";
}

function harmLabel(attack: Attack) {
  if (attack.attack_type === "liquidation") return "Borrower Loss";
  if (attack.attack_type === "jit") return "User Impact";
  if (attack.attack_type === "liquidity_drain") return "Holder Risk";
  if (attack.attack_type === "liquidity_snipe") return "Launch Risk";
  return "User Harm";
}

function attackSummary(attack: Attack) {
  if (attack.attack_type === "jit") {
    return "Liquidity entered, victim flow landed, liquidity exited.";
  }
  if (attack.attack_type === "liquidation") {
    return "Parsed liquidation-like flow with liquidator-side gain and counterparty loss signals.";
  }
  if (attack.attack_type === "liquidity_snipe") {
    return "Pool initialization was followed immediately by a first-buy capture window.";
  }
  if (attack.attack_type === "liquidity_drain") {
    return "Liquidity was removed aggressively, with dump-style follow-through or drain-like timing.";
  }
  if (attack.attack_type === "sandwich") {
    return "Bracketed victim execution across a hostile route window.";
  }
  if (attack.attack_type === "backrun") {
    return "Post-victim execution harvested downstream repricing.";
  }
  return "Cross-venue stale-quote capture with inventory ending near-flat.";
}

interface Props {
  filterType?: string;
  maxItems?: number;
  compact?: boolean;
}

export default function LiveAttackFeed({ filterType, maxItems = 20, compact = false }: Props) {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>(filterType ?? "");
  const [error, setError] = useState<string | null>(null);
  const [selectedAttackId, setSelectedAttackId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, AttackDetail>>({});
  const lastFetchRef = useRef<string | null>(null);
  const attacksRef = useRef<Attack[]>([]);

  useEffect(() => {
    attacksRef.current = attacks;
  }, [attacks]);

  const addAttack = useCallback((attack: Attack) => {
    if (attack.detector === "suspicious_orderflow_candidate") return;
    if (activeFilter && attack.attack_type !== activeFilter) return;
    setAttacks((prev) => {
      if (prev.some((a) => a.id === attack.id)) return prev;
      setNewIds((ids) => new Set([...ids, attack.id]));
      setTimeout(() => setNewIds((ids) => { const next = new Set(ids); next.delete(attack.id); return next; }), 3000);
      return [attack, ...prev].slice(0, maxItems);
    });
  }, [activeFilter, maxItems]);

  // Initial load via REST
  useEffect(() => {
    api.attacks({ type: activeFilter || undefined, limit: String(maxItems) })
      .then((data) => {
        const filtered = data.filter((a) => a.detector !== "suspicious_orderflow_candidate");
        setAttacks(filtered);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [activeFilter, maxItems]);

  // Real-time updates via SSE
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/attacks/stream`);
    es.onmessage = (e) => {
      try { addAttack(JSON.parse(e.data)); } catch { /* ignore malformed */ }
    };
    es.onerror = () => { /* SSE auto-reconnects */ };
    return () => es.close();
  }, [addAttack]);

  useEffect(() => {
    if (!selectedAttackId || detailById[selectedAttackId]) return;

    api.attackDetail(selectedAttackId)
      .then((detail) => {
        setDetailById((prev) => ({ ...prev, [selectedAttackId]: detail }));
      })
      .catch((err) => {
        console.error("[feed] failed to load attack detail", err);
      });
  }, [selectedAttackId, detailById]);

  const displayedAttacks = attacks.reduce<Attack[]>((acc, attack) => {
    const key = (
      attack.attack_type === "sandwich" || attack.attack_type === "jit"
        ? [
            attack.attack_type,
            attack.attacker_wallet,
            attack.pool_address,
            attack.frontrun_tx ?? "",
            attack.backrun_tx ?? "",
          ]
        : [
            attack.attack_type,
            attack.attacker_wallet,
            attack.pool_address,
            attack.backrun_tx ?? attack.victim_tx ?? `${attack.slot}`,
          ]
    ).join(":");

    const existingIndex = acc.findIndex((item) => {
      const itemKey = (
        item.attack_type === "sandwich" || item.attack_type === "jit"
          ? [
              item.attack_type,
              item.attacker_wallet,
              item.pool_address,
              item.frontrun_tx ?? "",
              item.backrun_tx ?? "",
            ]
          : [
              item.attack_type,
              item.attacker_wallet,
              item.pool_address,
              item.backrun_tx ?? item.victim_tx ?? `${item.slot}`,
            ]
      ).join(":");
      return itemKey === key;
    });

    if (existingIndex === -1) {
      acc.push(attack);
      return acc;
    }

    const existing = acc[existingIndex];
    const existingScore =
      (existing.confidence ?? 0) * 1000 +
      (existing.victim_loss_usd ?? 0) * 2 +
      (existing.profit_usd ?? 0);
    const nextScore =
      (attack.confidence ?? 0) * 1000 +
      (attack.victim_loss_usd ?? 0) * 2 +
      (attack.profit_usd ?? 0);

    if (nextScore > existingScore) {
      acc[existingIndex] = attack;
    }

    return acc;
  }, []);

  return (
    <div className="font-mono">
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Type filter tabs */}
            {["", "sandwich", "arbitrage", "backrun", "jit", "liquidation", "liquidity_snipe", "liquidity_drain"].map(type => (
              <button
                key={type || "all"}
                onClick={() => { setActiveFilter(type); setAttacks([]); lastFetchRef.current = null; }}
                className={`text-xs px-3 py-1 border transition-colors ${
                  activeFilter === type
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {type ? type.toUpperCase() : "ALL"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-2">
        {error && (
          <div className="border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            Live feed request failed: {error}
          </div>
        )}
        <AnimatePresence initial={false}>
          {displayedAttacks.map((attack) => {
            const cfg = TYPE_CONFIG[attack.attack_type] ?? TYPE_CONFIG.backrun;
            const isNew = newIds.has(attack.id);
            const isSelected = selectedAttackId === attack.id;
            const detail = detailById[attack.id] ?? attack;
            return (
              <motion.div
                key={attack.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`border p-3 transition-all cursor-pointer ${cfg.bg} ${
                  isNew ? "ring-1 ring-primary/50" : ""
                }`}
                onClick={() => setSelectedAttackId((prev) => (prev === attack.id ? null : attack.id))}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Attack type badge */}
                    <span className={`text-xs font-bold px-2 py-0.5 border ${cfg.bg} ${cfg.color}`}>
                      {displayTypeLabel(attack)}
                    </span>

                    {/* Attacker */}
                    <div>
                      <span className="text-xs text-muted-foreground">ATTACKER </span>
                      <CopyableValue
                        value={attack.attacker_wallet}
                        display={truncateAddress(attack.attacker_wallet, 6, 4)}
                        className="inline-block max-w-[140px] align-middle text-xs"
                      />
                    {attack.entity_label && (
                      <span className="ml-2 text-xs text-primary">[{attack.entity_label}]</span>
                    )}
                  </div>

                    {/* Victim */}
                    {attack.victim_wallet && (
                      <div>
                        <span className="text-xs text-muted-foreground">VICTIM </span>
                        <CopyableValue
                          value={attack.victim_wallet}
                          display={attack.victim_wallet ? truncateAddress(attack.victim_wallet, 6, 4) : undefined}
                          className="inline-block max-w-[140px] align-middle text-xs text-red-400/80 hover:text-red-300"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Model <InfoHint text="The detection family that surfaced this event, such as parsed swap sandwich, backrun, or liquidity-JIT inference." />
                      </div>
                      <div className="text-xs text-foreground">{attack.detector ?? "unknown"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Confidence <InfoHint text="Heuristic confidence for this classification based on the evidence currently available. Higher means stronger corroboration, not mathematical certainty." />
                      </div>
                      <div className={`text-xs font-bold ${cfg.color}`}>
                        {confidenceLabel(attack.confidence)} · {(attack.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {attack.profit_usd != null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <div className="text-xs text-muted-foreground">{profitLabel(attack)}</div>
                            <div className={`text-sm font-bold ${cfg.color}`}>{formatUSD(attack.profit_usd)}</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Estimated value captured by the attacking/searcher side after the bracket completed.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {attack.victim_loss_usd != null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <div className="text-xs text-muted-foreground">{harmLabel(attack)}</div>
                            <div className="text-sm text-red-400">{formatUSD(attack.victim_loss_usd)}</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Estimated execution harm to the victim. This can differ from searcher PnL because some value leaks to fees, tips, or venue mechanics.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Surface <InfoHint text="The observed execution surface. When exact pool certainty is weak, Intelleum falls back to a route, venue, or token-pair level label instead of overstating precision." />
                      </div>
                      <CopyableValue
                        value={attack.pool_address}
                        display={formatPoolLabel(attack.pool_address)}
                        className="max-w-[150px] truncate text-xs text-foreground"
                        title={formatPoolLabel(attack.pool_address)}
                      />
                      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {attack.surface_precision ?? "inferred"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Time</div>
                      <div className="text-xs text-foreground">{formatRelativeTime(attack.block_time)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em]">
                  <span className="border border-border/60 bg-background/35 px-2 py-1 text-muted-foreground">
                    lane · <span className="text-foreground">{attack.execution_lane ?? "standard"}</span>
                  </span>
                  <span className="border border-border/60 bg-background/35 px-2 py-1 text-muted-foreground">
                    basis · <span className="text-foreground">{attack.detection_basis ?? "heuristic"}</span>
                  </span>
                  {attack.bundle_likelihood != null && (
                    <span className="border border-border/60 bg-background/35 px-2 py-1 text-muted-foreground">
                      bundle · <span className="text-foreground">{(attack.bundle_likelihood * 100).toFixed(0)}%</span>
                    </span>
                  )}
                  {attack.surface_precision && (
                    <span className="border border-border/60 bg-background/35 px-2 py-1 text-muted-foreground">
                      precision · <span className="text-foreground">{attack.surface_precision}</span>
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {attackSummary(attack)}
                </div>

                {!!attack.evidence?.length && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    {attack.evidence.slice(0, 3).map((item) => (
                      <span key={item} className="border border-border/80 px-2 py-1">
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {isSelected && (
                  <div className="mt-3 grid gap-3 border-t border-border/80 pt-3 md:grid-cols-2">
                    <div className="space-y-2 text-xs">
                      <div className="text-muted-foreground">Evidence Trail</div>
                      {(detail.evidence ?? []).length > 0 ? (
                        <div className="space-y-1">
                          {(detail.evidence ?? []).map((item) => (
                            <div key={item} className="border border-border/70 px-2 py-1 text-foreground">
                              {item}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">No evidence details available.</div>
                      )}
                    </div>

                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div className="min-w-0 border border-border/70 p-2">
                        <div className="text-muted-foreground">Validator</div>
                        <CopyableValue value={detail.validator} display={truncateAddress(detail.validator, 8, 4)} className="mt-1 block text-foreground" />
                      </div>
                      <div className="min-w-0 border border-border/70 p-2">
                        <div className="text-muted-foreground">Pool / Route</div>
                        <CopyableValue
                          value={detail.pool_address}
                          display={isSyntheticPool(detail.pool_address) ? formatPoolLabel(detail.pool_address) : truncateAddress(detail.pool_address, 8, 4)}
                          className="mt-1 block text-foreground"
                        />
                      </div>
                      <div className="min-w-0 border border-border/70 p-2">
                        <div className="text-muted-foreground">Token Mint</div>
                        <CopyableValue
                          value={detail.token_mint}
                          display={detail.token_mint ? tokenLabel(detail.token_mint) : undefined}
                          className="mt-1 block text-foreground"
                        />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="border border-border/70 p-2">
                            <div className="text-muted-foreground">Observed Priority Fee</div>
                            <div className="mt-1 text-foreground">
                              {detail.tip_lamports && detail.tip_lamports > 0 ? detail.tip_lamports.toLocaleString() : "—"}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Extracted from compute-budget instructions when present. This is not a full validator-side or Jito tip attribution metric.
                        </TooltipContent>
                      </Tooltip>
                      <div className="border border-border/70 p-2">
                        <div className="text-muted-foreground">
                          Execution Lane <InfoHint text="A lightweight classification of where this attack likely executed: Jito-aligned, priority-fee heavy, or standard lane." />
                        </div>
                        <div className="mt-1 text-foreground">{detail.execution_lane ?? "standard"}</div>
                      </div>
                      <div className="border border-border/70 p-2">
                        <div className="text-muted-foreground">
                          Surface Precision <InfoHint text="Exact pool means we are showing a concrete account-level surface. Venue / route / pair values mean the execution surface is inferred and intentionally labeled more conservatively." />
                        </div>
                        <div className="mt-1 text-foreground">{detail.surface_precision ?? "inferred"}</div>
                      </div>
                      <div className="border border-border/70 p-2">
                        <div className="text-muted-foreground">
                          Bundle Likelihood <InfoHint text="Heuristic estimate that this event was part of a bundle-like or Jito-aligned execution path." />
                        </div>
                        <div className="mt-1 text-foreground">
                          {detail.bundle_likelihood != null ? `${(detail.bundle_likelihood * 100).toFixed(0)}%` : "—"}
                        </div>
                      </div>
                      <div className="border border-border/70 p-2">
                        <div className="text-muted-foreground">
                          Detection Basis <InfoHint text="Parsed means directly supported by parsed transaction semantics, flow means inferred from token/account movement, and heuristic means a weaker pattern-based signal." />
                        </div>
                        <div className="mt-1 text-foreground">{detail.detection_basis ?? "heuristic"}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction hashes */}
                {!compact && attack.frontrun_tx && (
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground/60">
                    {attack.frontrun_tx && (
                        <a href={`https://solscan.io/tx/${attack.frontrun_tx}`} target="_blank" rel="noopener noreferrer"
                         className="hover:text-primary transition-colors">
                        FRONTRUN: {truncateAddress(attack.frontrun_tx, 6, 4)} ↗
                      </a>
                    )}
                    {attack.victim_tx && (
                      <a href={`https://solscan.io/tx/${attack.victim_tx}`} target="_blank" rel="noopener noreferrer"
                         className="hover:text-red-400 transition-colors">
                        VICTIM: {truncateAddress(attack.victim_tx, 6, 4)} ↗
                      </a>
                    )}
                    {attack.backrun_tx && (
                      <a href={`https://solscan.io/tx/${attack.backrun_tx}`} target="_blank" rel="noopener noreferrer"
                         className="hover:text-primary transition-colors">
                        BACKRUN: {truncateAddress(attack.backrun_tx, 6, 4)} ↗
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {displayedAttacks.length === 0 && !error && (
          <div className="text-center text-muted-foreground text-xs py-8">
            <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
              Watching Solana for toxic flow...
            </motion.span>
          </div>
        )}
      </div>
    </div>
  );
}
