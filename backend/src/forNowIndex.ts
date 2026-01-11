import express from "express";
import cors from "cors";
import { pool } from "./db/pool";
import { Request, Response } from "express";
const app = express();
const PORT = 8081;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure table exists
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS intelleum_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      organization TEXT NOT NULL,
      use_case TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ intelleum_users table ready");
}

// Route: submit access request
app.post("/access/request", async (req: Request, res: Response) => {
  try {
    const { name, email, organization, useCase, message } = req.body;

    if (!name || !email || !organization || !useCase) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await pool.query(
      `
      INSERT INTO intelleum_users
        (name, email, organization, use_case, message)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [name, email, organization, useCase, message || null]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Access request failed", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 INTELLEUM backend running on port ${PORT}`);
  });
});
