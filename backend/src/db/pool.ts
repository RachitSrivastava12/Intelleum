import { Pool } from "pg";

export const pool = new Pool({
  connectionString: "postgresql://intell:intell@localhost:5432/intelleum",
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
