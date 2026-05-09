import { motion, useReducedMotion } from "framer-motion";

/* ---------------------------------------------------------
 * INTELLEUM LOADER STORYBOARD
 *
 *    0ms   dark grid shell appears
 *  150ms   scanner core locks into view
 *  280ms   diagnostic checks begin to light up
 *  420ms   progress rail breathes while the page chunk resolves
 * --------------------------------------------------------- */

const TIMING = {
  shellIn: 0.2,
  scannerSpin: 3.2,
  corePulse: 1.1,
  progressSweep: 1.4,
  checkBaseDelay: 0.18,
  checkGap: 0.14,
};

const DIAGNOSTIC_CHECKS = [
  "Quote intake",
  "Route risk",
  "JIT pressure",
  "Policy decision",
];

export default function IntelleumPageLoader() {
  const reduceMotion = useReducedMotion();
  const shellTransition = reduceMotion
    ? { duration: 0 }
    : { duration: TIMING.shellIn, ease: "easeOut" as const };
  const corePulse = reduceMotion
    ? { opacity: 1, scale: 1 }
    : { opacity: [0.65, 1, 0.65], scale: [0.96, 1.04, 0.96] };

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shellTransition}
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground"
    >
      <span className="sr-only">Loading Intelleum protection engine</span>
      <div className="absolute inset-0 grid-overlay-subtle opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,hsl(var(--primary)/0.16),transparent_30%),radial-gradient(circle_at_82%_10%,hsl(var(--destructive)/0.10),transparent_24%),radial-gradient(circle_at_50%_90%,hsl(var(--primary)/0.10),transparent_32%)]" />
      <div className="absolute left-0 top-1/3 h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="relative w-full max-w-3xl">
        <div className="intel-panel-glow scanline overflow-hidden p-5 md:p-8">
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between">
            <div className="relative flex h-52 w-52 shrink-0 items-center justify-center">
              <motion.div
                className="absolute inset-0 border border-primary/20"
                animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
                transition={{
                  duration: reduceMotion ? 0 : TIMING.scannerSpin,
                  repeat: reduceMotion ? 0 : Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute inset-6 border border-primary/15"
                animate={reduceMotion ? { rotate: 0 } : { rotate: -360 }}
                transition={{
                  duration: reduceMotion ? 0 : TIMING.scannerSpin + 1,
                  repeat: reduceMotion ? 0 : Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="absolute h-32 w-px bg-gradient-to-b from-transparent via-primary/70 to-transparent" />
              <div className="absolute h-px w-32 bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
              <motion.div
                className="glow-box relative flex h-24 w-24 items-center justify-center overflow-hidden border border-primary/70 bg-primary/10"
                animate={corePulse}
                transition={{
                  duration: reduceMotion ? 0 : TIMING.corePulse,
                  repeat: reduceMotion ? 0 : Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(var(--primary)/0.26),transparent_62%)]" />
                <motion.img
                  src="/intelleum-logo.png"
                  alt=""
                  aria-hidden="true"
                  className="relative h-14 w-14 object-contain drop-shadow-[0_0_18px_hsl(var(--primary)/0.55)]"
                  animate={reduceMotion ? { rotate: 0 } : { rotate: [0, -4, 4, 0] }}
                  transition={{
                    duration: reduceMotion ? 0 : 1.6,
                    repeat: reduceMotion ? 0 : Infinity,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>
              <div className="absolute -bottom-2 border border-primary/30 bg-background/90 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
                Live Guard
              </div>
            </div>

            <div className="w-full space-y-5 text-center md:text-left">
              <div>
                <p className="data-label mb-3">// Protection Firewall</p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                  Scanning route risk
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Intelleum is checking the execution surface before the page opens.
                </p>
              </div>

              <div className="space-y-2">
                <div className="h-2 overflow-hidden border border-border bg-background">
                  <motion.div
                    className="h-full origin-left bg-primary"
                    initial={{ scaleX: 0.08 }}
                    animate={reduceMotion ? { scaleX: 1 } : { scaleX: [0.08, 1, 0.18] }}
                    transition={{
                      duration: reduceMotion ? 0 : TIMING.progressSweep,
                      repeat: reduceMotion ? 0 : Infinity,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Order flow</span>
                  <span className="text-primary">Loading</span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {DIAGNOSTIC_CHECKS.map((check, index) => (
                  <motion.div
                    key={check}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.2,
                      delay: reduceMotion ? 0 : TIMING.checkBaseDelay + index * TIMING.checkGap,
                      ease: "easeOut",
                    }}
                    className="flex min-h-10 items-center gap-2 border border-border/70 bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-glow" />
                    {check}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
