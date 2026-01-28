CREATE OR REPLACE VIEW backrun_candidates AS
SELECT
  slot,
  tx_before AS victim_tx,
  signer_before AS victim,
  tx_after AS mev_tx,
  signer_after AS mev_signer
FROM tx_adjacency
WHERE signer_before <> signer_after;
