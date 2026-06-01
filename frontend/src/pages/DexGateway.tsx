import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole } from "lucide-react";

type Dex = {
  name: string;
  slug: string;
  live: boolean;
  favicon: string;
  surfaces: string;
  detail: string;
  accent: string;
};

const DEXES: Dex[] = [
  {
    name: "Raydium",
    slug: "raydium",
    live: true,
    favicon: "https://www.google.com/s2/favicons?domain=raydium.io&sz=64",
    surfaces: "CPMM · AMM v4 · CLMM · LaunchLab",
    detail: "Sandwich detection, JIT liquidity monitor, LaunchLab sniper feed, and LP protection scores across all Raydium programs.",
    accent: "border-primary/60 bg-primary/5 hover:bg-primary/10",
  },
  {
    name: "Orca",
    slug: "orca",
    live: false,
    favicon: "https://www.google.com/s2/favicons?domain=orca.so&sz=64",
    surfaces: "Whirlpool · CLMM",
    detail: "Concentrated liquidity JIT and tick-range adverse selection.",
    accent: "border-border/50 bg-card/40",
  },
  {
    name: "Meteora",
    slug: "meteora",
    live: false,
    favicon: "https://www.google.com/s2/favicons?domain=app.meteora.ag&sz=64",
    surfaces: "DLMM · DAMM",
    detail: "Dynamic liquidity distribution and volatile pool extraction.",
    accent: "border-border/50 bg-card/40",
  },
  {
    name: "Jupiter",
    slug: "jupiter",
    live: false,
    favicon: "https://www.google.com/s2/favicons?domain=jup.ag&sz=64",
    surfaces: "Aggregator route layer",
    detail: "Cross-venue route toxicity and routing policy output.",
    accent: "border-border/50 bg-card/40",
  },
  {
    name: "Phoenix",
    slug: "phoenix",
    live: false,
    favicon: "https://www.google.com/s2/favicons?domain=phoenix.trade&sz=64",
    surfaces: "CLOB",
    detail: "Order book execution surface and front-running detection.",
    accent: "border-border/50 bg-card/40",
  },
  {
    name: "PumpSwap",
    slug: "pumpswap",
    live: false,
    favicon: "https://www.google.com/s2/favicons?domain=pump.fun&sz=64",
    surfaces: "Bonding curve · AMM",
    detail: "Launch curve sniper detection and migration front-running.",
    accent: "border-border/50 bg-card/40",
  },
];

const FALLBACK_FAVICONS: Record<string, string[]> = {
  meteora: [
    "https://www.google.com/s2/favicons?domain=app.meteora.ag&sz=64",
    "https://www.google.com/s2/favicons?domain=meteora.ag&sz=64",
    "https://meteora.ag/favicon.ico",
  ],
};

function DexLogo({ favicon, name, slug, live }: { favicon: string; name: string; slug: string; live: boolean }) {
  const fallbacks = FALLBACK_FAVICONS[slug] ?? [];
  const allSrcs = [favicon, ...fallbacks.filter((f) => f !== favicon)];
  const [srcIndex, setSrcIndex] = useState(0);
  const failed = srcIndex >= allSrcs.length;

  if (failed) {
    return (
      <div className={`flex h-10 w-10 items-center justify-center border font-mono text-sm font-bold ${live ? "border-primary/50 bg-primary/10 text-primary" : "border-border/50 bg-border/10 text-muted-foreground"}`}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={allSrcs[srcIndex]}
      alt={name}
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
      onError={() => setSrcIndex((i) => i + 1)}
    />
  );
}

export default function DexGateway() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="pointer-events-none fixed inset-0 grid-overlay-subtle opacity-10" />
      <div className="relative mx-auto max-w-[1200px]">

        {/* Nav */}
        <nav className="mb-10 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <Link to="/" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">Home</Link>
          <Link to="/dashboard" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">Dashboard</Link>
          <Link to="/protection" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">Protection</Link>
          <Link to="/intel-api" className="border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary">API</Link>
        </nav>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-12"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">DEX Intelligence</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            MEV intelligence,<br />per DEX, per pool.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">
            Know which surfaces are extracting from traders and LPs before you route, quote, or provide liquidity. Starting with Raydium — Solana's highest-consequence liquidity surface.
          </p>
        </motion.div>

        {/* Raydium — big live card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mb-6"
        >
          <Link
            to="/dex-intelligence/raydium"
            className="group relative block border border-primary/50 bg-primary/5 p-8 transition-all hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {/* corner ticks */}
            <div className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-primary/60" />
            <div className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-primary/60" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-primary/60" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-primary/60" />

            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-5">
                <DexLogo favicon="https://www.google.com/s2/favicons?domain=raydium.io&sz=64" name="Raydium" slug="raydium" live={true} />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-semibold text-foreground">Raydium</h2>
                    <span className="border border-primary/50 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Live</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">CPMM · AMM v4 · CLMM · LaunchLab · Stable AMM · Router</p>
                  <p className="mt-3 max-w-2xl text-[14px] leading-6 text-muted-foreground">
                    Sandwich detection on CPMM and AMM v4 pools, JIT liquidity window monitoring on CLMM tick ranges, LaunchLab first-fill sniper feed, and LP protection scores — all with policy output.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-4 md:items-end">
                <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
                  <div className="border border-border/60 bg-background/40 px-4 py-2 text-center md:text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">TVL Ref</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-foreground">~$975M</div>
                  </div>
                  <div className="border border-border/60 bg-background/40 px-4 py-2 text-center md:text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Surfaces</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-foreground">6 programs</div>
                  </div>
                  <div className="border border-border/60 bg-background/40 px-4 py-2 text-center md:text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Coverage</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-primary">Operational</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-primary transition-all group-hover:gap-3">
                  Open Raydium Intelligence <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Coming soon DEXes */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {DEXES.filter((d) => !d.live).map((dex, i) => (
            <motion.div
              key={dex.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 + i * 0.05 }}
              className="relative border border-border/50 bg-card/40 p-5 opacity-70"
            >
              <div className="flex items-start justify-between gap-2">
                <DexLogo favicon={dex.favicon} name={dex.name} slug={dex.slug} live={false} />
                <LockKeyhole className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div className="mt-3 font-semibold text-foreground">{dex.name}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{dex.surfaces}</div>
              <div className="mt-4 border-t border-border/40 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                Coming soon
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.5 }}
          className="mt-10 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/50"
        >
          Coverage added by extraction volume and integration demand. Request a DEX via the API access form.
        </motion.p>
      </div>
    </main>
  );
}
