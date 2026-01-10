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

    for (let idx = 0; idx < instructions.length; idx++) {
      const ix = instructions[idx];

      const programKey = accountKeys[ix.programIdIndex];
      if (!programKey) continue;

      const programId = programKey.toBase58();

      const accountIndexes = isV0
        ? ix.accountKeyIndexes
        : ix.accounts;

      if (!accountIndexes || accountIndexes.length === 0) continue;

      // 🔒 HARD GUARD — THIS FIXES THE CRASH
      const accounts = accountIndexes
        .map((i: number) => accountKeys[i])
        .filter(Boolean) // remove undefined
        .map((k: any) => k.toBase58());

      if (accounts.length === 0) continue;

      try {
        await pool.query(
          `
          INSERT INTO instructions
            (tx_signature, instruction_index, program_id, accounts, compute_units)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
          `,
          [
            signature,
            idx,
            programId,
            accounts,
            meta.computeUnitsConsumed ?? null,
          ]
        );
      } catch (err) {
        console.error(
          `❌ Instruction insert failed ${signature}[${idx}]`,
          err
        );
      }
    }
  }
}
