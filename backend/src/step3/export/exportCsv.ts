import fs from "fs";
import { db } from "../db";

export async function exportAndInsert(entities: Map<string, string[]>) {
  const csv = ["entity_id,wallet"];
  for (const [id, wallets] of entities.entries()) {
    for (const w of wallets) csv.push(`${id},${w}`);
  }
  fs.writeFileSync("data/mev_entities.csv", csv.join("\n"));

  await db.query("DELETE FROM mev_entities");
  await db.query("UPDATE wallets SET mev_entity_id = NULL");

  for (const [id, wallets] of entities.entries()) {
    await db.query(
      `INSERT INTO mev_entities (id, wallet_count, first_seen_slot)
       SELECT $1, $2, MIN(first_seen_slot)
       FROM wallets WHERE address = ANY($3)`,
      [id, wallets.length, wallets]
    );

    await db.query(
      `UPDATE wallets SET mev_entity_id = $1 WHERE address = ANY($2)`,
      [id, wallets]
    );
  }
}
