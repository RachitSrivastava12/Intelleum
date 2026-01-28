
import { loadCsv } from "../loaders/loadCsv";

export function detectSandwiches() {
  const adj = loadCsv<any>("data/adjacency.csv");

  const bySlot: Record<string, any[]> = {};
  for (const r of adj) {
    bySlot[r.slot] ??= [];
    bySlot[r.slot].push(r);
  }

  const out = [];

  for (const slot in bySlot) {
    const txs = bySlot[slot];

    for (let i = 0; i < txs.length - 2; i++) {
      const a = txs[i];
      const b = txs[i + 1];
      const c = txs[i + 2];

      if (
        a.signer_before === c.signer_after &&
        a.signer_before !== b.signer_before
      ) {
        out.push({
          slot,
          attacker: a.signer_before,
          victim: b.signer_before,
          frontrun_tx: a.tx_before,
          victim_tx: b.tx_before,
          backrun_tx: c.tx_after
        });
      }
    }
  }

  return out;
}

