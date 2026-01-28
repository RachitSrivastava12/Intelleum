SELECT
  t.signature,
  t.fee_lamports,
  t.tx_index
FROM transactions t
WHERE t.tx_index < 5
ORDER BY t.fee_lamports ASC
LIMIT 20;
