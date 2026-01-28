import fs from "fs";
import { connectDb } from "./db";
import {
  extractWalletAccounts } from "./extract/walletAccounts"
import { extractExecutionShapes } from "./extract/executionShapes"
import {extractSlotParticipation } from "./extract/slotParticipation"
import  { extractAdjacency} from "./extract/adjacency";

import { inc } from "./graph/buildGraph";
import { scoreEdges } from "./graph/scoreEdges";
import { buildEntities } from "./cluster/buildEntities";
import { exportAndInsert } from "./export/exportCsv";

function readCSV(path: string) {
  return fs.readFileSync(path, "utf8").split("\n").slice(1);
}

async function run() {
  await connectDb();

  await extractWalletAccounts();
  await extractExecutionShapes();
  await extractSlotParticipation();
  await extractAdjacency();

  // shared accounts
  const acc = readCSV("data/wallet_accounts.csv");
  const byAcc = new Map<string, string[]>();
  for (const l of acc) {
    const [w, a] = l.split(",");
    if (!byAcc.has(a)) byAcc.set(a, []);
    byAcc.get(a)!.push(w);
  }
  for (const ws of byAcc.values())
    for (let i = 0; i < ws.length; i++)
      for (let j = i + 1; j < ws.length; j++)
        inc(ws[i], ws[j], "shared");

  // adjacency
  for (const l of readCSV("data/adjacency.csv")) {
    const [a, b] = l.split(",");
    inc(a, b, "adjacency");
  }

  const edges = scoreEdges(20);
  const entities = buildEntities(edges);
  await exportAndInsert(entities);

  console.log("🔥 STEP 3 COMPLETE");
}

run().catch(console.error);
