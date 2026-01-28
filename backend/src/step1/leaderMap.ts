// src/indexer/leaderMap.ts
import { connection } from "./connection";
import { pool } from "../db/pool";

export async function backfillLeaders(from: number, to: number) {
  const leaders = await connection.getSlotLeaders(from, to - from + 1);

  for (let i = 0; i < leaders.length; i++) {
    const slot = from + i;

    // 🔥 THIS IS THE FIX
    const leaderPubkey = leaders[i].toBase58();

    console.log(`Slot ${slot} → ${leaderPubkey}`);

    await pool.query(
      `
      UPDATE blocks
      SET leader_validator = $1
      WHERE slot = $2
      `,
      [leaderPubkey, slot]
    );
  }

  console.log("✅ Leader mapping complete");
}
