import { Client } from "pg";

export const db = new Client({
  connectionString: "postgresql://intell:intell@localhost:5432/intelleum",
});

export async function connectDb() {
  await db.connect();
  console.log("✅ Connected to Postgres");
}
