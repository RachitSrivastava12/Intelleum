"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const clusterEntities_1 = require("./clusterEntities");
(0, clusterEntities_1.clusterEntities)()
    .then(() => process.exit(0))
    .catch((e) => {
    console.error("❌ Clustering failed", e);
    process.exit(1);
});
