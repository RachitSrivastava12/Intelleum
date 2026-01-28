import { motion } from "framer-motion";

const LiveDemo = () => {
  return (
    <section id="demo" className="relative py-20 px-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 grid-overlay-subtle opacity-15" />
      <motion.div 
        className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/5 to-transparent"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      
      <div className="max-w-6xl mx-auto">
        <motion.div 
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="data-label mb-2">// Live Feed</p>
          <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
            Sample Intelligence
          </h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-lg mx-auto">
            A glimpse of what our dashboard shows.
          </p>
        </motion.div>
        
        <div className="grid lg:grid-cols-3 gap-6">
          {/* MEV Entities Panel */}
          <motion.div 
            className="intel-panel p-6 scanline"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <motion.div 
                className="w-2 h-2 bg-primary"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <h3 className="font-mono text-sm uppercase tracking-wider text-foreground">MEV Entities</h3>
            </div>
            
            <div className="space-y-4 font-mono text-sm">
              {[
                { id: "ENT-001", wallets: 9, risk: "high", strategy: "Backrun" },
                { id: "ENT-002", wallets: 4, risk: "medium", strategy: "Backrun" },
                { id: "ENT-003", wallets: 2, risk: "low", strategy: "Backrun" },
                { id: "ENT-004", wallets: 7, risk: "high", strategy: "Sandwich" },
              ].map((entity, index) => (
                <motion.div 
                  key={entity.id}
                  className={`p-4 bg-background/50 border-l-2 border-signal-${entity.risk}`}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ x: 5 }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-foreground font-semibold">{entity.id}</span>
                    <span className={`signal-${entity.risk} capitalize`}>{entity.risk} risk</span>
                  </div>
                  <div className="text-dim">{entity.wallets} wallets • {entity.strategy}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Pool Toxicity Panel */}
          <motion.div 
            className="intel-panel p-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <motion.div 
                className="w-2 h-2 bg-primary"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              />
              <h3 className="font-mono text-sm uppercase tracking-wider text-foreground">Pool Toxicity</h3>
            </div>
            
            <div className="space-y-5 font-mono text-sm">
              {[
                { pool: "SOL/USDC", level: 85, label: "HIGH", signal: "high" },
                { pool: "BONK/SOL", level: 65, label: "ELEVATED", signal: "medium" },
                { pool: "JTO/SOL", level: 45, label: "MODERATE", signal: "low" },
                { pool: "RAY/SOL", level: 72, label: "ELEVATED", signal: "medium" },
              ].map((item, index) => (
                <motion.div 
                  key={item.pool}
                  className="flex items-center justify-between p-3 bg-background/50"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
                >
                  <span className="text-foreground font-medium">{item.pool}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-2 bg-border overflow-hidden">
                      <motion.div 
                        className={`h-full bg-signal-${item.signal}`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.level}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                      />
                    </div>
                    <span className={`signal-${item.signal} text-xs w-16 text-right`}>{item.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Validator Capture Panel */}
          <motion.div 
            className="intel-panel p-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <motion.div 
                className="w-2 h-2 bg-primary"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
              />
              <h3 className="font-mono text-sm uppercase tracking-wider text-foreground">Validator Capture</h3>
            </div>
            
            <div className="space-y-5 font-mono text-sm">
              {[
                { name: "Validator A", rate: 27 },
                { name: "Validator B", rate: 22 },
                { name: "Validator C", rate: 18 },
                { name: "Validator D", rate: 15 },
              ].map((validator, index) => (
                <motion.div 
                  key={validator.name}
                  className="p-3 bg-background/50"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-foreground">{validator.name}</span>
                    <span className="text-primary font-bold">{validator.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-border overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${validator.rate}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.4 + index * 0.1 }}
                    />
                  </div>
                  <div className="text-dim mt-2 text-xs">MEV inclusion rate</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
        
        {/* Additional Stats Row */}
        <motion.div 
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {[
            { label: "Total MEV Volume", value: "$2.4M", sublabel: "Last 24h" },
            { label: "Active Entities", value: "47", sublabel: "Currently trading" },
            { label: "Blocks Analyzed", value: "12.5K", sublabel: "Last hour" },
            { label: "Alerts Triggered", value: "23", sublabel: "Today" },
          ].map((stat, index) => (
            <motion.div 
              key={stat.label}
              className="intel-panel p-5 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <p className="font-mono text-2xl md:text-3xl text-primary font-bold">{stat.value}</p>
              <p className="text-foreground text-sm mt-1">{stat.label}</p>
              <p className="text-dim text-xs">{stat.sublabel}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default LiveDemo;
