import fs from "fs";
import { db } from "../db";

export async function extractSlotParticipation() {
  const res = await db.query(`SELECT signer AS wallet, slot FROM transactions`);
  const out = ["wallet,slot"];
  for (const r of res.rows) out.push(`${r.wallet},${r.slot}`);
  fs.writeFileSync("data/slot_participation.csv", out.join("\n"));
}
