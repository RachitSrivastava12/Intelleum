import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Hero from "@/components/Hero";
import IntelligenceSignals from "@/components/IntelligenceSignals";
import BuyerLogoStrip from "@/components/BuyerLogoStrip";
import AccessForm from "@/components/AccessForm";
import Footer from "@/components/Footer";
import AnalysisFlow from "@/components/AnalysisFlow";
import WhoIsThisFor from "@/components/WhoIsThisFor";
import { useEffect, useState } from "react";
import { api, GlobalStats } from "@/lib/api";

// ============================================================
// INDEX — Landing page, but stats bar is REAL data
// Dashboard link navigates to the live app
// ============================================================

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      {/* Real-data stats bar at top of landing page too */}
  

      <Hero />
      <div className="glow-line" />
      <AnalysisFlow />
      <div className="glow-line" />
      <IntelligenceSignals />
      <div className="glow-line" />
      <BuyerLogoStrip />
      <div className="glow-line" />

      {/* CTA section linking to real dashboard */}
      <LiveDashboardCTA />
      <div className="glow-line" />
       <WhoIsThisFor />
      
      <div className="glow-line" />
      <AccessForm />
      <Footer />
    </main>
  );
};

function LiveDashboardCTA() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    const interval = setInterval(() => {
      api.stats().then(setStats).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative py-20 px-6 overflow-hidden">
      <div className="absolute inset-0 grid-overlay-subtle opacity-15 pointer-events-none" />
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <p className="data-label mb-2">// Live Intelligence</p>
        <h2 className="text-4xl md:text-5xl font-semibold text-foreground mb-4">
          Open The Live Solana MEV Surface
        </h2>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-8">
          Watch attacks, suspicious orderflow, wallet-level operators, and toxic pools update from the same live intelligence loop.
        </p>

        <div className="flex justify-center gap-10 mb-8 font-mono">
          <div>
            <div className="text-3xl font-bold text-primary">
              {stats ? ((stats.total_attacks || stats.attacks_24h) ?? 0).toLocaleString() : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Attacks detected</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">
              {stats
                ? (() => {
                    const val = stats.total_extracted_usd || stats.extracted_24h || 0;
                    return val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}`;
                  })()
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Extracted (total)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">{stats ? (stats.total_entities?.toLocaleString() ?? "0") : "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">Active operators</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <motion.button
            onClick={() => navigate("/dashboard")}
            className="px-10 py-4 bg-primary text-background font-mono font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            OPEN LIVE DASHBOARD →
          </motion.button>
          <motion.button
            onClick={() => navigate("/protection")}
            className="border border-primary/50 px-10 py-4 text-primary font-mono font-bold text-sm tracking-wider hover:bg-primary/10 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            TRY PROTECTION →
          </motion.button>
        </div>
      </div>
    </section>
  );
}

export default Index;
