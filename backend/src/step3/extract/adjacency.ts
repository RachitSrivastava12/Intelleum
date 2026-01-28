import fs from "fs";
import { db } from "../db";

export async function extractAdjacency() {
  const res = await db.query(`
    SELECT t1.signer AS a, t2.signer AS b
    FROM transactions t1
    JOIN transactions t2
      ON t1.slot = t2.slot
     AND t2.tx_index = t1.tx_index + 1
    WHERE t1.signer <> t2.signer
  `);

  const out = ["a,b"];
  for (const r of res.rows) out.push(`${r.a},${r.b}`);
  fs.writeFileSync("data/adjacency.csv", out.join("\n"));
}
