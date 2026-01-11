"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
exports.pool = new pg_1.Pool({
    connectionString: "postgresql://suryansh:wgmAKHXNNOy3IRnRVAcamP4ZsrrcPsrZ@dpg-d4vf1hqli9vc73dnc1e0-a.virginia-postgres.render.com/data_2tye",
    ssl: {
        rejectUnauthorized: false, // REQUIRED for Render
    },
});
exports.pool.on("connect", () => {
    console.log("✅ Connected to Postgres");
});
exports.pool.on("error", (err) => {
    console.error("❌ Postgres pool error", err);
});
