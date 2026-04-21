import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import LiveAttackFeed from "@/components/LiveAttackFeed";
import EngineStatusPanel from "@/components/EngineStatusPanel";
import LiveValidatorBoard from "@/components/LiveValidatorBoard";
import EntityExplorer from "./EntityExplorer";
import PoolToxicityDashboard from "@/components/PoolToxicityDashboard";
import RouteRiskBoard from "@/components/RouteRiskBoard";
import IntegrationBoard from "@/components/IntegrationBoard";
import FlowSegmentationPanel from "@/components/FlowSegmentationPanel";
import JitoExecutionPanel from "@/components/JitoExecutionPanel";
import SystemicRiskPanel from "@/components/SystemicRiskPanel";

// ============================================================
// DASHBOARD — the real intelligence app
// Tab-based: Feed | Entities | Pools | Validators
// ============================================================

type Tab = "feed" | "entities" | "routes" | "pools" | "validators" | "integrations";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");

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
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-green-500"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            LIVE · Updates every 5s
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
