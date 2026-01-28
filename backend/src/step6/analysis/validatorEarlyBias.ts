import { pool } from "../../db/pool";

export async function validatorEarlyBias() {
  const { rows } = await pool.query(`
    SELECT
      b.leader_validator,
      COUNT(*) FILTER (WHERE t.tx_index < 5) AS early_mev_txs,
      COUNT(*)                              AS total_mev_txs,
      COUNT(*) FILTER (WHERE t.tx_index < 5)::float /
      COUNT(*)                              AS early_ratio
    FROM blocks b
    JOIN transactions t ON t.slot = b.slot
    JOIN wallets w ON w.address = t.signer
    WHERE w.mev_entity_id IS NOT NULL
    GROUP BY b.leader_validator
  `);

  return rows;
}
