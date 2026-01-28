
import { loadCsv } from "../loaders/loadCsv";
import { writeCsv } from "../export/writeCsv";

type AdjacencyRow = {
  slot: string;
  tx_before: string;
  tx_after: string;
  signer_before: string;
  signer_after: string;
};

type WalletAccountRow = {
  wallet: string;
  account: string;
};

type EntityRow = {
  wallet: string;
  entity_id: string;
};


export async function detectBackruns() {
  console.log("🔍 Detecting backrun candidates...");

  const adjacency = loadCsv<AdjacencyRow>("data/adjacency.csv");
  const walletAccounts = loadCsv<WalletAccountRow>("data/wallet_accounts.csv");
  const entities = loadCsv<EntityRow>("data/mev_entities.csv");

  const accountMap = new Map<string, Set<string>>();
  for (const r of walletAccounts) {
    if (!accountMap.has(r.wallet)) accountMap.set(r.wallet, new Set());
    accountMap.get(r.wallet)!.add(r.account);
  }

  const entityMap = new Map<string, string>();
  for (const e of entities) entityMap.set(e.wallet, e.entity_id);

  const results = [];

  for (const row of adjacency) {
    const a = row.signer_before;
    const b = row.signer_after;
    if (a === b) continue;

    const A = accountMap.get(a);
    const B = accountMap.get(b);
    if (!A || !B) continue;

    let shared = 0;
    for (const acc of A) if (B.has(acc)) shared++;

    if (shared >= 3) {   // 🔥 LOWERED threshold (important)
      results.push({
        slot: row.slot,
        victim_wallet: a,
        backrunner_wallet: b,
        victim_entity: entityMap.get(a) ?? null,
        backrunner_entity: entityMap.get(b) ?? null,
        shared_accounts: shared,
      });
    }
  }

  writeCsv("data/step4/backruns.csv", results);
  console.log(`✅ Backruns detected: ${results.length}`);
}
