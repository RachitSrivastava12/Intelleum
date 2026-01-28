import { motion } from "framer-motion";

interface SignalPanelProps {
  title: string;
  description: string;
  children: React.ReactNode;
  delay?: number;
}

const SignalPanel = ({ title, description, children, delay = 0 }: SignalPanelProps) => (
  <motion.div 
    className="intel-panel-glow p-6 h-full"
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
    whileHover={{ y: -5, transition: { duration: 0.2 } }}
  >
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: delay + 0.2 }}
    >
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-5">{description}</p>
    </motion.div>
    <div className="border-t border-border pt-5">
      {children}
    </div>
  </motion.div>
);

const AnimatedDataRow = ({ label, value, delay = 0, signal }: { label: string; value: string; delay?: number; signal?: 'high' | 'medium' | 'low' }) => (
  <motion.div 
    className="data-row"
    initial={{ opacity: 0, x: -10 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4, delay }}
  >
    <span className="data-label">{label}</span>
    <span className={`data-value ${signal ? `signal-${signal}` : ''}`}>{value}</span>
  </motion.div>
);

const IntelligenceSignals = () => {
  return (
    <section className="relative py-20 px-6 bg-surface-elevated/30 overflow-hidden">
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
      
      {/* Animated background glow */}
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 10, repeat: Infinity }}
      />
      
      <div className="relative max-w-7xl mx-auto">
        <motion.div 
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="data-label mb-2">// What You Get</p>
          <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
            Real-Time MEV Intelligence
          </h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">
            Track bad actors, risky pools, and compromised validators — all in one dashboard.
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* MEV Actor Fingerprinting */}
          <SignalPanel
            title="MEV Actor Fingerprinting"
            description="Cluster wallets into real MEV entities using execution shapes and shared on-chain behavior."
            delay={0}
          >
            <div className="space-y-3">
              <AnimatedDataRow label="Entities Identified" value="82" delay={0.3} />
              <AnimatedDataRow label="Wallets Clustered" value="51" delay={0.4} />
              <AnimatedDataRow label="Confidence Scoring" value="ENABLED" delay={0.5} />
            </div>
          </SignalPanel>

          {/* Strategy Detection */}
          <SignalPanel
            title="Strategy Detection"
            description="Identify execution patterns that extract value from other market participants."
            delay={0.1}
          >
            <div className="space-y-3">
              <AnimatedDataRow label="Backrun Execution" value="64 confirmed" delay={0.4} />
              <AnimatedDataRow label="Coordinated Behavior" value="DETECTED" delay={0.5} />
              <AnimatedDataRow label="Cross-slot Activity" value="ACTIVE" delay={0.6} />
            </div>
          </SignalPanel>

          {/* Pool Toxicity */}
          <SignalPanel
            title="Pool Toxicity"
            description="Rank liquidity pools by MEV pressure and entity concentration."
            delay={0.2}
          >
            <div className="space-y-3">
              <motion.div 
                className="data-row"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <span className="font-mono text-sm text-foreground">SOL/USDC</span>
                <span className="font-mono text-sm">
                  <span className="text-dim">20 entities</span>
                  <span className="mx-2 text-border">|</span>
                  <span className="signal-high">303 MEV</span>
                </span>
              </motion.div>
              <motion.div 
                className="data-row"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <span className="font-mono text-sm text-foreground">BONK/SOL</span>
                <span className="font-mono text-sm">
                  <span className="text-dim">20 entities</span>
                  <span className="mx-2 text-border">|</span>
                  <span className="signal-medium">204 MEV</span>
                </span>
              </motion.div>
              <motion.div 
                className="data-row"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                <span className="font-mono text-sm text-foreground">JTO/SOL</span>
                <span className="font-mono text-sm">
                  <span className="text-dim">19 entities</span>
                  <span className="mx-2 text-border">|</span>
                  <span className="signal-low">166 MEV</span>
                </span>
              </motion.div>
            </div>
          </SignalPanel>

          {/* Competition Density */}
          <SignalPanel
            title="Competition Density"
            description="Measure how many MEV actors compete over the same execution opportunities."
            delay={0.3}
          >
            <div className="space-y-4 font-mono text-sm">
              <motion.div 
                className="p-4 bg-background/50 border border-border"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <p className="text-dim mb-2">// INSIGHT</p>
                <p className="text-foreground leading-relaxed">
                  High density = unstable execution surface
                </p>
                <p className="text-muted-foreground mt-1">
                  Low density = exploitable structural advantage
                </p>
              </motion.div>
              <motion.div 
                className="flex justify-between items-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                <span className="text-dim">Current Density</span>
                <span className="text-primary font-bold">HIGH</span>
              </motion.div>
            </div>
          </SignalPanel>

          {/* Validator Capture */}
          <SignalPanel
            title="Validator Capture"
            description="Identify validators that systematically include MEV extraction transactions."
            delay={0.4}
          >
            <div className="space-y-3">
              <AnimatedDataRow label="Validator A" value="47 MEV txns" delay={0.7} />
              <AnimatedDataRow label="Validator B" value="17 MEV txns" delay={0.8} />
              <AnimatedDataRow label="Flagged Validators" value="12" delay={0.9} />
            </div>
          </SignalPanel>

          {/* Live Activity Feed */}
          <SignalPanel
            title="Live Activity Feed"
            description="Real-time stream of detected MEV events across monitored pools."
            delay={0.5}
          >
            <div className="space-y-2 font-mono text-xs">
              {[
                { time: "12:45:32", event: "Backrun detected", pool: "SOL/USDC" },
                { time: "12:45:28", event: "Entity cluster", pool: "BONK/SOL" },
                { time: "12:45:21", event: "Sandwich found", pool: "JTO/SOL" },
              ].map((item, index) => (
                <motion.div 
                  key={index}
                  className="flex items-center gap-3 p-2 bg-background/50 border-l-2 border-primary/30"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
                >
                  <span className="text-dim">{item.time}</span>
                  <span className="text-foreground flex-1">{item.event}</span>
                  <span className="text-primary">{item.pool}</span>
                </motion.div>
              ))}
            </div>
          </SignalPanel>
        </div>
      </div>
    </section>
  );
};

export default IntelligenceSignals;
