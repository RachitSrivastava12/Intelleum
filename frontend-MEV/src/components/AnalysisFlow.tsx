const steps = [
  {
    number: "01",
    title: "Execution Ingestion",
    description:
      "Continuously ingests Solana blocks, transactions, and instruction-level execution data, preserving signer context, program calls, and account interactions for downstream analysis.",
  },
  {
    number: "02",
    title: "Order Reconstruction",
    description:
      "Reconstructs per-slot transaction ordering using on-chain execution artifacts to surface positional advantages, ordering anomalies, and execution priority effects.",
  },
  {
    number: "03",
    title: "Entity Fingerprinting",
    description:
      "Clusters wallets into coordinated MEV entities by correlating execution shapes, shared accounts, repeated interaction patterns, and cross-slot behavioral similarity.",
  },
  {
    number: "04",
    title: "Strategy Detection",
    description:
      "Identifies MEV execution strategies such as backruns and multi-transaction coordination at the entity level, capturing both direct and indirect extraction patterns.",
  },
  {
    number: "05",
    title: "Market Toxicity",
    description:
      "Quantifies MEV pressure on liquidity pools by measuring entity concentration, interaction frequency, and adverse selection risk across trading venues.",
  },
  {
    number: "06",
    title: "Validator Capture",
    description:
      "Analyzes validator inclusion behavior to detect disproportionate MEV transaction hosting, highlighting structural capture and execution favoritism risks.",
  },
];

const AnalysisFlow = () => {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-16">
          <p className="data-label mb-3">// Analysis Pipeline</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            What INTELLEUM Actually Analyzes
          </h2>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />

          <div className="space-y-0">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative pl-12 py-8 group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Node */}
                <div className="absolute left-2 top-10 w-4 h-4 border border-primary/50 bg-background flex items-center justify-center transition-colors group-hover:border-primary">
                  <div className="w-1.5 h-1.5 bg-primary/50 transition-colors group-hover:bg-primary" />
                </div>

                <div className="intel-panel p-6 border-l-2 border-l-primary/20 transition-colors group-hover:border-l-primary/50">
                  <div className="flex items-baseline gap-4 mb-1">
                    <span className="font-mono text-xs text-dim">
                      {step.number}
                    </span>
                    <h3
                      className="
                        text-lg font-medium text-foreground
                        transition-colors duration-200
                        group-hover:text-primary
                      "
                    >
                      {step.title}
                    </h3>
                  </div>

                  {/* Hover-reveal description */}
                  <p
                    className="
                      text-muted-foreground text-sm leading-relaxed
                      max-h-0 opacity-0 overflow-hidden
                      transition-all duration-300 ease-out
                      group-hover:max-h-32
                      group-hover:opacity-100
                    "
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalysisFlow;
