import { pool } from "../db/pool";

export async function ingestInstructions(block: any) {
  for (const tx of block.transactions) {
    const meta = tx.meta;
    if (!meta) continue;

    const signature = tx.transaction.signatures[0];
    const message: any = tx.transaction.message;

    const isV0 = "compiledInstructions" in message;
    const instructions = isV0
      ? message.compiledInstructions
      : message.instructions;

    const accountKeys = isV0
      ? message.staticAccountKeys
      : message.accountKeys;

    if (!instructions || !accountKeys) continue;

    // 🔹 outer instructions
    for (let idx = 0; idx < instructions.length; idx++) {
      const ix = instructions[idx];
      const programId = accountKeys[ix.programIdIndex]?.toBase58();
      if (!programId) continue;

      const accountIndexes = isV0 ? ix.accountKeyIndexes : ix.accounts;

      const accounts = accountIndexes
        ?.map((i: number) => accountKeys[i])
        .filter(Boolean)
        .map((k: any) => k.toBase58());

      if (!accounts?.length) continue;

      await pool.query(
        `
        INSERT INTO instructions
          (tx_signature, instruction_index, program_id, accounts, is_inner)
        VALUES ($1,$2,$3,$4,false)
        ON CONFLICT DO NOTHING
        `,
        [signature, idx, programId, accounts]
      );
    }

    // 🔹 inner instructions (VERY IMPORTANT)
    for (const inner of meta.innerInstructions ?? []) {
      for (let j = 0; j < inner.instructions.length; j++) {
        const ix = inner.instructions[j];
        const programId = accountKeys[ix.programIdIndex]?.toBase58();
        if (!programId) continue;

        const accounts = ix.accounts
          ?.map((i: number) => accountKeys[i])
          .filter(Boolean)
          .map((k: any) => k.toBase58());

        if (!accounts?.length) continue;

        await pool.query(
          `
          INSERT INTO instructions
            (tx_signature, instruction_index, program_id, accounts, is_inner)
          VALUES ($1,$2,$3,$4,true)
          ON CONFLICT DO NOTHING
          `,
          [signature, inner.index * 1000 + j, programId, accounts]
        );
      }
    }
  }
}
