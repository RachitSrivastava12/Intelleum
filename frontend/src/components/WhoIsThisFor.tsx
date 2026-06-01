import { motion } from "framer-motion";
import { useState } from "react";

type AudienceCard = {
  title: string;
  description: string;
  icon: string;
  buyers: Array<{ name: string; domain: string }>;
};

const audiences: AudienceCard[] = [
  {
    title: "Solana DeFi Protocols",
    description: "See which pools and routes need protection before more user flow gets burned.",
    icon: "◈",
    buyers: [
      { name: "Jupiter", domain: "jup.ag" },
      { name: "Orca", domain: "orca.so" },
      { name: "Kamino", domain: "kamino.finance" },
    ],
  },
  {
    title: "Liquidity Providers & Vaults",
    description: "Catch toxic pools, repeat extractors, and stale-quote pressure before LP drag compounds.",
    icon: "◇",
    buyers: [
      { name: "Kamino", domain: "kamino.finance" },
      { name: "Orca", domain: "orca.so" },
      { name: "Meteora", domain: "meteora.ag" },
    ],
  },
  {
    title: "Validators & Infra Operators",
    description: "Track validator-side orderflow pressure, landing patterns, and MEV-heavy execution regimes.",
    icon: "⬡",
    buyers: [
      { name: "Jito", domain: "jito.network" },
      { name: "Helius", domain: "helius.dev" },
      { name: "Sanctum", domain: "sanctum.so" },
    ],
  },
  {
    title: "Researchers, Funds & Risk Teams",
    description: "Study wallet clusters, operator behavior, and live Solana market structure with evidence.",
    icon: "△",
    buyers: [
      { name: "Multicoin", domain: "multicoin.capital" },
      { name: "Blockworks", domain: "blockworks.co" },
      { name: "Figment", domain: "figment.io" },
    ],
  },
];

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

const WhoIsThisFor = () => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden bg-surface-elevated/20 px-6 py-16">
      <div className="absolute inset-0 grid-overlay-subtle opacity-15" />
      <motion.div
        className="absolute bottom-0 right-0 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent"
        animate={{ opacity: [0.18, 0.34, 0.18] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="data-label mb-2">Built For</p>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Who This Is For
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            INTELLEUM is built for teams that need live visibility into extraction, execution quality, and toxic flow on Solana.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2">
          {audiences.map((audience, index) => (
            <motion.div
              key={audience.title}
              className="group relative overflow-hidden border border-border/80 bg-card/75 p-7"
              onHoverStart={() => setHoveredCard(audience.title)}
              onHoverEnd={() => setHoveredCard((current) => (current === audience.title ? null : current))}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              whileHover={{
                y: -6,
                borderColor: "rgba(6,214,247,0.34)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.24), inset 0 1px 0 rgba(6,214,247,0.10)",
              }}
            >
              <div className="absolute inset-y-0 left-0 w-px bg-primary/40 transition-all duration-300 group-hover:w-1" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,214,247,0.08),transparent_38%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative flex items-start gap-5">
                <motion.div
                  className="flex h-14 w-14 shrink-0 items-center justify-center border border-primary/35 bg-primary/5 font-mono text-2xl text-primary/80"
                  whileHover={{ rotate: 180, scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                >
                  {audience.icon}
                </motion.div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-[2rem] font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                    {audience.title}
                  </h3>
                  <p className="mt-4 max-w-[34rem] text-[15px] leading-8 text-muted-foreground">
                    {audience.description}
                  </p>

                  <div className="mt-6 overflow-hidden">
                    <motion.div
                      className="relative"
                      initial={false}
                      animate={{
                        opacity: hoveredCard === audience.title ? 1 : 0,
                        height: hoveredCard === audience.title ? "auto" : 0,
                        y: hoveredCard === audience.title ? 0 : 10,
                      }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <motion.div
                          className="h-px w-10 bg-primary/50"
                          initial={false}
                          animate={{
                            scaleX: hoveredCard === audience.title ? 1 : 0,
                            opacity: hoveredCard === audience.title ? 1 : 0,
                          }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          style={{ transformOrigin: "left" }}
                        />
                        <motion.div
                          className="h-2 w-2 rounded-full bg-primary/80"
                          initial={false}
                          animate={{
                            scale: hoveredCard === audience.title ? 1 : 0,
                            opacity: hoveredCard === audience.title ? 1 : 0,
                          }}
                          transition={{ duration: 0.2, delay: hoveredCard === audience.title ? 0.08 : 0 }}
                        />
                        <motion.div
                          className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80"
                          initial={false}
                          animate={{
                            opacity: hoveredCard === audience.title ? 1 : 0,
                            x: hoveredCard === audience.title ? 0 : -8,
                          }}
                          transition={{ duration: 0.22, delay: hoveredCard === audience.title ? 0.1 : 0 }}
                        >
                          Potential Buyers
                        </motion.div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {audience.buyers.map((buyer, buyerIndex) => (
                          <motion.div
                            key={buyer.name}
                            className="flex items-center gap-2 border border-border/70 bg-background/60 px-3 py-2"
                            initial={false}
                            animate={{
                              opacity: hoveredCard === audience.title ? 1 : 0,
                              y: hoveredCard === audience.title ? 0 : 10,
                              scale: hoveredCard === audience.title ? 1 : 0.96,
                            }}
                            whileHover={{ y: -2, borderColor: "rgba(6,214,247,0.34)" }}
                            transition={{
                              duration: 0.22,
                              delay: hoveredCard === audience.title ? 0.12 + 0.05 * buyerIndex : 0,
                            }}
                          >
                            <img
                              src={faviconUrl(buyer.domain)}
                              alt={buyer.name}
                              className="h-4 w-4 object-contain"
                              loading="lazy"
                            />
                            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/90">
                              {buyer.name}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhoIsThisFor;
