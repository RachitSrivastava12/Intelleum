import { pool } from "../../db/pool";

export async function validatorEntityActivity() {
  const { rows } = await pool.query(`
    SELECT
      b.leader_validator,
      w.mev_entity_id,
      COUNT(*)               AS tx_count,
      COUNT(DISTINCT b.slot) AS slots_seen,
      AVG(t.tx_index)        AS avg_tx_position
    FROM blocks b
    JOIN transactions t ON t.slot = b.slot
    JOIN wallets w ON w.address = t.signer
    WHERE w.mev_entity_id IS NOT NULL
    GROUP BY b.leader_validator, w.mev_entity_id
  `);

  return rows;
}
