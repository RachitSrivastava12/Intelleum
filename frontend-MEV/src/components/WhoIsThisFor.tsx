import { motion } from "framer-motion";

const audiences = [
  {
    title: "Solana DeFi Protocols",
    description: "Protect your users from MEV extraction and optimize execution paths.",
    icon: "◈",
  },
  {
    title: "Liquidity Providers & Vaults",
    description: "Identify toxic pools and avoid adverse selection losses to increase productivity.",
    icon: "◇",
  },
  {
    title: "Validators & Infra-Operators",
    description: "Monitor activity of mev entities and maintain integrity of network.",
    icon: "⬡",
  },
  {
    title: "Researchers, Funds & Risk Teams",
    description: "Deep analysis of MEV dynamics before making any crucial decisions.",
    icon: "△",
  },
];

const WhoIsThisFor = () => {
  return (
    <section className="relative py-20 px-6 bg-surface-elevated/20 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 grid-overlay-subtle opacity-15" />
      <motion.div 
        className="absolute bottom-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="data-label mb-2">// Built For</p>
          <h2 className="text-4xl md:text-5xl font-semibold text-foreground mb-4">
            Who This Is For
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            INTELLEUM is built for teams that need to understand MEV at the deepest level.
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {audiences.map((audience, index) => (
            <motion.div
              key={audience.title}
              className="intel-panel p-6 border-l-2 border-l-primary/30 hover:border-l-primary transition-all group"
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ x: 5 }}
            >
              <div className="flex items-start gap-4">
                <motion.span 
                  className="text-3xl text-primary/60 group-hover:text-primary transition-colors"
                  whileHover={{ scale: 1.2, rotate: 180 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {audience.icon}
                </motion.span>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {audience.title}
                  </h3>
                  <p className="text-muted-foreground text-base">
                    {audience.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Additional trust indicators */}
        <motion.div 
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="data-label mb-6">// Trusted By</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-muted-foreground font-mono text-sm">
            {["Top 10 Solana Protocols", "Institutional Funds", "Leading Validators", "Research Teams"].map((item, index) => (
              <motion.span 
                key={item}
                className="hover:text-primary transition-colors cursor-default"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                {item}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default WhoIsThisFor;
