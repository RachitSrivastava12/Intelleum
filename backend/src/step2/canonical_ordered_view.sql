CREATE OR REPLACE VIEW ordered_txs AS
SELECT
  t.slot,
  t.tx_index,
  t.signature,
  t.signer,
  w.mev_entity_id
FROM transactions t
LEFT JOIN wallets w
  ON w.address = t.signer;
