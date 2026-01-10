import { pool } from "../db/pool";
import { randomUUID } from "crypto";

export async function buildMevEntities() {
  console.log("🧠 Building MEV entities");

  const res = await pool.query(`
    SELECT DISTINCT
      l.wallet_a,
      l.wallet_b
    FROM wallet_shape_links l
    JOIN wallet_shared_accounts a
      ON l.wallet_a = a.wallet_a
     AND l.wallet_b = a.wallet_b
  `);

  for (const row of res.rows) {
    const { wallet_a, wallet_b } = row;
    const entityId = randomUUID();

    await pool.query(
      `
      INSERT INTO mev_entities (id, wallet_count, first_seen_slot)
      VALUES ($1, 2, 0)
      ON CONFLICT DO NOTHING
      `,
      [entityId]
    );

    await pool.query(
      `
      UPDATE wallets
      SET mev_entity_id = $1
      WHERE address IN ($2, $3)
      `,
      [entityId, wallet_a, wallet_b]
    );
  }

  console.log("✅ MEV entity build complete");
}
