import { Pool } from "pg";

export const pool = new Pool({
  connectionString: "postgresql://hhgyujgu_user:R15czxU4g48xpafF1Etw05jZu9YZTUVh@dpg-d5krj7ggjchc73bo03pg-a.virginia-postgres.render.com/hhgyujgu",
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
