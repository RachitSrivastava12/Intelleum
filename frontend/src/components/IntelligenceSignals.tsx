import { motion } from "framer-motion";

interface SignalPanelProps {
  title: string;
  description: string;
  bullets: string[];
  delay?: number;
}

function SignalPanel({ title, description, bullets, delay = 0 }: SignalPanelProps) {
  return (
    <motion.div
      className="intel-panel-glow h-full p-6"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">{title}</div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-3 border-t border-border/70 pt-4">
        {bullets.map((item, index) => (
          <motion.div
            key={item}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: delay + 0.1 + index * 0.05 }}
            className="flex items-start gap-3"
          >
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-mono text-xs leading-6 text-foreground">{item}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function IntelligenceSignals() {
  return (
    <section className="relative overflow-hidden px-6 py-20">
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,214,247,0.06),transparent_35%)]" />

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary">// what intelleum actually does</div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Built to reduce toxic execution, not just visualize it after the fact.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground md:text-base">
            Intelleum combines live detection, route risk, entity intelligence, validator context, and exportable
            action feeds so Solana teams can see hostile flow and react faster.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <SignalPanel
            title="Live Detection"
            description="Surface sandwich attacks, arbitrage, JIT liquidity, liquidations, backruns, and suspicious flow as blocks land."
            bullets={[
              "real-time mev event stream",
              "confidence-scored detection families",
              "evidence trails for each surfaced event",
            ]}
          />
          <SignalPanel
            title="Route Risk"
            description="Score venues and execution paths by hostile-flow pressure so routing systems can downrank toxic surfaces before more users get hit."
            bullets={[
              "avoid / penalize / monitor recommendations",
              "bundle-share and operator concentration",
              "execution-quality framing for wallets and aggregators",
            ]}
            delay={0.05}
          />
          <SignalPanel
            title="Pool Toxicity"
            description="Rank where extraction pressure is concentrated and distinguish between exact pools, venues, and route-level surfaces honestly."
            bullets={[
              "repeat sandwich pressure",
              "extracted value concentration",
              "operator density across pools and venues",
            ]}
            delay={0.1}
          />
          <SignalPanel
            title="Entity Intelligence"
            description="Move beyond isolated wallets by clustering behavior into operators, tracking attack history, and surfacing repeat execution patterns."
            bullets={[
              "wallet-level operator profiles",
              "behavioral clustering over time",
              "attacker-side attribution context",
            ]}
            delay={0.15}
          />
          <SignalPanel
            title="Validator Context"
            description="Watch where MEV-heavy flow repeatedly lands and where priority-fee or bundle-like execution pressure is concentrated."
            bullets={[
              "sandwich share by validator",
              "wide-bracket activity concentration",
              "jito-aligned / priority-fee execution context",
            ]}
            delay={0.2}
          />
          <SignalPanel
            title="Integrations"
            description="Expose the intelligence directly to production systems through route recommendations, live alerts, and exportable feeds."
            bullets={[
              "live alerts feed for ops and risk",
              "route recommendations for routers",
              "api surfaces for protocol-side monitoring",
            ]}
            delay={0.25}
          />
        </div>
      </div>
    </section>
  );
}
