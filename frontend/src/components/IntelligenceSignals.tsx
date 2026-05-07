import { motion } from "framer-motion";

interface SignalPanelProps {
  title: string;
  eyebrow: string;
  subline: string;
  points: string[];
  delay?: number;
}

function SignalPanel({ title, eyebrow, subline, points, delay = 0 }: SignalPanelProps) {
  return (
    <motion.div
      className="intel-panel-glow aspect-square w-full p-6 transition-colors flex flex-col"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -6,
        borderColor: "rgba(6,214,247,0.28)",
        boxShadow: "0 22px 60px rgba(0,0,0,0.28), 0 0 0 1px rgba(6,214,247,0.08)",
      }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
      <div className="mt-3 text-[1.25rem] font-semibold leading-[1.1] tracking-tight text-foreground md:text-[1.4rem]">{title}</div>
      <div className="mt-3 text-[12px] leading-5 text-muted-foreground flex-1">{subline}</div>
      <div className="mt-auto flex flex-wrap gap-2.5 border-t border-border/70 pt-4">
        {points.map((item, index) => (
          <motion.div
            key={item}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: delay + 0.1 + index * 0.05 }}
            className="flex aspect-square w-[72px] items-center justify-center border border-border/70 bg-background/30 p-2 text-center md:w-[76px]"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-foreground">{item}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function IntelligenceSignals() {
  return (
    <section className="relative overflow-hidden px-6 py-10">
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,214,247,0.06),transparent_35%)]" />

      <div className="relative mx-auto max-w-[1280px]">
        <motion.div
          className="mx-auto mb-7 max-w-[860px] text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary">// what intelleum actually does</div>
          <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-foreground md:whitespace-nowrap md:text-[2.15rem]">
            Built to reduce toxic execution, not just chart it.
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-muted-foreground md:text-[14px]">
            Hostile flow, route pressure, and prevention outputs in one Solana-native system.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          <SignalPanel
            eyebrow="Live Detection"
            title="Catch hostile flow as blocks land."
            subline="Real-time detectors for sandwiches, arbitrage, JIT, and suspicious execution."
            points={[
              "Live feed",
              "Confidence",
              "Evidence",
            ]}
          />
          <SignalPanel
            eyebrow="Route Risk"
            title="Score routes before more flow gets sent into them."
            subline="Turn route pressure into decisions before more user flow gets burned."
            points={[
              "Avoid",
              "Monitor",
              "Reroute",
            ]}
            delay={0.05}
          />
          <SignalPanel
            eyebrow="Pool Toxicity"
            title="See where LPs and users are getting picked off."
            subline="Rank the surfaces where extraction pressure, drag, and stale quotes concentrate."
            points={[
              "LVR pressure",
              "Value drag",
              "Operator density",
            ]}
            delay={0.1}
          />
          <SignalPanel
            eyebrow="APIs & Integrations"
            title="Push the intelligence straight into production systems."
            subline="Expose live alerts, route checks, and guardrails through the API layer."
            points={[
              "Live alerts",
              "Route APIs",
              "Pre-trade guard",
            ]}
            delay={0.15}
          />
        </div>
      </div>
    </section>
  );
}
