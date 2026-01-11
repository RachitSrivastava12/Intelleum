"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const connection_1 = require("./connection");
const ingestBlocks_1 = require("./ingestBlocks");
const ingestTransactions_1 = require("./ingestTransactions");
const ingestInstructions_1 = require("./ingestInstructions");
const getBlockSafe_1 = require("./getBlockSafe");
async function run() {
    console.log("🚀 Indexer started");
    const latestSlot = await connection_1.connection.getSlot();
    const FROM_SLOT = latestSlot - 5;
    const TO_SLOT = latestSlot - 1;
    console.log(`📦 Indexing slots ${FROM_SLOT} → ${TO_SLOT}`);
    for (let slot = FROM_SLOT; slot <= TO_SLOT; slot++) {
        console.log(`\n🔹 Fetching block ${slot}`);
        // const block = await connection.getBlock(slot, {
        //   maxSupportedTransactionVersion: 0,
        // });
        const block = await (0, getBlockSafe_1.getBlockSafe)(slot);
        if (!block)
            continue;
        await (0, ingestBlocks_1.ingestBlock)(block, slot);
        await (0, ingestTransactions_1.ingestTransactions)(block, slot);
        await (0, ingestInstructions_1.ingestInstructions)(block);
    }
    console.log("✅ Indexing finished");
}
run().catch((e) => {
    console.error("❌ Indexer crashed", e);
});
