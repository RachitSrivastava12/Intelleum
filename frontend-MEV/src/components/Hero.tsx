// import { motion } from "framer-motion";
// import IntelleumLogo from "./IntelleumLogo";
// import { Button } from "@/components/ui/button";

// const Hero = () => {
//   return (
//     <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
//       {/* Animated grid overlay */}
//       <div className="absolute inset-0 grid-overlay-subtle opacity-40" />
      
//       {/* Gradient vignette */}
//       <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
//       <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-50" />
      
//       {/* Animated decorative lines */}
//       <motion.div 
//         className="absolute top-1/4 left-10 w-px h-32 bg-gradient-to-b from-transparent via-primary/30 to-transparent"
//         animate={{ opacity: [0.3, 0.7, 0.3], height: ["8rem", "10rem", "8rem"] }}
//         transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
//       />
//       <motion.div 
//         className="absolute top-1/3 right-10 w-px h-48 bg-gradient-to-b from-transparent via-primary/20 to-transparent"
//         animate={{ opacity: [0.2, 0.5, 0.2] }}
//         transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
//       />
//       <motion.div 
//         className="absolute bottom-1/4 left-1/4 w-24 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
//         animate={{ width: ["6rem", "8rem", "6rem"] }}
//         transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
//       />
//       <motion.div 
//         className="absolute top-1/4 right-1/4 w-32 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
//         animate={{ opacity: [0.3, 0.6, 0.3] }}
//         transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
//       />
      
//       {/* Large animated glowing orbs */}
//       <motion.div 
//         className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
//         animate={{ 
//           scale: [1, 1.2, 1], 
//           opacity: [0.1, 0.2, 0.1],
//           x: [0, 20, 0],
//           y: [0, -20, 0]
//         }}
//         transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
//       />
//       <motion.div 
//         className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
//         animate={{ 
//           scale: [1, 1.3, 1], 
//           opacity: [0.1, 0.15, 0.1],
//           x: [0, -30, 0],
//           y: [0, 30, 0]
//         }}
//         transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
//       />
//       <motion.div 
//         className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
//         animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
//         transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
//       />
      
//       {/* Floating particles */}
//       {[...Array(6)].map((_, i) => (
//         <motion.div
//           key={i}
//           className="absolute w-1 h-1 bg-primary/40 rounded-full"
//           style={{
//             left: `${20 + i * 12}%`,
//             top: `${30 + (i % 3) * 20}%`,
//           }}
//           animate={{
//             y: [0, -30, 0],
//             opacity: [0.2, 0.6, 0.2],
//           }}
//           transition={{
//             duration: 3 + i * 0.5,
//             repeat: Infinity,
//             ease: "easeInOut",
//             delay: i * 0.3,
//           }}
//         />
//       ))}
      
//       {/* Content */}
//       <div className="relative z-10 flex flex-col items-center text-center max-w-5xl">
//         <motion.div
//           initial={{ opacity: 0, scale: 0.8 }}
//           animate={{ opacity: 1, scale: 1 }}
//           transition={{ duration: 0.8, ease: "easeOut" }}
//         >
//           <IntelleumLogo />
//         </motion.div>
        
//         <motion.h1 
//           className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
//           initial={{ opacity: 0, y: 30 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8, delay: 0.2 }}
//         >
//           <span className="gradient-text">INTELLEUM</span>
//         </motion.h1>
        
//         <motion.p 
//           className="mt-2 font-mono text-sm md:text-base text-primary tracking-widest uppercase"
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8, delay: 0.4 }}
//         >
//           MEV Intelligence for Solana
//         </motion.p>
        
//         <motion.p 
//           className="mt-6 text-foreground text-lg md:text-xl lg:text-2xl max-w-2xl leading-relaxed font-medium"
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8, delay: 0.6 }}
//         >
//           See who's extracting value from Solana trades — and how.
//         </motion.p>
        
//         <motion.p 
//           className="mt-3 text-muted-foreground text-base md:text-lg max-w-xl"
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8, delay: 0.7 }}
//         >
//           We track MEV bots, toxic pools, and validator behavior in real time so protocols and traders can protect themselves.
//         </motion.p>
        
//         <motion.div 
//           className="mt-8 flex flex-col sm:flex-row gap-3"
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8, delay: 0.8 }}
//         >
//           <Button variant="primary" size="lg" className="text-sm px-8 py-5" asChild>
//             <a href="#access">Request Early Access</a>
//           </Button>
//           <Button variant="ghost" size="lg" className="text-sm px-8 py-5" asChild>
//             <a href="#demo">View Intelligence Demo</a>
//           </Button>
//         </motion.div>
        
//         {/* Stats row */}
//         <motion.div 
//           className="mt-12 grid grid-cols-3 gap-6 md:gap-16 border-t border-border/50 pt-6 w-full max-w-xl"
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8, delay: 1 }}
//         >
//           <motion.div 
//             className="text-center"
//             whileHover={{ scale: 1.05 }}
//             transition={{ type: "spring", stiffness: 300 }}
//           >
//             <p className="font-mono text-2xl md:text-3xl text-primary font-bold">82+</p>
//             <p className="text-xs md:text-sm text-muted-foreground mt-1">MEV Entities Tracked</p>
//           </motion.div>
//           <motion.div 
//             className="text-center"
//             whileHover={{ scale: 1.05 }}
//             transition={{ type: "spring", stiffness: 300 }}
//           >
//             <p className="font-mono text-2xl md:text-3xl text-primary font-bold">500+</p>
//             <p className="text-xs md:text-sm text-muted-foreground mt-1">Pools Monitored</p>
//           </motion.div>
//           <motion.div 
//             className="text-center"
//             whileHover={{ scale: 1.05 }}
//             transition={{ type: "spring", stiffness: 300 }}
//           >
//             <p className="font-mono text-2xl md:text-3xl text-primary font-bold">24/7</p>
//             <p className="text-xs md:text-sm text-muted-foreground mt-1">Real-time Analysis</p>
//           </motion.div>
//         </motion.div>
//       </div>
      
//       {/* Animated scroll indicator */}
//       <motion.div 
//         className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
//         animate={{ y: [0, 10, 0], opacity: [0.4, 0.8, 0.4] }}
//         transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
//       >
//         <div className="w-px h-12 bg-gradient-to-b from-primary/50 via-primary/30 to-transparent" />
//         <span className="font-mono text-xs text-muted-foreground">SCROLL</span>
//       </motion.div>
//     </section>
//   );
// };

// export default Hero;


import { motion } from "framer-motion";
import IntelleumLogo from "./IntelleumLogo";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Animated grid overlay */}
      <div className="absolute inset-0 grid-overlay-subtle opacity-40" />
      
      {/* Gradient vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-50" />
      
      {/* MEV Flow Visualization - Left Side */}
      <motion.div 
        className="absolute left-8 top-1/2 -translate-y-1/2 hidden lg:block"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        {/* Transaction flow diagram */}
        <div className="relative">
          {/* User Transaction */}
          <motion.div
            className="mb-6 flex items-center gap-3"
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <div className="w-20 h-px bg-gradient-to-r from-green-500/60 to-transparent" />
            <span className="font-mono text-xs text-muted-foreground">USER TX</span>
          </motion.div>

          {/* MEV Bot Detection */}
          <motion.div
            className="mb-6 flex items-center gap-3"
            animate={{ x: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          >
            <div className="w-3 h-3 rounded-full bg-red-500/60 animate-pulse" />
            <div className="w-20 h-px bg-gradient-to-r from-red-500/60 to-transparent" />
            <span className="font-mono text-xs text-red-400">MEV BOT</span>
          </motion.div>

          {/* Validator */}
          <motion.div
            className="flex items-center gap-3"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          >
            <div className="w-3 h-3 rounded-full bg-primary/60" />
            <div className="w-20 h-px bg-gradient-to-r from-primary/60 to-transparent" />
            <span className="font-mono text-xs text-primary">VALIDATOR</span>
          </motion.div>

          {/* Connecting lines */}
          <div className="absolute left-1.5 top-0 w-px h-full bg-gradient-to-b from-green-500/20 via-red-500/20 to-primary/20" />
        </div>
      </motion.div>

      {/* MEV Metrics Dashboard - Right Side */}
      <motion.div 
        className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <div className="space-y-4">
          {/* Sandwich Attack Indicator */}
          <motion.div
            className="intel-panel p-3 w-48"
            whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-muted-foreground">SANDWICH</span>
              <motion.div
                className="w-2 h-2 rounded-full bg-red-500"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
            <div className="font-mono text-lg text-red-400">+247</div>
            <div className="text-xs text-muted-foreground">Last Hour</div>
          </motion.div>

          {/* Arbitrage Detection */}
          <motion.div
            className="intel-panel p-3 w-48"
            whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-muted-foreground">ARBITRAGE</span>
              <motion.div
                className="w-2 h-2 rounded-full bg-yellow-500"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
              />
            </div>
            <div className="font-mono text-lg text-yellow-400">+891</div>
            <div className="text-xs text-muted-foreground">Last Hour</div>
          </motion.div>

          {/* JIT Liquidity */}
          <motion.div
            className="intel-panel p-3 w-48"
            whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-muted-foreground">JIT LIQUID</span>
              <motion.div
                className="w-2 h-2 rounded-full bg-orange-500"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
              />
            </div>
            <div className="font-mono text-lg text-orange-400">+134</div>
            <div className="text-xs text-muted-foreground">Last Hour</div>
          </motion.div>
        </div>
      </motion.div>

      {/* Animated decorative lines with MEV data packets */}
      <motion.div 
        className="absolute top-1/4 left-10 w-px h-32 bg-gradient-to-b from-transparent via-primary/30 to-transparent"
        animate={{ opacity: [0.3, 0.7, 0.3], height: ["8rem", "10rem", "8rem"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-1/3 right-10 w-px h-48 bg-gradient-to-b from-transparent via-primary/20 to-transparent"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Block Production Visualization */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 hidden md:flex gap-2">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-8 bg-primary/20 border border-primary/30"
            animate={{ 
              height: [32, 40, 32],
              opacity: [0.3, 0.6, 0.3],
              borderColor: ["hsl(var(--primary) / 0.3)", "hsl(var(--primary) / 0.6)", "hsl(var(--primary) / 0.3)"]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              delay: i * 0.2,
              ease: "easeInOut" 
            }}
          />
        ))}
      </div>
      
      {/* Large animated glowing orbs */}
      <motion.div 
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.2, 1], 
          opacity: [0.1, 0.2, 0.1],
          x: [0, 20, 0],
          y: [0, -20, 0]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.3, 1], 
          opacity: [0.1, 0.15, 0.1],
          x: [0, -30, 0],
          y: [0, 30, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Transaction particles flowing */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${15 + i * 6}%`,
            top: `${25 + (i % 4) * 15}%`,
            background: i % 3 === 0 ? 'hsl(var(--primary) / 0.6)' : i % 3 === 1 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(234, 179, 8, 0.6)',
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, (i % 2 === 0 ? 20 : -20), 0],
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + i * 0.3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.2,
          }}
        />
      ))}
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <IntelleumLogo />
        </motion.div>
        
        <motion.h1 
          className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="gradient-text">INTELLEUM</span>
        </motion.h1>
        
        <motion.p 
          className="mt-2 font-mono text-sm md:text-base text-primary tracking-widest uppercase"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          MEV Intelligence for Solana
        </motion.p>
        
        <motion.p 
          className="mt-6 text-foreground text-lg md:text-xl lg:text-2xl max-w-2xl leading-relaxed font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          See who's extracting value from Solana trades — and how.
        </motion.p>
        
        <motion.p 
          className="mt-3 text-muted-foreground text-base md:text-lg max-w-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          Track sandwich attacks, JIT liquidity, arbitrage bots, and validator favoritism in real-time.
        </motion.p>

        {/* MEV Attack Types Inline */}
        <motion.div
          className="mt-6 flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.75 }}
        >
          {[
            { label: 'SANDWICH', color: 'red' },
            { label: 'ARBITRAGE', color: 'yellow' },
            { label: 'JIT', color: 'orange' },
            { label: 'BACKRUN', color: 'blue' },
          ].map((attack, i) => (
            <motion.div
              key={attack.label}
              className="px-3 py-1 border font-mono text-xs"
              style={{
                borderColor: `hsl(var(--${attack.color === 'red' ? 'signal-high' : attack.color === 'yellow' ? 'signal-medium' : 'primary'}) / 0.4)`,
                background: `hsl(var(--${attack.color === 'red' ? 'signal-high' : attack.color === 'yellow' ? 'signal-medium' : 'primary'}) / 0.1)`,
              }}
              whileHover={{ scale: 1.1, borderColor: `hsl(var(--primary))` }}
              animate={{ 
                opacity: [0.7, 1, 0.7],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            >
              <span style={{ 
                color: attack.color === 'red' ? 'hsl(var(--signal-high))' : 
                       attack.color === 'yellow' ? 'hsl(var(--signal-medium))' : 
                       attack.color === 'orange' ? '#fb923c' : 'hsl(var(--primary))' 
              }}>
                {attack.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div 
          className="mt-8 flex flex-col sm:flex-row gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <Button variant="primary" size="lg" className="text-sm px-8 py-5" asChild>
            <a href="#access">Request Early Access</a>
          </Button>
          <Button variant="ghost" size="lg" className="text-sm px-8 py-5" asChild>
            <a href="#demo">View Intelligence Demo</a>
          </Button>
        </motion.div>
        
        {/* Enhanced Stats row with MEV metrics */}
        <motion.div 
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 border-t border-border/50 pt-6 w-full max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <motion.div 
            className="text-center intel-panel p-4"
            whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <p className="font-mono text-xl md:text-2xl text-primary font-bold">82+</p>
            <p className="text-xs text-muted-foreground mt-1">MEV Entities</p>
          </motion.div>
          <motion.div 
            className="text-center intel-panel p-4"
            whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <p className="font-mono text-xl md:text-2xl text-primary font-bold">1.2K+</p>
            <p className="text-xs text-muted-foreground mt-1">Attacks/Day</p>
          </motion.div>
          <motion.div 
            className="text-center intel-panel p-4"
            whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <p className="font-mono text-xl md:text-2xl text-primary font-bold">500+</p>
            <p className="text-xs text-muted-foreground mt-1">Pools Tracked</p>
          </motion.div>
          <motion.div 
            className="text-center intel-panel p-4"
            whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <p className="font-mono text-xl md:text-2xl text-primary font-bold">24/7</p>
            <p className="text-xs text-muted-foreground mt-1">Live Analysis</p>
          </motion.div>
        </motion.div>
      </div>
      
      {/* Animated scroll indicator */}
      <motion.div 
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        animate={{ y: [0, 10, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-px h-12 bg-gradient-to-b from-primary/50 via-primary/30 to-transparent" />
        <span className="font-mono text-xs text-muted-foreground">SCROLL</span>
      </motion.div>
    </section>
  );
};

export default Hero;