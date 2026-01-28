import { pool } from "../../db/pool";

export async function validatorEntityLoyalty() {
  const { rows } = await pool.query(`
    SELECT
      leader_validator,
      mev_entity_id,
      slots_seen,
      RANK() OVER (
        PARTITION BY leader_validator
        ORDER BY slots_seen DESC
      ) AS entity_rank
    FROM (
      SELECT
        b.leader_validator,
        w.mev_entity_id,
        COUNT(DISTINCT b.slot) AS slots_seen
      FROM blocks b
      JOIN transactions t ON t.slot = b.slot
      JOIN wallets w ON w.address = t.signer
      WHERE w.mev_entity_id IS NOT NULL
      GROUP BY b.leader_validator, w.mev_entity_id
    ) s
  `);

  return rows;
}
