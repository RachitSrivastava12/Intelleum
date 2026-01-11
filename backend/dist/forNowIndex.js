"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pool_1 = require("./db/pool");
const app = (0, express_1.default)();
const PORT = 8081;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Ensure table exists
async function initDb() {
    await pool_1.pool.query(`
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
app.post("/access/request", async (req, res) => {
    try {
        const { name, email, organization, useCase, message } = req.body;
        if (!name || !email || !organization || !useCase) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        await pool_1.pool.query(`
      INSERT INTO intelleum_users
        (name, email, organization, use_case, message)
      VALUES ($1, $2, $3, $4, $5)
      `, [name, email, organization, useCase, message || null]);
        res.status(200).json({ success: true });
    }
    catch (err) {
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
