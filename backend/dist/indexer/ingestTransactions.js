"use strict";
// import { connection } from "./connection";
// import { pool } from "../db/pool";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestTransactions = ingestTransactions;
// export async function ingestTransactions(slot: number) {
//   console.log(`🧾 Processing transactions for slot ${slot}`);
//   const block = await connection.getBlock(slot, {
//     maxSupportedTransactionVersion: 0,
//   });
//   if (!block) return;
//   for (const tx of block.transactions) {
//     const meta = tx.meta;
//     if (!meta) continue;
//     const signature = tx.transaction.signatures[0];
//     // SAFE for legacy + v0
//     const message: any = tx.transaction.message;
//     const accountKeys =
//       "staticAccountKeys" in message
//         ? message.staticAccountKeys
//         : message.accountKeys;
//     if (!accountKeys || accountKeys.length === 0) continue;
//     const signer = accountKeys[0].toBase58();
//     try {
//       // ---- TRANSACTION ----
//       await pool.query(
//         `
//         INSERT INTO transactions
//           (signature, slot, fee_lamports, priority_fee, success, signer)
//         VALUES ($1, $2, $3, $4, $5, $6)
//         ON CONFLICT (signature) DO NOTHING
//         `,
//         [
//           signature,
//           slot,
//           meta.fee,
//           meta.computeUnitsConsumed ?? null,
//           meta.err === null,
//           signer,
//         ]
//       );
//       // ---- WALLET TRACKING ----
//       await pool.query(
//         `
//         INSERT INTO wallets (address, first_seen_slot, last_seen_slot)
//         VALUES ($1, $2, $2)
//         ON CONFLICT (address)
//         DO UPDATE SET last_seen_slot = EXCLUDED.last_seen_slot
//         `,
//         [signer, slot]
//       );
//     } catch (err) {
//       console.error(
//         `❌ Failed tx ${signature} in slot ${slot}`,
//         err
//       );
//     }
//   }
// }
const pool_1 = require("../db/pool");
async function ingestTransactions(block, slot) {
    console.log(`🧾 Ingesting transactions for slot ${slot}`);
    for (const tx of block.transactions) {
        const meta = tx.meta;
        if (!meta)
            continue;
        const signature = tx.transaction.signatures[0];
        const message = tx.transaction.message;
        const accountKeys = "staticAccountKeys" in message
            ? message.staticAccountKeys
            : message.accountKeys;
        if (!accountKeys?.length)
            continue;
        const signer = accountKeys[0].toBase58();
        try {
            await pool_1.pool.query(`
        INSERT INTO transactions
          (signature, slot, fee_lamports, priority_fee, success, signer)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (signature) DO NOTHING
        `, [
                signature,
                slot,
                meta.fee,
                meta.computeUnitsConsumed ?? null,
                meta.err === null,
                signer,
            ]);
            await pool_1.pool.query(`
        INSERT INTO wallets (address, first_seen_slot, last_seen_slot)
        VALUES ($1, $2, $2)
        ON CONFLICT (address)
        DO UPDATE SET last_seen_slot = EXCLUDED.last_seen_slot
        `, [signer, slot]);
        }
        catch (err) {
            console.error(`❌ Tx insert failed ${signature}`, err);
        }
    }
}
