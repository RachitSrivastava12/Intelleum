import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, SystemStatus } from "@/lib/api";
import InfoHint from "@/components/InfoHint";
import { formatRelativeTime } from "@/lib/utils";

function statusTone(mode: SystemStatus["mode"]) {
  return mode === "chain"
    ? "text-green-400 border-green-500/30 bg-green-500/10"
    : "text-yellow-300 border-yellow-500/30 bg-yellow-500/10";
}

function percentage(value: number, base: number) {
  if (!base || base <= 0) return 0;
  return Math.max(0, Math.min(100, (value / base) * 100));
}

export default function EngineStatusPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.systemStatus();
        setStatus(data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown status error";
        setError(message);
      }
    };

    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!status && error) {
    return (
      <div className="intel-panel mb-6 border-red-500/30 p-4 text-xs text-red-300">
        Engine status unavailable: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="intel-panel mb-6 p-4 text-xs text-muted-foreground">
        <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
          Loading engine telemetry...
        </motion.span>
      </div>
    );
  }

  const slotLag =
    status.latestChainSlot && status.lastProcessedSlot
      ? status.latestChainSlot - status.lastProcessedSlot
      : null;
  const metrics = {
    candidateRows: status.recentMetrics?.candidateRows ?? 0,
    parsedTransactions: status.recentMetrics?.parsedTransactions ?? 0,
    parsedSwaps: status.recentMetrics?.parsedSwaps ?? 0,
    rawSlotTxs: status.recentMetrics?.rawSlotTxs ?? 0,
    detectedAttacks: status.recentMetrics?.detectedAttacks ?? 0,
    sandwichCandidates: status.recentMetrics?.sandwichCandidates ?? 0,
    arbitrageCandidates: status.recentMetrics?.arbitrageCandidates ?? 0,
    jitCandidates: status.recentMetrics?.jitCandidates ?? 0,
    liquidationCandidates: status.recentMetrics?.liquidationCandidates ?? 0,
    liquiditySnipeCandidates: status.recentMetrics?.liquiditySnipeCandidates ?? 0,
    liquidityDrainCandidates: status.recentMetrics?.liquidityDrainCandidates ?? 0,
    suspiciousCandidates: status.recentMetrics?.suspiciousCandidates ?? 0,
    backrunCandidates: status.recentMetrics?.backrunCandidates ?? 0,
  };
  const recentAttackPreview = status.recentAttackPreview ?? [];
  const quicknode = status.quicknode;
  const quicknodeActive = (quicknode?.payloadCount ?? 0) > 0;
  const validatorPreview = status.recentValidatorPreview ?? [];
  const funnel = [
    {
      label: "Blocks",
      value: status.blocksProcessed,
      bar: 100,
      help: "Total blocks processed by the live engine since startup.",
    },
    {
      label: "Successful TX",
      value: metrics.rawSlotTxs,
      bar: percentage(metrics.rawSlotTxs, Math.max(metrics.rawSlotTxs, metrics.candidateRows, metrics.parsedTransactions, metrics.parsedSwaps, metrics.detectedAttacks, 1)),
      help: "Successful transactions seen in the latest slot window before deeper filtering.",
    },
    {
      label: "Candidates",
      value: metrics.candidateRows,
      bar: percentage(metrics.candidateRows, Math.max(metrics.rawSlotTxs, 1)),
      help: "Transactions selected for deeper inspection based on DEX, lending, or swap-like signals.",
    },
    {
      label: "Parsed Swaps",
      value: metrics.parsedSwaps,
      bar: percentage(metrics.parsedSwaps, Math.max(metrics.candidateRows, 1)),
      help: "Swap-like events successfully reconstructed from candidate transactions.",
    },
    {
      label: "Detections",
      value: metrics.detectedAttacks,
      bar: percentage(metrics.detectedAttacks, Math.max(metrics.parsedSwaps, 1)),
      help: "Confirmed detections that survived filtering in the latest processed slot window.",
    },
  ];

  return (
    <div className="intel-panel mb-6 p-5 font-mono">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className={`border px-3 py-1 text-xs font-bold tracking-wider ${statusTone(status.mode)}`}>
          {status.mode === "chain" ? "CHAIN LIVE" : "FALLBACK MODE"}
        </div>
        {quicknode && (
          <div className={`border px-3 py-1 text-xs tracking-wider ${
            quicknodeActive
              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
              : "border-border/60 bg-background/30 text-muted-foreground"
          }`}>
            {quicknodeActive ? "QUICKNODE STREAM LIVE" : "QUICKNODE CONNECTED"}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Last sync: <span className="text-foreground">{formatRelativeTime(status.lastSyncAt)}</span>
        </div>
        {slotLag != null && (
          <div className="text-xs text-muted-foreground">
            Slot lag: <span className="text-foreground">{slotLag}</span>
          </div>
        )}
        {status.avgBlockProcessingMs != null && (
          <div className="flex items-center gap-1.5 border border-cyan-500/30 bg-cyan-500/8 px-2 py-1 text-xs text-cyan-400 font-mono">
            ⚡ <span className="font-bold">{status.avgBlockProcessingMs}ms</span>
            <span className="text-cyan-500/70">avg block</span>
          </div>
        )}
        {status.lastError && (
          <div className="text-xs text-yellow-300">
            {status.lastError}
          </div>
        )}
      </div>

      <div className="mb-4 border border-border/70 bg-background/30 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Processing Funnel
            <InfoHint text="Why blocks processed can be much higher than attacks detected: only a subset of successful transactions become swap candidates, only some candidates parse cleanly into swaps, and only a smaller subset satisfy the detector rules." />
          </div>
          <div className="text-[11px] text-muted-foreground">
            Latest slot pipeline
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          {funnel.map((step, index) => (
            <div key={step.label} className="border border-border/60 bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {step.label}
                  <InfoHint text={step.help} />
                </div>
                <div className="text-xs text-foreground">{step.value.toLocaleString()}</div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border/50">
                <div
                  className={`h-full rounded-full transition-all ${
                    index === funnel.length - 1 ? "bg-cyan-400" : "bg-primary/80"
                  }`}
                  style={{ width: `${Math.max(step.bar, step.value > 0 ? 8 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Blocks Processed", value: status.blocksProcessed.toLocaleString(), help: "Cumulative blocks processed by the live engine since startup." },
            { label: "Total Attacks", value: status.attacksDetected.toLocaleString(), help: "Cumulative detections inserted into the live attack surface since startup." },
            { label: "Latest Slot Detections", value: metrics.detectedAttacks.toLocaleString(), help: "Detections that survived filtering in the most recently processed slot window." },
            { label: "Latest Slot Parsed TX", value: metrics.parsedTransactions.toLocaleString(), help: "Transactions that were successfully enriched and parsed in the latest processing window." },
            { label: "Latest Slot Parsed Swaps", value: metrics.parsedSwaps.toLocaleString(), help: "Parsed swap-like events reconstructed from the latest processing window." },
            { label: "Latest Slot Candidates", value: metrics.candidateRows.toLocaleString(), help: "Transactions selected for deeper inspection based on DEX, lending, or swap-like signals." },
            { label: "Latest Slot Successful TX", value: metrics.rawSlotTxs.toLocaleString(), help: "Successful transactions observed in the latest processed slot before deeper filtering." },
            { label: "JIT Candidates", value: metrics.jitCandidates.toLocaleString(), help: "JIT-style liquidity bracket candidates seen in the latest processing window before final deduping." },
            { label: "Liquidation Candidates", value: metrics.liquidationCandidates.toLocaleString(), help: "Parsed liquidation-like candidates seen in the latest processing window before final filtering." },
            { label: "Launch Snipe Candidates", value: metrics.liquiditySnipeCandidates.toLocaleString(), help: "Pool-launch creation plus first-buy patterns seen in the latest processing window before final filtering." },
            { label: "Liquidity Drain Candidates", value: metrics.liquidityDrainCandidates.toLocaleString(), help: "Large liquidity-removal patterns seen in the latest processing window before final filtering." },
            ...(quicknode
              ? [
                  { label: "QuickNode Payloads", value: quicknode.payloadCount.toLocaleString(), help: "QuickNode stream payloads received by the webhook service." },
                  { label: "QuickNode Requests", value: quicknode.requestsReceived.toLocaleString(), help: "Webhook requests received from QuickNode, including heartbeat traffic." },
                ]
              : []),
          ].map((item) => (
          <div key={item.label} className="border border-border/70 bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {item.label}
              <InfoHint text={item.help} />
            </div>
            <div className="mt-2 text-lg font-bold text-foreground">{item.value}</div>
          </div>
        ))}
      </div>

      {recentAttackPreview.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Recent Detector Hits
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {recentAttackPreview.map((attack, index) => (
              <div key={`${attack.slot}-${index}`} className="border border-border/70 px-3 py-2 text-xs">
                <span className="text-primary">{attack.attack_type.toUpperCase()}</span>
                <span className="mx-2 text-muted-foreground">/</span>
                <span className="text-foreground">{attack.detector}</span>
                <span className="mx-2 text-muted-foreground">/</span>
                <span className="text-muted-foreground">
                  {(attack.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {validatorPreview.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Validator Risk Radar
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {validatorPreview.map((validator) => (
              <div key={validator.validator} className="border border-border/70 px-3 py-2 text-xs">
                <div className="truncate text-foreground" title={validator.validator}>
                  {validator.validator}
                </div>
                <div className="mt-2 flex items-center justify-between text-muted-foreground">
                  <span>Risk <InfoHint text="Composite validator-side risk based on sandwich share, confirmed share, wide-bracket behavior, entity concentration, extracted value, and observed priority-fee pressure." /></span>
                  <span className="text-foreground">{(validator.risk_score * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-muted-foreground">
                  <span>Sandwich share <InfoHint text="Percent of observed attacks landing with this validator that were classified as sandwiches." /></span>
                  <span className="text-foreground">{validator.sandwich_share.toFixed(1)}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-muted-foreground">
                  <span>Wide</span>
                  <span className="text-foreground">{validator.wide_sandwich_count}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-muted-foreground">
                  <span>Entities</span>
                  <span className="text-foreground">{validator.unique_entities}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
