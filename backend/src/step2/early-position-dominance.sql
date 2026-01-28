SELECT
  signer,
  COUNT(*) AS early_txs
FROM ordered_txs
WHERE tx_index < 5
GROUP BY signer
ORDER BY early_txs DESC
LIMIT 20;
