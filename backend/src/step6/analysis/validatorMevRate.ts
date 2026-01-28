import { pool } from "../../db/pool";

export async function validatorMevRate() {
  const { rows } = await pool.query(`
    SELECT
      b.leader_validator,
      COUNT(DISTINCT b.slot)                         AS total_slots,
      COUNT(DISTINCT t.slot)                         AS mev_slots,
      COUNT(DISTINCT t.slot)::float /
      COUNT(DISTINCT b.slot)                         AS mev_slot_ratio
    FROM blocks b
    LEFT JOIN transactions t ON t.slot = b.slot
    LEFT JOIN wallets w ON w.address = t.signer
      AND w.mev_entity_id IS NOT NULL
    GROUP BY b.leader_validator
  `);

  return rows;
}
