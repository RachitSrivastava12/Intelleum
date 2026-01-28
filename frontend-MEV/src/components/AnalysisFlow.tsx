import { motion } from "framer-motion";
const steps = [
  {
    number: "01",
    title: "Execution Ingestion",
    description:
      "Continuously ingests Solana blocks, transactions, and instruction-level execution data, preserving signer context, program calls, and account interactions for downstream analysis.",
      icon: "⬡",
  },
  {
    number: "02",
    title: "Order Reconstruction",
    description:
      "Reconstructs per-slot transaction ordering using on-chain execution artifacts to surface positional advantages, ordering anomalies, and execution priority effects.",
      icon: "◈",
  },
  {
    number: "03",
    title: "Entity Fingerprinting",
    description:
      "Clusters wallets into coordinated MEV entities by correlating execution shapes, shared accounts, repeated interaction patterns, and cross-slot behavioral similarity.",
      icon: "◇",
  },
  {
    number: "04",
    title: "Strategy Detection",
    description:
      "Identifies MEV execution strategies such as backruns and multi-transaction coordination at the entity level, capturing both direct and indirect extraction patterns.",
       icon: "△",
  },
  {
    number: "05",
    title: "Market Toxicity",
    description:
      "Quantifies MEV pressure on liquidity pools by measuring entity concentration, interaction frequency, and adverse selection risk across trading venues.",
      icon: "◯",
  },
  {
    number: "06",
    title: "Validator Capture",
    description:
      "Analyzes validator inclusion behavior to detect disproportionate MEV transaction hosting, highlighting structural capture and execution favoritism risks.",
       icon: "⬢",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" as const }
  },
};

const AnalysisFlow = () => {
  return (
    <section className="relative py-16 px-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
      <motion.div 
        className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      
      <div className="max-w-6xl mx-auto">
        <motion.div 
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="data-label mb-2">// How It Works</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            From Raw Blocks to Actionable Intel
          </h2>
          <p className="mt-2 text-muted-foreground text-sm max-w-2xl">
            We process every Solana transaction to surface hidden MEV activity.
          </p>
        </motion.div>
        
        {/* Vertical flow with connecting line */}
        <div className="relative">
          {/* Animated connecting line */}
          <motion.div 
            className="absolute left-[23px] md:left-[27px] top-0 w-px bg-gradient-to-b from-primary via-primary/50 to-primary/20"
            initial={{ height: 0 }}
            whileInView={{ height: "100%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
          
          <motion.div 
            className="space-y-5"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="relative flex gap-5 items-start group"
              >
                {/* Step indicator */}
                <motion.div 
                  className="relative z-10 flex-shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center bg-background border-2 border-primary/50 group-hover:border-primary transition-colors"
                  whileHover={{ scale: 1.1, borderColor: "hsl(var(--primary))" }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <span className="font-mono text-base md:text-lg text-primary font-bold">{step.number}</span>
                </motion.div>
                
                {/* Content card */}
                <motion.div
                  className="flex-1 intel-panel p-5 border-l-2 border-l-primary/30 hover:border-l-primary transition-all group-hover:glow-border"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl text-primary/60">{step.icon}</span>
                    <h3 className="text-lg md:text-xl font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                    {step.description}
                  </p>
                  
                  {/* Decorative element */}
                  <motion.div 
                    className="mt-3 h-px bg-gradient-to-r from-primary/30 to-transparent"
                    initial={{ width: 0 }}
                    whileInView={{ width: "60%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                  />
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AnalysisFlow;
