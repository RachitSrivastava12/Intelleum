"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.ensureAccessSchema = ensureAccessSchema;
exports.initDb = initDb;
exports.ensureIntelligenceSchema = ensureIntelligenceSchema;
require("dotenv/config");
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
function shouldUseSsl(databaseUrl) {
    try {
        const url = new URL(databaseUrl);
        const host = url.hostname;
        const sslMode = url.searchParams.get("sslmode");
        if (sslMode === "disable")
            return false;
        if (host === "localhost" || host === "127.0.0.1" || host === "::1")
            return false;
        return process.env.NODE_ENV === "production";
    }
    catch {
        return process.env.NODE_ENV === "production";
    }
}
const createdPool = connectionString
    ? new pg_1.Pool({
        connectionString,
        ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    })
    : null;
exports.pool = createdPool;
let accessSchemaReady = false;
let intelligenceSchemaReady = false;
function requirePool() {
    if (!createdPool) {
        throw new Error("DATABASE_URL is not configured");
    }
    return createdPool;
}
async function ensureAccessSchema() {
    if (accessSchemaReady)
        return;
    const db = requirePool();
    await db.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await db.query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      organization  TEXT NOT NULL,
      use_case      TEXT NOT NULL,
      message       TEXT,
      approved      BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    accessSchemaReady = true;
}
async function initDb() {
    if (!createdPool)
        return;
    await ensureAccessSchema();
}
async function ensureIntelligenceSchema() {
    if (intelligenceSchemaReady || !createdPool)
        return;
    const db = requirePool();
    await db.query(`
    CREATE TABLE IF NOT EXISTS detected_attacks (
      id                  BIGSERIAL PRIMARY KEY,
      attack_key          TEXT NOT NULL UNIQUE,
      attack_type         TEXT NOT NULL,
      slot                BIGINT NOT NULL,
      block_time          TIMESTAMPTZ NOT NULL,
      validator           TEXT NOT NULL,
      attacker_wallet     TEXT NOT NULL,
      entity_id           TEXT,
      entity_label        TEXT,
      entity_risk         DOUBLE PRECISION,
      victim_wallet       TEXT,
      victim_loss_usd     DOUBLE PRECISION,
      pool_address        TEXT NOT NULL,
      token_mint          TEXT,
      profit_usd          DOUBLE PRECISION,
      tip_lamports        BIGINT,
      confidence          DOUBLE PRECISION NOT NULL,
      detector            TEXT NOT NULL,
      evidence            JSONB NOT NULL DEFAULT '[]'::jsonb,
      frontrun_tx         TEXT,
      victim_tx           TEXT,
      backrun_tx          TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await db.query(`
    CREATE INDEX IF NOT EXISTS idx_detected_attacks_time
    ON detected_attacks (block_time DESC)
  `);
    await db.query(`
    CREATE INDEX IF NOT EXISTS idx_detected_attacks_type
    ON detected_attacks (attack_type)
  `);
    await db.query(`
    CREATE INDEX IF NOT EXISTS idx_detected_attacks_attacker
    ON detected_attacks (attacker_wallet)
  `);
    await db.query(`
    CREATE TABLE IF NOT EXISTS engine_snapshots (
      id                  BIGSERIAL PRIMARY KEY,
      mode                TEXT NOT NULL,
      last_processed_slot BIGINT,
      latest_chain_slot   BIGINT,
      blocks_processed    INTEGER NOT NULL DEFAULT 0,
      attacks_detected    INTEGER NOT NULL DEFAULT 0,
      parsed_transactions INTEGER NOT NULL DEFAULT 0,
      parsed_swaps        INTEGER NOT NULL DEFAULT 0,
      raw_slot_txs        INTEGER NOT NULL DEFAULT 0,
      sandwich_candidates INTEGER NOT NULL DEFAULT 0,
      arbitrage_candidates INTEGER NOT NULL DEFAULT 0,
      jit_candidates      INTEGER NOT NULL DEFAULT 0,
      liquidation_candidates INTEGER NOT NULL DEFAULT 0,
      suspicious_candidates INTEGER NOT NULL DEFAULT 0,
      last_error          TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await db.query(`
    ALTER TABLE engine_snapshots
    ADD COLUMN IF NOT EXISTS suspicious_candidates INTEGER NOT NULL DEFAULT 0
  `);
    await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engine_snapshots_created_at
    ON engine_snapshots (created_at DESC)
  `);
    intelligenceSchemaReady = true;
}
//# sourceMappingURL=pool.js.map