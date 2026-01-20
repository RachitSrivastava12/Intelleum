import { pool } from "../db/pool";
import { connection } from "./connection";

export async function ingestBlock(block: any, slot: number) {
  console.log(`🧱 Ingesting block ${slot}`);

  const leaders = await connection.getSlotLeaders(slot, 1);
  const leaderValidator = leaders?.[0] ?? "unknown";

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
}
