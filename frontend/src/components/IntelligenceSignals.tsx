import { motion } from "framer-motion";

interface SignalPanelProps {
  title: string;
  eyebrow: string;
  subline: string;
  points: string[];
  index: string;
  delay?: number;
}

function SignalPanel({ title, eyebrow, subline, points, index, delay = 0 }: SignalPanelProps) {
  return (
    <motion.div
      className="intel-panel-glow group relative flex min-h-[280px] w-full flex-col overflow-hidden border border-border/60 bg-background/40 p-5 transition-colors sm:aspect-square sm:min-h-0"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -4,
        borderColor: "rgba(6,214,247,0.35)",
        boxShadow:
          "0 22px 60px rgba(0,0,0,0.32), 0 0 0 1px rgba(6,214,247,0.12), inset 0 0 0 1px rgba(6,214,247,0.04)",
      }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-primary/40" />
      <div className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-primary/40" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-primary/40" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-primary/40" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(6,214,247,0.6)]" />
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </div>
        </div>
        <div className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground/60">
          {index}
        </div>
      </div>

      <div className="mt-2.5 h-px w-full bg-gradient-to-r from-primary/30 via-border/50 to-transparent" />

      <div className="mt-5 text-[1.08rem] font-semibold leading-[1.15] tracking-tight text-foreground md:text-[1.25rem]">
        {title}
      </div>

      <div className="mt-3 text-[12px] leading-[1.55] text-muted-foreground md:text-[13px]">
        {subline}
      </div>

      <div className="flex-1" />

      <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-3">
        {points.map((item, idx) => (
          <motion.div
            key={item}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: delay + 0.15 + idx * 0.05 }}
            className="flex min-h-10 items-center gap-2 border-l border-border/40 bg-background/30 py-2 pl-2.5 pr-2 transition-colors group-hover:border-l-primary/50 group-hover:bg-primary/[0.03]"
          >
            <span className="font-mono text-[8.5px] tracking-[0.1em] text-primary/70">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/85">
              {item}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function IntelligenceSignals() {
  return (
    <section className="relative overflow-hidden px-6 py-12">
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,214,247,0.06),transparent_35%)]" />

      <div className="relative mx-auto max-w-[1100px]">
        <motion.div
          className="mx-auto mb-10 max-w-[860px] text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary">
            // what intelleum actually does
          </div>
          <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-foreground md:whitespace-nowrap md:text-[2.15rem]">
            Built to reduce toxic execution, not just chart it.
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-muted-foreground md:text-[14px]">
            Hostile flow, route pressure, and prevention outputs in one Solana-native system.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-[920px] grid-cols-1 gap-4 sm:grid-cols-2">
          <SignalPanel
            eyebrow="Live Detection"
            index="01 / 04"
            title="Catch hostile flow as blocks land."
            subline="Real-time detectors for sandwiches, arbitrage, JIT, and suspicious execution."
            points={["Live feed", "Confidence score", "On-chain evidence"]}
          />
          <SignalPanel
            eyebrow="Route Risk"
            index="02 / 04"
            title="Score routes before more flow gets sent into them."
            subline="Turn route pressure into decisions before more user flow gets burned."
            points={["Avoid", "Monitor", "Reroute"]}
            delay={0.05}
          />
          <SignalPanel
            eyebrow="Pool Toxicity"
            index="03 / 04"
            title="See where LPs and users are getting picked off."
            subline="Rank the surfaces where extraction pressure, drag, and stale quotes concentrate."
            points={["LVR pressure", "Value drag", "Operator density"]}
            delay={0.1}
          />
          <SignalPanel
            eyebrow="APIs & Integrations"
            index="04 / 04"
            title="Push the intelligence straight into production systems."
            subline="Expose live alerts, route checks, and guardrails through the API layer."
            points={["Live alerts", "Route APIs", "Pre-trade guard"]}
            delay={0.15}
          />
        </div>
      </div>
    </section>
  );
}
