// import { connection } from "./connection";
// import { pool } from "../db/pool";

// export async function ingestBlocks(fromSlot: number, toSlot: number) {
//   for (let slot = fromSlot; slot <= toSlot; slot++) {
//     try {
//       console.log(`🧱 Processing block ${slot}`);

//       const block = await connection.getBlock(slot, {
//         maxSupportedTransactionVersion: 0,
//       });
     
//       if (!block) continue;
//  console.log(`🧾 Processing ${block.transactions.length} txs`);
//       const leaderValidator =
//         block.rewards?.[0]?.pubkey ?? "unknown";

//       await pool.query(
//         `
//         INSERT INTO blocks (slot, block_time, leader_validator, tx_count)
//         VALUES ($1, $2, $3, $4)
//         ON CONFLICT (slot) DO NOTHING
//         `,
//         [
//           slot,
//           block.blockTime ?? null,
//           leaderValidator,
//           block.transactions.length,
//         ]
//       );

//       console.log(`✅ Block ${slot} inserted`);
//     } catch (err) {
//       console.error(`❌ Failed block ${slot}`, err);
//     }
//   }
// }

import { pool } from "../db/pool";

export async function ingestBlock(block: any, slot: number) {
  console.log(`🧱 Ingesting block ${slot}`);
  console.log(`🧾 ${block.transactions.length} txs in block`);

  const leaderValidator =
    block.rewards?.[0]?.pubkey ?? "unknown";

  await pool.query(
    `
    INSERT INTO blocks (slot, block_time, leader_validator, tx_count)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (slot) DO NOTHING
    `,
    [
      slot,
      block.blockTime ?? null,
      leaderValidator,
      block.transactions.length,
    ]
  );

  console.log(`✅ Block ${slot} stored`);
}
