import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, Attack, EngineSnapshot } from "@/lib/api";
import StatsBar from "@/components/StatsBar";
import CopyableValue from "@/components/CopyableValue";
import InfoHint from "@/components/InfoHint";
import { formatPoolLabel, formatRelativeTime, truncateAddress } from "@/lib/utils";

function formatUSD(n: number | null | undefined) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function History() {
  const [history, setHistory] = useState<Attack[]>([]);
  const [snapshots, setSnapshots] = useState<EngineSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [attackHistory, engineHistory] = await Promise.all([
          api.attackHistory(200),
          api.systemHistory(),
        ]);
        setHistory(attackHistory);
        setSnapshots(engineHistory);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown history error";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
    const extracted = history.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0);
    const uniqueAttackers = new Set(history.map((attack) => attack.attacker_wallet)).size;
    const uniquePools = new Set(history.map((attack) => attack.pool_address)).size;
    return { extracted, uniqueAttackers, uniquePools };
  }, [history]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StatsBar />

      <div className="mx-auto max-w-7xl px-6 py-8 font-mono">
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground">Historical Intelligence</span>
        </div>

        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.25em] text-primary">Historical Intelligence</p>
            <h1 className="text-3xl font-semibold text-foreground">Replay Detection Over Time</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Persisted MEV detections, engine telemetry, and replayable evidence snapshots from the live Solana intelligence pipeline.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="border border-primary/30 px-4 py-2 text-xs tracking-[0.2em] text-primary hover:bg-primary/10"
          >
            RETURN TO LIVE
          </Link>
        </div>

        {error && (
          <div className="mb-6 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Failed to load historical intelligence: {error}
          </div>
        )}

        <div className="mb-8 grid gap-3 md:grid-cols-4">
          {[
            { label: "Stored Attacks", value: history.length.toLocaleString() },
            { label: "Extracted Value", value: formatUSD(summary.extracted) },
            { label: "Unique Attackers", value: summary.uniqueAttackers.toLocaleString() },
            { label: "Tracked Pools", value: summary.uniquePools.toLocaleString() },
          ].map((item) => (
            <div key={item.label} className="intel-panel p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="intel-panel p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Engine Replay
            </div>
            {loading && snapshots.length === 0 ? (
              <div className="text-sm text-muted-foreground">Loading engine snapshots...</div>
            ) : (
              <div className="space-y-3">
                {snapshots.slice(0, 20).map((snapshot) => (
                  <motion.div
                    key={snapshot.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid gap-3 border border-border/70 p-3 md:grid-cols-[0.9fr_2fr]"
                  >
                    <div>
                      <div className="text-xs text-primary">{snapshot.mode.toUpperCase()}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(snapshot.created_at)}</div>
                      <div className="mt-2 text-xs text-foreground">
                        Slots: {snapshot.last_processed_slot ?? "—"} / {snapshot.latest_chain_slot ?? "—"}
                      </div>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-3">
                      <div>
                        <div className="text-muted-foreground">Blocks</div>
                        <div className="mt-1 text-foreground">{snapshot.blocks_processed}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Attacks</div>
                        <div className="mt-1 text-foreground">{snapshot.attacks_detected}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Parsed Swaps</div>
                        <div className="mt-1 text-foreground">{snapshot.parsed_swaps}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sandwich Cand.</div>
                        <div className="mt-1 text-foreground">{snapshot.sandwich_candidates}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Arb Cand.</div>
                        <div className="mt-1 text-foreground">{snapshot.arbitrage_candidates}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">JIT Cand.</div>
                        <div className="mt-1 text-foreground">{snapshot.jit_candidates}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="intel-panel p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Detection Leaderboard
            </div>
            <div className="space-y-3">
              {Object.entries(
                history.reduce<Record<string, { count: number; extracted: number }>>((acc, attack) => {
                  const key = attack.detector ?? "unknown";
                  if (!acc[key]) acc[key] = { count: 0, extracted: 0 };
                  acc[key].count += 1;
                  acc[key].extracted += attack.profit_usd ?? 0;
                  return acc;
                }, {}),
              )
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 8)
                .map(([detector, value]) => (
                  <div key={detector} className="flex items-center justify-between border border-border/70 px-3 py-2 text-xs">
                    <div className="text-foreground">{detector}</div>
                    <div className="text-right">
                      <div className="text-primary">{value.count} hits</div>
                      <div className="text-muted-foreground">{formatUSD(value.extracted)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="intel-panel p-5">
          <div className="mb-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Persisted Attack History
          </div>
          <div className="space-y-3">
            {loading && history.length === 0 && (
              <div className="text-sm text-muted-foreground">Loading persisted detections...</div>
            )}
            {history.map((attack) => (
              <div key={attack.id} className="border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-primary/30 px-2 py-1 text-xs text-primary">
                        {attack.attack_type.toUpperCase()}
                      </span>
                      <span className="text-xs text-foreground">
                        {attack.detector ?? "unknown"}
                        <InfoHint text="The detector family that surfaced this event in replay." />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(attack.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      Attacker{" "}
                      <CopyableValue
                        value={attack.attacker_wallet}
                        display={truncateAddress(attack.attacker_wallet, 8, 4)}
                        className="inline-block text-foreground"
                      />{" "}
                      on{" "}
                      <CopyableValue
                        value={attack.pool_address}
                        display={formatPoolLabel(attack.pool_address)}
                        className="inline-block text-foreground"
                      />
                    </div>
                    {attack.victim_wallet && (
                      <div className="mt-1 text-xs text-red-300">
                        Victim:{" "}
                        <CopyableValue
                          value={attack.victim_wallet}
                          display={truncateAddress(attack.victim_wallet, 8, 4)}
                          className="inline-block text-red-300"
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-primary">{formatUSD(attack.profit_usd)}</div>
                    <div className="text-muted-foreground">{formatRelativeTime(attack.block_time)}</div>
                    <div className="text-muted-foreground">slot {attack.slot.toLocaleString()}</div>
                  </div>
                </div>

                {!!attack.evidence?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attack.evidence.map((item) => (
                      <span key={item} className="border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
