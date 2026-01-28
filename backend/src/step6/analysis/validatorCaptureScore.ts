import { pool } from "../../db/pool";

export async function validatorCaptureScore() {
  const { rows } = await pool.query(`
    SELECT
      r.leader_validator,
      r.mev_slot_ratio,
      e.early_ratio,
      COUNT(DISTINCT a.mev_entity_id) AS unique_entities
    FROM (
      SELECT
        b.leader_validator,
        COUNT(DISTINCT t.slot)::float /
        COUNT(DISTINCT b.slot) AS mev_slot_ratio
      FROM blocks b
      LEFT JOIN transactions t ON t.slot = b.slot
      LEFT JOIN wallets w ON w.address = t.signer
        AND w.mev_entity_id IS NOT NULL
      GROUP BY b.leader_validator
    ) r
    JOIN (
      SELECT
        b.leader_validator,
        COUNT(*) FILTER (WHERE t.tx_index < 5)::float /
        COUNT(*) AS early_ratio
      FROM blocks b
      JOIN transactions t ON t.slot = b.slot
      JOIN wallets w ON w.address = t.signer
      WHERE w.mev_entity_id IS NOT NULL
      GROUP BY b.leader_validator
    ) e USING (leader_validator)
    JOIN (
      SELECT
        b.leader_validator,
        w.mev_entity_id
      FROM blocks b
      JOIN transactions t ON t.slot = b.slot
      JOIN wallets w ON w.address = t.signer
      WHERE w.mev_entity_id IS NOT NULL
    ) a USING (leader_validator)
    GROUP BY r.leader_validator, r.mev_slot_ratio, e.early_ratio
  `);

  return rows;
}
