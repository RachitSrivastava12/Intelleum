import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useState } from "react";

export default function Hero() {
  const [previewExpanded, setPreviewExpanded] = useState(false);

  return (
    <section className="relative min-h-screen overflow-hidden px-6 py-4 md:py-0">
      <div className="absolute inset-0 grid-overlay-subtle opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,214,247,0.10),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(217,38,38,0.08),transparent_18%)]" />

      {previewExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/86 backdrop-blur-md"
          onClick={() => setPreviewExpanded(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative w-[min(94vw,1400px)]"
          >
            <div className="absolute inset-x-[8%] top-[8%] -z-10 h-[84%] rounded-full bg-primary/12 blur-3xl" />
            <button
              type="button"
              onClick={() => setPreviewExpanded(false)}
              className="absolute right-0 top-[-2.5rem] border border-border/70 bg-background/70 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setPreviewExpanded(false)}
              className="block w-full text-left"
            >
            <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_6%,black_94%,transparent_100%),linear-gradient(to_bottom,transparent_0%,black_6%,black_94%,transparent_100%)] [mask-composite:intersect] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_6%,black_94%,transparent_100%),linear-gradient(to_bottom,transparent_0%,black_6%,black_94%,transparent_100%)] [-webkit-mask-composite:source-in]">
              <div className="relative aspect-[16/9] h-full w-full">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="h-full w-full object-contain object-center"
                >
                  <source src="/intelleum-hero-demo.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,214,247,0.08),transparent_35%),linear-gradient(180deg,rgba(8,11,15,0.02),rgba(8,11,15,0.18))]" />
                <div className="absolute bottom-4 right-4 border border-border/70 bg-background/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Click To Collapse
                </div>
              </div>
            </div>
            </button>
          </motion.div>
        </div>
      )}

      <div className="relative mx-auto flex min-h-screen max-w-[1500px] items-center">
        <div className="grid w-full gap-5 py-4 lg:grid-cols-[0.64fr,1.36fr] lg:items-center lg:gap-14">
          <div className="text-center lg:pl-6 lg:text-left xl:pl-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center lg:items-start"
            >
              <div className="space-y-2 text-left">
                <div className="text-4xl font-semibold tracking-tight text-primary md:text-[3.7rem]">INTELLEUM</div>
                <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                  MEV Intelligence For Solana
                </div>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12 }}
              className="mt-6 max-w-[42rem] text-[1.85rem] font-semibold leading-[1.02] tracking-tight text-foreground md:text-[2.7rem]"
            >
              <span className="block max-w-[32rem]">See where Solana orderflow is getting</span>
              <span className="mt-4 block font-medium text-primary/95">&gt; extracted</span>
              <span className="mt-1 block font-medium text-foreground/92">&gt; repriced</span>
              <span className="mt-1 block font-medium text-foreground/92">&gt; routed</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.18 }}
              className="mt-7 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:justify-center lg:justify-start"
            >
              {["SANDWICH", "ARBITRAGE", "JIT", "BACKRUN"].map((item) => (
                <div
                  key={item}
                  className="border border-border/70 bg-background/25 px-5 py-4 text-center font-mono text-[14px] uppercase tracking-[0.3em] text-foreground/90 transition-colors hover:border-primary/40 hover:text-primary sm:px-7"
                >
                  {item}
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-7 flex flex-wrap justify-center gap-4 lg:justify-start"
            >
              <Link
                to="/dashboard"
                className="border border-primary bg-primary px-7 py-4 font-mono text-xs uppercase tracking-[0.22em] text-background transition-colors hover:bg-primary/90"
              >
                Open Live Demo
              </Link>


              <Link
                to="/flow-terminal"
                className="border border-primary bg-primary px-7 py-4 font-mono text-xs uppercase tracking-[0.22em] text-background transition-colors hover:bg-primary/90 "
              >
                Flow Terminal
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="relative w-full overflow-visible text-left lg:pl-4 xl:pl-8"
          >
            <div className="absolute inset-x-[6%] top-[10%] -z-10 h-[76%] rounded-full bg-primary/10 blur-3xl" />
            <button
              type="button"
              onClick={() => setPreviewExpanded(true)}
              className="relative block w-full text-left"
            >
            <div className="relative -mx-3 aspect-[16.8/10] overflow-hidden md:-mx-5 lg:-mx-8 xl:-mx-10 xl:aspect-[18.2/10] [mask-image:linear-gradient(to_right,transparent_0%,black_7%,black_95%,transparent_100%),linear-gradient(to_bottom,transparent_0%,black_6%,black_94%,transparent_100%)] [mask-composite:intersect] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_7%,black_95%,transparent_100%),linear-gradient(to_bottom,transparent_0%,black_6%,black_94%,transparent_100%)] [-webkit-mask-composite:source-in] transition-transform duration-300 hover:scale-[1.01]">
              <div className="relative h-full w-full">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="h-full w-full scale-[1.05] object-contain object-center"
                >
                  <source src="/intelleum-hero-demo.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,214,247,0.07),transparent_35%),linear-gradient(180deg,rgba(8,11,15,0.02),rgba(8,11,15,0.22))]" />
                <div className="absolute bottom-4 right-4 border border-border/70 bg-background/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors group-hover:text-primary">
                  Click To Expand
                </div>
              </div>
            </div>
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
