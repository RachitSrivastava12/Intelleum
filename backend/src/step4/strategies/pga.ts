import { loadCsv } from "../loaders/loadCsv";

export function detectPGA() {
  const slots = loadCsv<any>("data/slot_participation.csv");
  const entities = loadCsv<any>("data/mev_entities.csv");

  const map = new Map(entities.map(e => [e.wallet, e.entity_id]));
  const seen = new Map<string, number>();

  for (const s of slots) {
    const entity = map.get(s.wallet);
    if (!entity) continue;

    const key = `${entity}-${s.slot}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  return [...seen.entries()]
    .filter(([_, count]) => count >= 3)
    .map(([key, count]) => {
      const [entity, slot] = key.split("-");
      return { entity_id: entity, slot, tx_count: count };
    });
}
