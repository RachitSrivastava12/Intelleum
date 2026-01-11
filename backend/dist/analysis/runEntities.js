"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const buildEntities_1 = require("./buildEntities");
async function run() {
    await (0, buildEntities_1.buildMevEntities)();
    process.exit(0);
}
run().catch((err) => {
    console.error("❌ Entity build failed", err);
    process.exit(1);
});
