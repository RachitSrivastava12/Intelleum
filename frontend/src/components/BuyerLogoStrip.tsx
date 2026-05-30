import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const capabilities = [
  { label: "Pre-Trade Guard",    stat: "Route score", desc: "Score routes before execution. Block or reroute away from toxic surfaces." },
  { label: "Pool Toxicity",      stat: "Pool ranks",  desc: "Rank every pool by sandwich rate, stale quote pressure, and LP drag." },
  { label: "Live MEV Alerts",    stat: "Live stream", desc: "Sandwich, JIT, and sniper detections streamed as they land on-chain." },
  { label: "LP Protection",      stat: "LP policy",   desc: "Per-pool adverse selection scores with fee segmentation recommendations." },
];

export default function BuyerLogoStrip() {
  return (
    <section className="relative overflow-hidden px-6 py-14">
      <div className="absolute inset-0 grid-overlay-subtle opacity-10" />
      <div className="relative mx-auto max-w-[1100px]">

        <motion.div
          className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary">// Intelleum API</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Plug MEV intelligence into your stack.
            </h2>
          </div>
          <Link
            to="/intel-api"
            className="shrink-0 border border-primary/50 px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/10"
          >
            See all endpoints →
          </Link>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="border border-border/60 bg-card/40 p-5"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{cap.label}</div>
              <div className="mt-2 font-mono text-2xl font-bold text-primary">{cap.stat}</div>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
