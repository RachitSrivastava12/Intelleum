import fs from "fs";
import { db } from "../db";

export async function extractWalletAccounts() {
  const res = await db.query(`
    SELECT t.signer AS wallet, unnest(i.accounts) AS account
    FROM instructions i
    JOIN transactions t ON i.tx_signature = t.signature
  `);

  const out = ["wallet,account"];
  for (const r of res.rows) out.push(`${r.wallet},${r.account}`);
  fs.writeFileSync("data/wallet_accounts.csv", out.join("\n"));
}
