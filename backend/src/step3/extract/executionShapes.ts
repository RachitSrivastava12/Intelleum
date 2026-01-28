import fs from "fs";
import { db } from "../db";

export async function extractExecutionShapes() {
  const res = await db.query(`
    SELECT
      t.signer AS wallet,
      string_agg(i.program_id, '->' ORDER BY i.instruction_index) AS shape
    FROM instructions i
    JOIN transactions t ON i.tx_signature = t.signature
    GROUP BY t.signer, t.signature
  `);

  const out = ["wallet,shape"];
  for (const r of res.rows) {
    out.push(`${r.wallet},"${r.shape}"`);
  }
  fs.writeFileSync("data/execution_shapes.csv", out.join("\n"));
}
