import { loadCsv } from "../loaders/loadCsv";

export function computePoolToxicity() {
  const accounts = loadCsv<any>("data/wallet_accounts.csv");
  const entities = loadCsv<any>("data/mev_entities.csv");

  const walletToEntity = new Map(
    entities.map(e => [e.wallet, e.entity_id])
  );

  const map: Record<string, Record<string, number>> = {};

  for (const r of accounts) {
    const entity = walletToEntity.get(r.wallet);
    if (!entity) continue;

    map[entity] ??= {};
    map[entity][r.account] = (map[entity][r.account] ?? 0) + 1;
  }

  const out = [];
  for (const e in map) {
    for (const acc in map[e]) {
      out.push({
        entity_id: e,
        account: acc,
        interaction_count: map[e][acc]
      });
    }
  }

  return out;
}
