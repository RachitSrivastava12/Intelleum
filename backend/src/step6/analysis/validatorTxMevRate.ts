import { pool } from "../../db/pool";

export async function validatorTxMevRate() {
  const { rows } = await pool.query(`
    SELECT
      b.leader_validator                         AS validator,
      COUNT(*)                                  AS total_txs,
      COUNT(*) FILTER (
        WHERE w.mev_entity_id IS NOT NULL
      )                                         AS mev_txs,
      ROUND(
        COUNT(*) FILTER (
          WHERE w.mev_entity_id IS NOT NULL
        )::numeric / COUNT(*),
        4
      )                                         AS mev_tx_ratio
    FROM blocks b
    JOIN transactions t
      ON t.slot = b.slot
    LEFT JOIN wallets w
      ON w.address = t.signer
    WHERE b.leader_validator IS NOT NULL
      AND b.leader_validator <> 'unknown'
    GROUP BY b.leader_validator
    ORDER BY mev_tx_ratio DESC;
  `);

  return rows;
}
