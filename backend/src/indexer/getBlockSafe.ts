import { connection } from "./connection";

export async function getBlockSafe(slot: number, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const block = await connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: "full",
        rewards: true,
      });

      return block;
    } catch (err) {
      console.error(
        `⚠️ getBlock failed for slot ${slot} (attempt ${attempt})`
      );

      if (attempt === retries) {
        console.error(`❌ Skipping slot ${slot}`);
        return null;
      }

      // exponential-ish backoff
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  return null;
}
