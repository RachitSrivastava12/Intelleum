import "dotenv/config";
import { connection } from "./connection";
import { ingestBlock } from "./ingestBlocks";
import { ingestTransactions } from "./ingestTransactions";
import { ingestInstructions } from "./ingestInstructions";
import { getBlockSafe } from "./getBlockSafe";
import { backfillLeaders } from "./leaderMap";

async function run() {
  // console.log("🚀 Indexer started");

  // const latestSlot = await connection.getSlot();
  // const WINDOW = 1500;


  // const FROM_SLOT = latestSlot - WINDOW;
  // const TO_SLOT = latestSlot - 1;

  // console.log(`📦 Indexing slots ${FROM_SLOT} → ${TO_SLOT}`);

  // for (let slot = FROM_SLOT; slot <= TO_SLOT; slot++) {
  //   const block = await getBlockSafe(slot);
  //   if (!block) continue;

  //   await ingestBlock(block, slot);
  //   await ingestTransactions(block, slot);
  //   await ingestInstructions(block);
//}     
await backfillLeaders(394777126,394777139);

  console.log("backfilling finished ");
}

run().catch(console.error);
