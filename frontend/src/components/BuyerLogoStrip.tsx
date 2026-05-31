import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const endpoints = [
  { method: "GET", path: "/api/attacks",       desc: "Sandwich, JIT, backrun detections" },
  { method: "GET", path: "/api/route-risk",    desc: "Per-route toxicity score" },
  { method: "GET", path: "/api/pools",         desc: "Pool sandwich rate + LP drag" },
  { method: "GET", path: "/api/lp-protection", desc: "Adverse selection per pool" },
];

const CURL = `curl https://api.intelleum.io/api/attacks \\
  -H "X-API-Key: YOUR_KEY"`;

const RESPONSE = `[
  {
    "attack_type": "sandwich",
    "confidence": 0.97,
    "profit_usd": 142.50,
    "victim_loss_usd": 89.20,
    "pool": "SOL/USDC · CPMM"
  }
]`;

export default function BuyerLogoStrip() {
  return (
    <section className="relative overflow-hidden px-6 py-14">
      <div className="absolute inset-0 grid-overlay-subtle opacity-10" />
      <div className="relative mx-auto max-w-[1100px]">

        <motion.div
          className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary">// Intelleum API</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              MEV intelligence, one request away.
            </h2>
          </div>
          <Link
            to="/intel-api"
            className="shrink-0 border border-primary/50 px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/10"
          >
            See all endpoints →
          </Link>
        </motion.div>

        <motion.div
          className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {/* Endpoint list */}
          <div className="border border-border/60 bg-card/30">
            <div className="border-b border-border/50 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Endpoints
            </div>
            <div className="divide-y divide-border/40">
              {endpoints.map((ep) => (
                <div key={ep.path} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0 border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                    {ep.method}
                  </span>
                  <span className="font-mono text-[11px] text-foreground">{ep.path}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground hidden sm:block">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code block */}
          <div className="border border-border/60 bg-card/30">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Request</span>
              <span className="font-mono text-[9px] text-primary/60">curl</span>
            </div>
            <pre className="px-4 py-3 font-mono text-[11px] leading-5 text-primary overflow-x-auto">
              {CURL}
            </pre>
            <div className="flex items-center justify-between border-y border-border/50 px-4 py-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Response</span>
              <span className="font-mono text-[9px] text-green-400/70">200 OK</span>
            </div>
            <pre className="px-4 py-3 font-mono text-[11px] leading-5 text-muted-foreground overflow-x-auto">
              {RESPONSE}
            </pre>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
