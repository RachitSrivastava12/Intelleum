"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockSafe = getBlockSafe;
const connection_1 = require("./connection");
async function getBlockSafe(slot, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const block = await connection_1.connection.getBlock(slot, {
                maxSupportedTransactionVersion: 0,
                transactionDetails: "full",
                rewards: true,
            });
            return block;
        }
        catch (err) {
            console.error(`⚠️ getBlock failed for slot ${slot} (attempt ${attempt})`);
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
