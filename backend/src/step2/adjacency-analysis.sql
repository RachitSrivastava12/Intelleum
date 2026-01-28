CREATE OR REPLACE VIEW tx_adjacency AS
SELECT
  o1.slot,
  o1.signature AS tx_before,
  o2.signature AS tx_after,
  o1.signer AS signer_before,
  o2.signer AS signer_after,
  o2.tx_index
FROM ordered_txs o1
JOIN ordered_txs o2
  ON o1.slot = o2.slot
 AND o2.tx_index = o1.tx_index + 1;
