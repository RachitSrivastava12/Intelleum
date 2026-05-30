import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import LiveAttackFeed from "@/components/LiveAttackFeed";
import { api, SavingsSummary } from "@/lib/api";
import EngineStatusPanel from "@/components/EngineStatusPanel";
import LiveValidatorBoard from "@/components/LiveValidatorBoard";
import EntityExplorer from "./EntityExplorer";
import PoolToxicityDashboard from "@/components/PoolToxicityDashboard";
import RouteRiskBoard from "@/components/RouteRiskBoard";
import IntegrationBoard from "@/components/IntegrationBoard";
import FlowSegmentationPanel from "@/components/FlowSegmentationPanel";
import JitoExecutionPanel from "@/components/JitoExecutionPanel";
import SystemicRiskPanel from "@/components/SystemicRiskPanel";

type Tab = "feed" | "entities" | "routes" | "pools" | "validators" | "integrations";

function formatUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// Slim savings proof strip — shown at top of feed tab
function SavingsStrip({ savings }: { savings: SavingsSummary | null }) {
  if (!savings || savings.estimated_loss_avoided_usd_24h <= 0) return null;
  return (
    <div className="mb-4 border border-primary/25 bg-primary/5 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono">
      <div className="flex items-center gap-2">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Toxic Flow Blocked</span>
        <span className="text-lg font-bold text-primary tabular-nums">
          {formatUSD(savings.estimated_loss_avoided_usd_24h)}
        </span>
        <span className="text-[10px] text-muted-foreground">estimated / session</span>
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div className="text-[10px] text-muted-foreground">
        <span className="text-foreground font-bold">{savings.estimated_bps_saved_avg.toFixed(1)} bps</span> avg preserved
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div className="text-[10px] text-muted-foreground">
        <span className="text-foreground font-bold">{savings.routes_flagged}</span> routes flagged
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div className="text-[10px] text-muted-foreground">
        <span className="text-foreground font-bold">{savings.pools_protected}</span> pools protected
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [dataMode, setDataMode] = useState<"chain" | "fallback" | null>(null);
  const [savings, setSavings] = useState<SavingsSummary | null>(null);

  // Single poll: systemStatus drives the data-source badge; savings drives the strip.
  // EngineStatusPanel independently polls systemStatus every 5s — no need to duplicate here.
  useEffect(() => {
    const load = () => {
      api.systemStatus().then(s => setDataMode(s.mode)).catch(() => {});
      api.savingsSummary().then(setSavings).catch(() => {});
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "feed", label: "Live Feed" },
    { id: "entities", label: "Entities" },
    { id: "routes", label: "Route Risk" },
    { id: "pools", label: "Pool Toxicity" },
    { id: "validators", label: "Validators" },
    { id: "integrations", label: "Integrations" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tab nav */}
        <div className="mb-6 flex items-center gap-1 border-b border-border pb-4">
          <Link
            to="/"
            className="mr-3 border border-border px-3 py-1 text-xs font-mono tracking-wider text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            ← HOME
          </Link>

          <div className="flex flex-1 items-center gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-2 text-xs font-mono tracking-wider transition-all ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary -mb-[17px]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              to="/history"
              className="mr-4 border border-primary/20 px-3 py-1 text-primary hover:bg-primary/10 transition-colors"
            >
              HISTORY
            </Link>
            <Link
              to="/protection"
              className="mr-4 border border-primary/20 px-3 py-1 text-primary hover:bg-primary/10 transition-colors"
            >
              PROTECTION
            </Link>
            <Link
              to="/dex-intelligence/raydium"
              className="mr-4 border border-primary/20 px-3 py-1 text-primary hover:bg-primary/10 transition-colors"
            >
              DEX INTEL
            </Link>
            {dataMode === "chain" ? (
              <div className="flex items-center gap-1.5 border border-green-500/40 bg-green-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-green-400">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-green-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                LIVE CHAIN
              </div>
            ) : dataMode === "fallback" ? (
              <div className="flex items-center gap-1.5 border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-yellow-400">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                API FALLBACK
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "feed" && (
            <div>
              <SavingsStrip savings={savings} />
              <EngineStatusPanel />
              <div className="mb-4 grid gap-4 xl:grid-cols-3">
                <FlowSegmentationPanel />
                <JitoExecutionPanel />
                <SystemicRiskPanel />
              </div>
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                  Live MEV detections, refreshed every 5 seconds.
                </p>
              </div>
              <LiveAttackFeed maxItems={100} />
            </div>
          )}

          {activeTab === "entities" && <EntityExplorer />}

          {activeTab === "routes" && (
            <div>
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                  Rank routes and venues by toxic execution pressure before more flow is routed into them.
                </p>
              </div>
              <RouteRiskBoard />
            </div>
          )}

          {activeTab === "pools" && (
            <div>
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                  Rank pools by extraction pressure, LP drag, and toxic flow concentration.
                </p>
              </div>
              <PoolToxicityDashboard />
            </div>
          )}

          {activeTab === "validators" && (
            <div>
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                  Surface validator-side bundle pressure, sandwich share, and operator concentration.
                </p>
              </div>
              <div className="mb-4">
                <SystemicRiskPanel />
              </div>
              <LiveValidatorBoard />
            </div>
          )}

          {activeTab === "integrations" && (
            <div>
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                  Production outputs for routers, wallets, protocols, and risk systems.
                </p>
              </div>
              <IntegrationBoard />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
