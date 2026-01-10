import { Pool } from "pg";

export const pool = new Pool({
  connectionString: "postgresql://suryansh:wgmAKHXNNOy3IRnRVAcamP4ZsrrcPsrZ@dpg-d4vf1hqli9vc73dnc1e0-a.virginia-postgres.render.com/data_2tye",
  ssl: {
    rejectUnauthorized: false, // REQUIRED for Render
  },
});

pool.on("connect", () => {
  console.log("✅ Connected to Postgres");
});

pool.on("error", (err) => {
  console.error("❌ Postgres pool error", err);
});
