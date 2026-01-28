import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ValidatorPanel from "./ValidatorPanel"
/* ----------------------------- CSV Loader ----------------------------- */
async function loadCsv<T = any>(path: string): Promise<T[]> {
  const res = await fetch(`/data/${path}`);
  const text = await res.text();
  const [header, ...rows] = text.trim().split("\n");
  const keys = header.split(",");
  return rows.map(r => {
    const vals = r.split(",");
    const obj: any = {};
    keys.forEach((k, i) => (obj[k] = vals[i]));
    return obj as T;
  });
}

/* ----------------------------- Helpers ----------------------------- */
function safePercent(x: any) {
  const n = Number(x);
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}

function riskLabel(r: number) {
  if (r >= 70) return "HIGH";
  if (r >= 35) return "MEDIUM";
  return "LOW";
}

/* ============================= COMPONENT ============================= */

export default function ForensicWindow() {
  const [entities, setEntities] = useState<any[]>([]);
  const [allEntities, setAllEntities] = useState<any[]>([]);
  const [showAllEntities, setShowAllEntities] = useState(false);

  const [validators, setValidators] = useState<any[]>([]);
  const [openValidator, setOpenValidator] = useState<string | null>(null);

  const [atomic, setAtomic] = useState<any[]>([]);
  const [pga, setPga] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const entityFeatures = await loadCsv<any>("entity_features.csv");
      const risks = await loadCsv<any>("ml_entity_risk_scores.csv");
      const validatorTx = await loadCsv<any>("step6/validator_tx_mev_rate.csv");
      const atomicCsv = await loadCsv<any>("step4/atomic_arbitrage.csv");
      const pgaCsv = await loadCsv<any>("step4/pga_entities.csv");

      setAtomic(atomicCsv);
      setPga(pgaCsv);

      /* ---------- Merge entity + risk ---------- */
      const merged = entityFeatures.map((e: any, i: number) => {
        const r = risks.find((x: any) => x.entity_id === e.entity_id);
        const rawRisk = r ? Number(r.risk_score) : 0;
        const signalCount =
  (Number(e.wallet_count) > 0 ? 1 : 0) +
  (Number(e.slot_count) > 0 ? 1 : 0) +
  (Number(e.atomic_arb_count) > 0 ? 1 : 0) +
  (Number(e.pga_slot_count) > 0 ? 1 : 0) +
  (Number(e.toxic_pool_interactions) > 0 ? 1 : 0) +
  (Number(e.shape_entropy) > 0 ? 1 : 0);

        return {
  ...e,
  displayId: `Entity #${i + 1}`,
  wallet_count: Number(e.wallet_count),
  slot_count: Number(e.slot_count),
  execution_shape_count: Number(e.execution_shape_count),
  shape_entropy: Number(e.shape_entropy),
  atomic_arb_count: Number(e.atomic_arb_count),
  pga_slot_count: Number(e.pga_slot_count),
  toxic_pool_interactions: Number(e.toxic_pool_interactions),
  avg_top_entity_share: Number(e.avg_top_entity_share),
  risk: Math.round(((rawRisk + 1) / 2) * 100),
  signalCount, // ✅ NEW
};

      });

     const meaningful = merged
  .filter(e => {
    // 1️⃣ Minimum coordinated size
    if (e.wallet_count < 3) return false;

    // 2️⃣ Signal breadth
    if (e.signalCount < 3) return false;

    // 3️⃣ Count real MEV behavior dimensions
    let behaviorSignals = 0;

    if (e.atomic_arb_count > 0) behaviorSignals++;
    if (e.pga_slot_count > 0) behaviorSignals++;
    if (e.toxic_pool_interactions > 0) behaviorSignals++;
    if (e.execution_shape_count > 1) behaviorSignals++;
    if (e.shape_entropy > 0.01) behaviorSignals++;

    // 🔥 Require mixture, not single-axis
    if (behaviorSignals < 2) return false;

    return true;
  })
  .sort((a, b) => {
    if (b.signalCount !== a.signalCount) {
      return b.signalCount - a.signalCount;
    }
    return b.risk - a.risk;
  });





      setAllEntities(meaningful);
      setEntities(meaningful.slice(0, 12));

      /* ---------- Validators ---------- */
      setValidators(
        validatorTx.map((v: any) => ({
          validator: v.validator,
          mevRate: safePercent(v.mev_tx_ratio),
        }))
      );
    }

    load();
  }, []);

  const shownEntities = showAllEntities ? allEntities : entities;

  /* ============================= RENDER ============================= */

  return (
    <section className="relative py-20 px-6">
      <div className="max-w-6xl mx-auto space-y-16">

        {/* ===================== FORENSIC SCOPE ===================== */}
        <div className="intel-panel p-8 border-l-4 border-yellow-500">
          <h2 className="text-2xl font-semibold mb-4">
            What You Are Looking At (Important)
          </h2>

          <p className="text-lg leading-relaxed">
            This analysis covers <b>17 Solana slots (~6.8 seconds)</b>.
            In such a short window, execution is dominated by automated actors.
          </p>

          <p className="mt-4 text-base">
            <b>High MEV percentages (90%+)</b> are expected here.
            As slot coverage expands to minutes and hours, these ratios
            naturally stabilize and decrease.
          </p>

          <p className="mt-3 text-sm text-muted-foreground">
            We identify <b>MEV entities</b> (coordinated wallets),
            not malicious validators.
          </p>
        </div>

        {/* ===================== ENTITY FORENSICS ===================== */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">MEV Entities</h2>

          <div className="space-y-4">
            {shownEntities.map(e => (
              <motion.div key={e.displayId} className="intel-panel p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-mono text-lg">{e.displayId}</h3>

                  <span
                    className={`font-mono text-xs px-3 py-1 border cursor-help ${
                      riskLabel(e.risk) === "HIGH"
                        ? "border-red-500 text-red-400"
                        : riskLabel(e.risk) === "MEDIUM"
                        ? "border-yellow-500 text-yellow-400"
                        : "border-green-500 text-green-400"
                    }`}
                    title="Risk reflects coordination density, repetition, and market pressure — not intent."
                  >
                    {riskLabel(e.risk)} RISK
                  </span>
                </div>

                <div className="grid md:grid-cols-3 gap-3 text-sm font-mono">
                  <div>Wallets: {e.wallet_count}</div>
                  <div>Slots: {e.slot_count}/17</div>
                  <div>Atomic arb txs: {e.atomic_arb_count}</div>
                  <div>PGA slots: {e.pga_slot_count}</div>
                  <div>Toxic interactions: {e.toxic_pool_interactions}</div>
                  <div>
                    Execution entropy: {e.shape_entropy.toFixed(2)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => setShowAllEntities(!showAllEntities)}
            className="mt-6 font-mono text-sm text-primary hover:underline"
          >
            {showAllEntities ? "Show fewer entities" : "View all detected entities"}
          </button>
        </div>

        {/* ===================== STRATEGIES ===================== */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="intel-panel p-6">
            <h3 className="font-semibold mb-2">⚡ Atomic Arbitrage</h3>
            <p className="text-sm">
              Single-transaction profit extraction across venues.
            </p>
            <p className="mt-2 font-mono text-sm">
              Detected txs: <b>{atomic.length}</b>
            </p>
          </div>

          <div className="intel-panel p-6">
            <h3 className="font-semibold mb-2">⛽ Priority Gas Auctions</h3>
            <p className="text-sm">
              Competing MEV bots bidding for ordering priority.
            </p>
            <p className="mt-2 font-mono text-sm">
              Slots with PGA: <b>{new Set(pga.map(p => p.slot)).size}</b>
            </p>
          </div>
        </div>
        {/* ===================== STRATEGY EXPLANATION ===================== */}
        <div className="intel-panel p-6">
          <h2 className="text-xl font-semibold mb-3">Why no Sandwich / Backrun / Liquidation?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These strategies require victim flow, congestion, or oracle-triggered events.
            None occurred in this short slot window.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            With longer indexing windows, these patterns emerge naturally and
            are already supported by our pipeline.
          </p>
        </div>

          <ValidatorPanel />
            
      </div>
    </section>
  );
}
