import "dotenv/config";
import crypto from "crypto";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

function shouldUseSsl(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const sslMode = url.searchParams.get("sslmode");

    if (sslMode === "disable") return false;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;

    return process.env.NODE_ENV === "production";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

const createdPool = connectionString
  ? new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

export const pool = createdPool as Pool;

let accessSchemaReady = false;
let apiKeySchemaReady = false;
let intelligenceSchemaReady = false;

function requirePool(): Pool {
  if (!createdPool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return createdPool;
}

export async function ensureAccessSchema(): Promise<void> {
  if (accessSchemaReady) return;

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

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export async function ensureApiKeySchema(): Promise<void> {
  if (apiKeySchemaReady) return;

  const db = requirePool();
  await db.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS api_clients (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_address  TEXT NOT NULL UNIQUE,
      name            TEXT,
      email           TEXT,
      organization    TEXT,
      use_case        TEXT,
      message         TEXT,
      api_key_hash    TEXT NOT NULL UNIQUE,
      api_key_prefix  TEXT NOT NULL,
      request_limit   INTEGER NOT NULL DEFAULT 5,
      request_count   INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',
      last_request_at TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_api_clients_api_key_hash
    ON api_clients (api_key_hash)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_api_clients_status
    ON api_clients (status)
  `);
  apiKeySchemaReady = true;
}

export async function initDb(): Promise<void> {
  if (!createdPool) return;
  await ensureAccessSchema();
  await ensureApiKeySchema();
}

export async function ensureIntelligenceSchema(): Promise<void> {
  if (intelligenceSchemaReady || !createdPool) return;

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
