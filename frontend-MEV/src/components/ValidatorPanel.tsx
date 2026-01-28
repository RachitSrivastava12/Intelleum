import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ---------------- CSV loader ---------------- */
async function loadCsv<T = any>(path: string): Promise<T[]> {
  const res = await fetch(`/data/${path}`);
  const text = await res.text();
  const [header, ...rows] = text.trim().split("\n");
  const keys = header.split(",");
  return rows.map(r => {
    const vals = r.replace(/"/g, "").split(",");
    const obj: any = {};
    keys.forEach((k, i) => (obj[k] = vals[i]));
    return obj as T;
  });
}

/* ---------------- Types ---------------- */
type TxRate = {
  validator: string;
  total_txs: string;
  mev_txs: string;
  mev_tx_ratio: string;
};

type SlotRate = {
  leader_validator: string;
  total_slots: string;
  mev_slots: string;
  mev_slot_ratio: string;
};

type EarlyBias = {
  leader_validator: string;
  early_mev_txs: string;
  total_mev_txs: string;
  early_ratio: string;
};

type Loyalty = {
  leader_validator: string;
  mev_entity_id: string;
  slots_seen: string;
  entity_rank: string;
};

/* ================= COMPONENT ================= */

export default function ValidatorPanel() {
  const [validators, setValidators] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const txRate = await loadCsv<TxRate>("step6/validator_tx_mev_rate.csv");
      const slotRate = await loadCsv<SlotRate>("step6/validator_mev_rate.csv");
      const early = await loadCsv<EarlyBias>("step6/validator_early_bias.csv");
      const loyalty = await loadCsv<Loyalty>("step6/validator_entity_loyalty.csv");

      const merged = txRate.map(v => {
        const slot = slotRate.find(s => s.leader_validator === v.validator);
        const e = early.find(x => x.leader_validator === v.validator);
        const loyals = loyalty.filter(l => l.leader_validator === v.validator);

        return {
          validator: v.validator,
          totalTxs: Number(v.total_txs),
          mevTxs: Number(v.mev_txs),
          mevTxPct: Math.round(Number(v.mev_tx_ratio) * 100),

          totalSlots: slot ? Number(slot.total_slots) : 0,
          mevSlots: slot ? Number(slot.mev_slots) : 0,
          mevSlotPct: slot ? Math.round(Number(slot.mev_slot_ratio) * 100) : 0,

          earlyPct: e ? (Number(e.early_ratio) * 100).toFixed(2) : "0.00",

          loyalEntities: loyals.length,
          topEntitySlots: loyals.length
            ? Math.max(...loyals.map(l => Number(l.slots_seen)))
            : 0,
        };
      });

      setValidators(merged);
    }

    load();
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Validator-Level Forensics</h2>

      <p className="text-sm text-muted-foreground max-w-3xl">
        Validators are evaluated by how often MEV-linked entities appear in their
        blocks. High values here are expected in a <b>6.8s window</b> dominated by bots.
        These metrics normalize as the observation window grows.
      </p>

      <div className="space-y-4">
        {validators.map(v => (
          <motion.div key={v.validator} className="intel-panel p-4">
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setOpen(open === v.validator ? null : v.validator)}
            >
              <span className="font-mono text-xs truncate max-w-[65%]">
                {v.validator}
              </span>
              <span className="font-mono text-sm">
                MEV tx share: <b>{v.mevTxPct}%</b>
              </span>
            </div>

            <AnimatePresence>
              {open === v.validator && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 text-sm space-y-3"
                >
                  <div className="grid md:grid-cols-2 gap-3 font-mono text-xs">
                    <div>📦 Total txs: {v.totalTxs}</div>
                    <div>🤖 MEV txs: {v.mevTxs}</div>
                    <div>🧱 Leader slots: {v.totalSlots}</div>
                    <div>🔥 MEV slots: {v.mevSlots}</div>
                    <div>⏱ Early MEV tx %: {v.earlyPct}%</div>
                    <div>🔗 Repeated MEV entities: {v.loyalEntities}</div>
                  </div>

                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <b>Why MEV % is high:</b> In short windows, almost all traffic
                    comes from automated entities. This does <u>not</u> imply
                    validator misconduct. Over longer horizons, ratios normalize
                    as organic flow dominates.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
