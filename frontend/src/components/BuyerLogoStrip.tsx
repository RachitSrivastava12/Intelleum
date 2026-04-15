import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const teams = [
  { name: "Jupiter", domain: "jup.ag", type: "aggregator" },
  { name: "Orca", domain: "orca.so", type: "dex" },
  { name: "Drift", domain: "drift.trade", type: "trading" },
  { name: "Kamino", domain: "manage.kamino.com", type: "protocol" },
  { name: "Helius", domain: "helius.dev", type: "infra" },
  { name: "Sanctum", domain: "sanctum.so", type: "staking infra" },
  { name: "Jito", domain: "jito.network", type: "validator infra" },
  { name: "Keyrock", domain: "keyrock.com", type: "market maker" },
];

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export default function BuyerLogoStrip() {
  return (
    <section className="relative overflow-hidden px-6 py-12">
      <div className="absolute inset-0 grid-overlay-subtle opacity-10" />
      <div className="relative mx-auto max-w-6xl">
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary">// relevant buyers</div>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Example target organizations that could benefit from toxic-flow reduction, route risk, and live execution intelligence.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          {teams.map((team, index) => (
            <Tooltip key={team.name}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.03 }}
                  className="group flex h-24 cursor-default flex-col items-center justify-center border border-border/70 bg-surface/40 px-4 text-center"
                >
                  <img
                    src={faviconUrl(team.domain)}
                    alt={team.name}
                    className="h-10 w-10 object-contain opacity-95 transition-opacity group-hover:opacity-100"
                    loading="lazy"
                  />
                  <div className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-foreground">
                    {team.name}
                  </div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {team.type}
                  </div>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">{team.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <p className="mt-5 text-center text-xs leading-6 text-muted-foreground">
          These are target buyer profiles, not claims of current commercial relationships.
        </p>

        <div className="mt-8 text-center">
          <Link
            to="/intel-api"
            className="inline-block px-10 py-4 bg-primary text-background font-mono font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors"
          >
            SEE API PRODUCTS →
          </Link>
        </div>
      </div>
    </section>
  );
}
