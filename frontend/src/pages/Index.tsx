import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Hero from "@/components/Hero";
import IntelligenceSignals from "@/components/IntelligenceSignals";
import BuyerLogoStrip from "@/components/BuyerLogoStrip";
import AccessForm from "@/components/AccessForm";
import Footer from "@/components/Footer";
import AnalysisFlow from "@/components/AnalysisFlow";
import WhoIsThisFor from "@/components/WhoIsThisFor";
import { useEffect, useState } from "react";
import { api, GlobalStats, SavingsSummary } from "@/lib/api";

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
      <DexProtectionSection />
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

const DEX_LIST = [
  { name: "Raydium", favicon: "https://www.google.com/s2/favicons?domain=raydium.io&sz=64",  live: true  },
  { name: "Orca",    favicon: "https://www.google.com/s2/favicons?domain=orca.so&sz=64",     live: false },
  { name: "Meteora", favicon: "https://www.google.com/s2/favicons?domain=meteora.ag&sz=64",  live: false },
  { name: "Jupiter", favicon: "https://www.google.com/s2/favicons?domain=jup.ag&sz=64",      live: false },
  { name: "Phoenix", favicon: "https://www.google.com/s2/favicons?domain=phoenix.trade&sz=64", live: false },
  { name: "PumpSwap",favicon: "https://www.google.com/s2/favicons?domain=pump.fun&sz=64",    live: false },
];

function DexFavicon({ favicon, name, live }: { favicon: string; name: string; live: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`flex h-9 w-9 items-center justify-center border font-mono text-xs font-bold ${live ? "border-primary/50 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={favicon} alt={name} width={36} height={36} className="h-9 w-9 object-contain" onError={() => setFailed(true)} />;
}

function DexProtectionSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(6,214,247,0.05),transparent_60%)]" />
      <div className="relative mx-auto max-w-[1100px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mb-10 text-center"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">// DEX Intelligence</p>
          <h2 className="mt-2 text-[1.9rem] font-semibold tracking-tight text-foreground md:text-[2.4rem]">
            MEV intelligence, per DEX, per pool.
          </h2>
          <p className="mt-3 text-[14px] leading-6 text-muted-foreground">
            Pool-level sandwich detection, JIT monitoring, and LP protection scores — starting with Raydium.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {DEX_LIST.map((dex, i) => (
            <motion.div
              key={dex.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
            >
              {dex.live ? (
                <Link
                  to="/dex-intelligence/raydium"
                  className="group flex flex-col items-center gap-3 border border-primary/45 bg-primary/5 p-5 text-center transition-all hover:bg-primary/10"
                >
                  <DexFavicon favicon={dex.favicon} name={dex.name} live={true} />
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">{dex.name}</div>
                  <span className="border border-primary/50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-primary">Live</span>
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-3 border border-border/40 bg-card/30 p-5 text-center opacity-60">
                  <DexFavicon favicon={dex.favicon} name={dex.name} live={false} />
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">{dex.name}</div>
                  <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    <LockKeyhole className="h-3 w-3" /> Soon
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-8 flex justify-center"
        >
          <Link
            to="/dex-intelligence"
            className="flex items-center gap-2 border border-primary/40 px-8 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-primary transition-all hover:bg-primary/10"
          >
            Explore DEX Intelligence <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function LiveDashboardCTA() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [savings, setSavings] = useState<SavingsSummary | null>(null);

  useEffect(() => {
    const refresh = async () => {
      const [nextStats, nextSavings] = await Promise.all([
        api.stats(),
        api.savingsSummary(),
      ]);
      setStats(nextStats);
      setSavings(nextSavings);
    };
    refresh().catch(() => {});
    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const detectionCount = stats
    ? Math.max(stats.attacks_detected_lifetime ?? stats.total_attacks ?? 0, stats.attacks_24h ?? 0, savings?.users_protected_proxy ?? 0)
    : null;
  const moneyProtected = stats
    ? Math.max(stats.total_extracted_usd ?? 0, stats.extracted_24h ?? 0, savings?.estimated_loss_avoided_usd_24h ?? 0)
    : null;
  const activeOperators = stats
    ? Math.max(stats.total_entities ?? 0, (savings?.routes_flagged ?? 0) + (savings?.pools_protected ?? 0))
    : null;

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
              {detectionCount == null ? "—" : detectionCount.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Attacks detected</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">
              {moneyProtected != null
                ? (() => {
                    const val = moneyProtected;
                    return val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}`;
                  })()
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Protected / exposed value</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">{activeOperators == null ? "—" : activeOperators.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Risk surfaces</div>
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
            onClick={() => navigate("/dex-intelligence/raydium")}
            className="border border-primary/50 px-10 py-4 text-primary font-mono font-bold text-sm tracking-wider hover:bg-primary/10 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            RAYDIUM INTEL →
          </motion.button>
          <motion.button
            onClick={() => navigate("/protection")}
            className="border border-border/70 px-10 py-4 text-foreground font-mono font-bold text-sm tracking-wider hover:border-primary/50 hover:text-primary transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            TRY PROTECTION →
          </motion.button>
          <motion.button
            onClick={() => navigate("/flow-terminal")}
            className="border border-border/70 px-10 py-4 text-foreground font-mono font-bold text-sm tracking-wider hover:border-primary/50 hover:text-primary transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            OPEN FLOW TERMINAL →
          </motion.button>
        </div>
      </div>
    </section>
  );
}

export default Index;
