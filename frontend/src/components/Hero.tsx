import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import IntelleumLogo from "./IntelleumLogo";

const sideLegend = [
  { label: "user tx",   color: "bg-green-500/70",  text: "text-muted-foreground" },
  { label: "mev bot",   color: "bg-red-500/70",     text: "text-red-400" },
  { label: "validator", color: "bg-primary/80",     text: "text-primary" },
];

const rightCards = [
  { title: "sandwich",  value: "+247", meta: "Last Hour", tone: "text-red-300" },
  { title: "arbitrage", value: "+891", meta: "Last Hour", tone: "text-yellow-300" },
  { title: "jit liquid",value: "+134", meta: "Last Hour", tone: "text-orange-300" },
];

const attackTags = ["sandwich", "arbitrage", "jit", "backrun"];

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden px-6 py-20">
      <div className="absolute inset-0 grid-overlay-subtle opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,214,247,0.10),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(217,38,38,0.08),transparent_18%)]" />

      {/* Left legend */}
      <motion.div
        className="absolute left-8 top-1/2 hidden -translate-y-1/2 lg:block"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="space-y-6">
          {sideLegend.map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <div className={`h-3 w-3 rounded-full ${item.color}`} />
              <div className="h-px w-20 bg-gradient-to-r from-primary/50 to-transparent" />
              <span className={`font-mono text-xs uppercase tracking-[0.2em] ${item.text}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Right cards */}
      <motion.div
        className="absolute right-8 top-1/2 hidden -translate-y-1/2 space-y-4 lg:block"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {rightCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 + index * 0.08 }}
            className="w-52 border border-border/70 bg-surface/60 p-4"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{card.title}</div>
            <div className={`mt-2 font-mono text-2xl uppercase ${card.tone}`}>{card.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{card.meta}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Center content */}
      <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center text-center">

        {/* Logo + title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <IntelleumLogo />
          <div className="mt-6 text-4xl font-semibold tracking-tight text-primary md:text-6xl">INTELLEUM</div>
          <div className="mt-3 font-mono text-xs uppercase tracking-[0.34em] text-primary">
            mev intelligence for solana
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12 }}
          className="mt-10 max-w-4xl text-[2rem] font-semibold leading-tight text-foreground md:text-[3.35rem]"
        >
          See where Solana orderflow is getting extracted, repriced, and routed.
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.18 }}
          className="mt-5 max-w-3xl text-[15px] leading-7 text-muted-foreground md:text-lg"
        >
          Track live MEV detections, wallet-level operator profiles, toxic pools, and validator-linked execution patterns in real-time.
        </motion.p>

        {/* Attack tags */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="mt-7 flex flex-wrap justify-center gap-3"
        >
          {attackTags.map((tag) => (
            <div
              key={tag}
              className="border border-border/80 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-foreground"
            >
              {tag}
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <a
            href="#access"
            className="border border-primary bg-primary px-7 py-4 font-mono text-xs uppercase tracking-[0.22em] text-background transition-colors hover:bg-primary/90"
          >
            Request Early Access
          </a>
          <Link
            to="/dashboard"
            className="px-4 py-4 text-base text-foreground transition-colors hover:text-primary"
          >
            View Intelligence Demo
          </Link>
        </motion.div>

      </div>
    </section>
  );
}
