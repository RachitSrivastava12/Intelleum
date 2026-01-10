const audiences = [
  "Solana DeFi Protocols",
  "Liquidity Providers & Vaults",
  "Validators & Infrastructure Operators",
  "Researchers, Funds & Risk Teams",
];

const WhoIsThisFor = () => {
  return (
    <section className="relative py-32 px-6 bg-surface-elevated/20">
      <div className="max-w-3xl mx-auto text-center">
        <p className="data-label mb-3">// Target Users</p>
        <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-12">
          Who This Is For
        </h2>
        
        <div className="space-y-4">
          {audiences.map((audience, index) => (
            <div
              key={audience}
              className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors py-3 border-b border-border/30"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {audience}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhoIsThisFor;
