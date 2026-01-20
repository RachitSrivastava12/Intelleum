import { pool } from "../db/pool";

export async function ingestTransactions(block: any, slot: number) {
  for (let i = 0; i < block.transactions.length; i++) {
    const tx = block.transactions[i];
    const meta = tx.meta;
    if (!meta) continue;

    const signature = tx.transaction.signatures[0];
    const message: any = tx.transaction.message;

    const accountKeys =
      "staticAccountKeys" in message
        ? message.staticAccountKeys
        : message.accountKeys;

    if (!accountKeys?.length) continue;

    const signer = accountKeys[0].toBase58();

    await pool.query(
      `
      INSERT INTO transactions
        (signature, slot, tx_index, fee_lamports, tx_compute_units, success, signer)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT DO NOTHING
      `,
      [
        signature,
        slot,
        i, // 🔥 execution order (MEV critical)
        meta.fee,
        meta.computeUnitsConsumed ?? null,
        meta.err === null,
        signer,
      ]
    );

    await pool.query(
      `
      INSERT INTO wallets (address, first_seen_slot, last_seen_slot)
      VALUES ($1,$2,$2)
      ON CONFLICT (address)
      DO UPDATE SET last_seen_slot = EXCLUDED.last_seen_slot
      `,
      [signer, slot]
    );
  }
}
