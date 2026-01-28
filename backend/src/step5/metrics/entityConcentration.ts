import { loadCsv } from "../loaders/loadCsv";

export function computeEntityConcentration() {
  const slots = loadCsv<any>("data/slot_participation.csv");
  const entities = loadCsv<any>("data/mev_entities.csv");

  const walletToEntity = new Map(
    entities.map(e => [e.wallet, e.entity_id])
  );

  const slotMap: Record<string, Record<string, number>> = {};

  for (const r of slots) {
    const entity = walletToEntity.get(r.wallet) ?? "non_mev";
    slotMap[r.slot] ??= {};
    slotMap[r.slot][entity] = (slotMap[r.slot][entity] ?? 0) + 1;
  }

  const results = [];

  for (const slot in slotMap) {
    const counts = Object.values(slotMap[slot]);
    const total = counts.reduce((a, b) => a + b, 0);
    const max = Math.max(...counts);

    results.push({
      slot,
      total_tx: total,
      top_entity_share: max / total
    });
  }

  return results;
}
