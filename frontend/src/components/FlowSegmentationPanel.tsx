import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, FlowSegment, SourceAttribution } from "@/lib/api";
import InfoHint from "@/components/InfoHint";

export default function FlowSegmentationPanel() {
  const [segments, setSegments] = useState<FlowSegment[]>([]);
  const [sources, setSources] = useState<SourceAttribution[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await api.flowSegments();
      setSegments(data.segments.slice(0, 4));
      setSources(data.sources.slice(0, 4));
    };

    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="intel-panel p-4 font-mono">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Flow Segmentation
          <InfoHint text="Separate toxic, latency-sensitive, liquidity-opportunistic, and lower-toxicity flow so routing and pool policy can react differently." />
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          source-aware policy
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="grid gap-2 sm:grid-cols-2">
          {segments.map((segment, index) => (
            <motion.div
              key={segment.segment}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="border border-border/60 p-3"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-foreground">
                {segment.segment.replaceAll("-", " ")}
              </div>
              <div className="mt-2 grid gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:grid-cols-2">
                <div>share {segment.flow_share.toFixed(0)}%</div>
                <div>toxicity {segment.toxicity_probability.toFixed(0)}%</div>
                <div>count {segment.attack_count}</div>
                <div>confidence {segment.avg_confidence.toFixed(0)}%</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Dominant Sources
            <InfoHint text="Heuristic source clustering for current flow: aggregator-routed, bundle-lane, searcher, wallet-originated, or liquidation-related flow." />
          </div>
          <div className="mt-3 space-y-2">
            {sources.map((source) => (
              <div key={source.source_key} className="grid grid-cols-[1.2fr,0.6fr,0.6fr,0.8fr] gap-2 border border-border/50 px-3 py-2 text-xs">
                <div className="truncate text-foreground">{source.label}</div>
                <div className="text-muted-foreground">{source.flow_quality_score.toFixed(0)} fq</div>
                <div className="text-muted-foreground">{source.toxicity_probability.toFixed(0)} tox</div>
                <div className="truncate text-muted-foreground">{source.endorser_inference}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
