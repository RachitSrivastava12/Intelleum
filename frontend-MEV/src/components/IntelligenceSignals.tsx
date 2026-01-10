interface SignalPanelProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const SignalPanel = ({ title, description, children }: SignalPanelProps) => (
  <div className="intel-panel-glow p-6 md:p-8">
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm mb-6">{description}</p>
    <div className="border-t border-border pt-6">
      {children}
    </div>
  </div>
);

const IntelligenceSignals = () => {
  return (
    <section className="relative py-32 px-6 bg-surface-elevated/30">
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
      
      <div className="relative max-w-6xl mx-auto">
        <div className="mb-16 text-center">
          <p className="data-label mb-3">// Core Intelligence</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Intelligence Signals
          </h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* MEV Actor Fingerprinting */}
          <SignalPanel
            title="MEV Actor Fingerprinting"
            description="Cluster wallets into real MEV entities using execution shapes and shared on-chain behavior."
          >
            <div className="space-y-3">
              <div className="data-row">
                <span className="data-label">Entities Identified</span>
                <span className="data-value">82</span>
              </div>
              <div className="data-row">
                <span className="data-label">Wallets Clustered</span>
                <span className="data-value">51</span>
              </div>
              <div className="data-row">
                <span className="data-label">Confidence Scoring</span>
                <span className="data-value">ENABLED</span>
              </div>
            </div>
          </SignalPanel>

          {/* Strategy Detection */}
          <SignalPanel
            title="Strategy Detection"
            description="Identify execution patterns that extract value from other market participants."
          >
            <div className="space-y-3">
              <div className="data-row">
                <span className="data-label">Backrun Execution</span>
                <span className="data-value">64 confirmed</span>
              </div>
              <div className="data-row">
                <span className="data-label">Coordinated Behavior</span>
                <span className="data-value">DETECTED</span>
              </div>
              <div className="data-row">
                <span className="data-label">Cross-slot Activity</span>
                <span className="data-value">ACTIVE</span>
              </div>
            </div>
          </SignalPanel>

          {/* Pool Toxicity */}
          <SignalPanel
            title="Pool Toxicity"
            description="Rank liquidity pools by MEV pressure and entity concentration."
          >
            <div className="space-y-3">
              <div className="data-row">
                <span className="font-mono text-xs text-foreground">SOL/USDC</span>
                <span className="font-mono text-xs">
                  <span className="text-dim">20 entities</span>
                  <span className="mx-2 text-border">|</span>
                  <span className="signal-high">303 MEV</span>
                </span>
              </div>
              <div className="data-row">
                <span className="font-mono text-xs text-foreground">BONK/SOL</span>
                <span className="font-mono text-xs">
                  <span className="text-dim">20 entities</span>
                  <span className="mx-2 text-border">|</span>
                  <span className="signal-medium">204 MEV</span>
                </span>
              </div>
              <div className="data-row">
                <span className="font-mono text-xs text-foreground">JTO/SOL</span>
                <span className="font-mono text-xs">
                  <span className="text-dim">19 entities</span>
                  <span className="mx-2 text-border">|</span>
                  <span className="signal-low">166 MEV</span>
                </span>
              </div>
            </div>
          </SignalPanel>

          {/* Competition Density */}
          <SignalPanel
            title="Competition Density"
            description="Measure how many MEV actors compete over the same execution opportunities."
          >
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 bg-background/50 border border-border">
                <p className="text-dim mb-2">// INSIGHT</p>
                <p className="text-foreground leading-relaxed">
                  High density = unstable execution surface
                </p>
                <p className="text-muted-foreground mt-1">
                  Low density = exploitable structural advantage
                </p>
              </div>
            </div>
          </SignalPanel>

          {/* Validator Capture - Full Width */}
          <div className="md:col-span-2">
            <SignalPanel
              title="Validator Capture"
              description="Identify validators that systematically include MEV extraction transactions."
            >
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="data-row">
                    <span className="font-mono text-xs text-foreground">Validator A</span>
                    <span className="data-value">47 MEV txns</span>
                  </div>
                  <div className="data-row">
                    <span className="font-mono text-xs text-foreground">Validator B</span>
                    <span className="data-value">17 MEV txns</span>
                  </div>
                </div>
                <div className="p-4 bg-background/50 border border-border font-mono text-xs">
                  <p className="text-dim mb-2">// SAMPLE INSIGHT</p>
                  <p className="text-foreground">Validators with MEV inclusion rate {">"} 25%</p>
                  <p className="text-muted-foreground mt-1">flagged for structural capture analysis</p>
                </div>
              </div>
            </SignalPanel>
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntelligenceSignals;
