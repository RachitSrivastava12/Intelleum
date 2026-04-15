import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api, GlobalStats } from "@/lib/api";
import InfoHint from "@/components/InfoHint";

// ============================================================
// GLOBAL STATS BAR — real data from /api/stats
// ============================================================

function formatUSD(n: number | null) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function StatsBar() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.stats();
        setStats(data);
        setError(null);
        console.info("[stats] loaded", data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown API error";
        console.error("[stats] failed to load", err);
        if (!stats) {
          setError(message);
        }
      }
    };
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, []);

  const items = stats ? [
    { label: "ATTACKS / 1H",  value: stats.attacks_1h?.toLocaleString() ?? "—",   accent: false, help: "Detected MEV events observed in the last hour." },
    { label: "ATTACKS / 24H", value: stats.attacks_24h?.toLocaleString() ?? "—",  accent: false, help: "Detected MEV events observed in the last 24 hours." },
    { label: "EXTRACTED 24H", value: formatUSD(stats.extracted_24h),               accent: true, help: "Estimated searcher-side extracted value observed over the last 24 hours."  },
    { label: "TOTAL EXTRACTED", value: formatUSD(stats.total_extracted_usd),       accent: true, help: "Estimated cumulative extracted value in the current dataset."  },
    { label: "ENTITIES",      value: stats.total_entities?.toLocaleString() ?? "—", accent: false, help: "Operator or wallet clusters currently surfaced by the system." },
    { label: "VICTIMS",       value: stats.total_victims?.toLocaleString() ?? "—", accent: false, help: "Unique victim wallets seen in attacks with attributable user harm." },
    { label: "SANDWICHES",    value: stats.sandwich_count?.toLocaleString() ?? "—", accent: false, help: "Sandwich detections in the current dataset." },
    { label: "ARB",           value: stats.arb_count?.toLocaleString() ?? "—",     accent: false, help: "Arbitrage detections in the current dataset." },
    { label: "JIT",           value: stats.jit_count?.toLocaleString() ?? "—",     accent: false, help: "JIT liquidity detections in the current dataset." },
  ] : [];

  return (
    <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center overflow-x-auto scrollbar-none">
        {/* Live indicator */}
        <div className="flex items-center gap-2 px-4 py-2 border-r border-border shrink-0">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-xs text-primary font-mono font-bold tracking-widest">LIVE</span>
        </div>

        {items.map((item, i) => (
          <div key={i} className="flex items-center border-r border-border shrink-0">
            <div className="px-4 py-2">
              <div className="text-xs text-muted-foreground tracking-wider">
                {item.label}
                <InfoHint text={item.help} />
              </div>
              <motion.div
                key={item.value}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm font-bold font-mono ${item.accent ? "text-primary" : "text-foreground"}`}
              >
                {item.value}
              </motion.div>
            </div>
          </div>
        ))}

        {!stats && !error && (
          <div className="px-6 py-2 text-xs text-muted-foreground">
            <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
              Loading stats...
            </motion.span>
          </div>
        )}

        {error && (
          <div className="px-6 py-2 text-xs text-red-300">
            Stats unavailable: {error}
          </div>
        )}
      </div>
    </div>
  );
}
