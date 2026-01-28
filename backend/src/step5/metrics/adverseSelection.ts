import { loadCsv } from "../loaders/loadCsv";

export function computeAdverseSelection() {
  const slots = loadCsv<any>("data/slot_participation.csv");
  const entities = loadCsv<any>("data/mev_entities.csv");

  const walletToEntity = new Map(
    entities.map(e => [e.wallet, e.entity_id])
  );

  const stats: Record<string, { early: number; total: number }> = {};

  for (const r of slots) {
    const entity = walletToEntity.get(r.wallet);
    if (!entity) continue;

    stats[entity] ??= { early: 0, total: 0 };
    stats[entity].total++;
    if (Number(r.tx_index) < 5) stats[entity].early++;
  }

  return Object.entries(stats).map(([entity, s]) => ({
    entity_id: entity,
    early_rate: s.early / s.total,
    total_txs: s.total
  }));
}
