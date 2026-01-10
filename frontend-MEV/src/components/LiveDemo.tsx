const LiveDemo = () => {
  return (
    <section id="demo" className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-16 text-center">
          <p className="data-label mb-3">// Live Feed</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Intelligence Demo
          </h2>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-6">
          {/* MEV Entities Panel */}
          <div className="intel-panel p-6 scanline">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-primary animate-pulse-subtle" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">MEV Entities</h3>
            </div>
            
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 bg-background/50 border-l-2 border-signal-high">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-foreground">ENT-001</span>
                  <span className="signal-high">High risk</span>
                </div>
                <div className="text-dim">9 wallets • Backrun</div>
              </div>
              
              <div className="p-3 bg-background/50 border-l-2 border-signal-medium">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-foreground">ENT-002</span>
                  <span className="signal-medium">Medium risk</span>
                </div>
                <div className="text-dim">4 wallets • Backrun</div>
              </div>
              
              <div className="p-3 bg-background/50 border-l-2 border-signal-low">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-foreground">ENT-003</span>
                  <span className="signal-low">Low risk</span>
                </div>
                <div className="text-dim">2 wallets • Backrun</div>
              </div>
            </div>
          </div>

          {/* Pool Toxicity Panel */}
          <div className="intel-panel p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-primary animate-pulse-subtle" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">Pool Toxicity</h3>
            </div>
            
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between p-3 bg-background/50">
                <span className="text-foreground">SOL/USDC</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1 bg-border overflow-hidden">
                    <div className="w-[85%] h-full bg-signal-high" />
                  </div>
                  <span className="signal-high text-[10px]">HIGH</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-background/50">
                <span className="text-foreground">BONK/SOL</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1 bg-border overflow-hidden">
                    <div className="w-[65%] h-full bg-signal-medium" />
                  </div>
                  <span className="signal-medium text-[10px]">ELEVATED</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-background/50">
                <span className="text-foreground">JTO/SOL</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1 bg-border overflow-hidden">
                    <div className="w-[45%] h-full bg-signal-low" />
                  </div>
                  <span className="signal-low text-[10px]">MODERATE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Validator Capture Panel */}
          <div className="intel-panel p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-primary animate-pulse-subtle" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">Validator Capture</h3>
            </div>
            
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 bg-background/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-foreground">Validator A</span>
                  <span className="text-primary">27%</span>
                </div>
                <div className="w-full h-1 bg-border overflow-hidden">
                  <div className="w-[27%] h-full bg-primary" />
                </div>
                <div className="text-dim mt-1">MEV inclusion rate</div>
              </div>
              
              <div className="p-3 bg-background/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-foreground">Validator B</span>
                  <span className="text-primary">22%</span>
                </div>
                <div className="w-full h-1 bg-border overflow-hidden">
                  <div className="w-[22%] h-full bg-primary" />
                </div>
                <div className="text-dim mt-1">MEV inclusion rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveDemo;
