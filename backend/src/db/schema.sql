-- ============================================================
-- INTELLEUM V2 — PRODUCTION SCHEMA
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE: BLOCKS + TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS blocks (
  slot              BIGINT PRIMARY KEY,
  block_time        TIMESTAMPTZ NOT NULL,
  leader_validator  TEXT NOT NULL,
  tx_count          INTEGER NOT NULL,
  ingested_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blocks_time ON blocks (block_time DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_validator ON blocks (leader_validator);

CREATE TABLE IF NOT EXISTS transactions (
  signature         TEXT PRIMARY KEY,
  slot              BIGINT NOT NULL REFERENCES blocks(slot) ON DELETE CASCADE,
  tx_index          INTEGER NOT NULL,  -- position in block (MEV critical)
  signer            TEXT NOT NULL,
  fee_lamports      BIGINT NOT NULL,
  priority_fee      BIGINT,
  success           BOOLEAN NOT NULL,
  compute_units     INTEGER,
  block_time        TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_slot ON transactions (slot);
CREATE INDEX IF NOT EXISTS idx_tx_signer ON transactions (signer);
CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions (block_time DESC);

-- ============================================================
-- TOKEN FLOWS — the core signal everything is built on
-- Pre/post token balance deltas per transaction
-- ============================================================

CREATE TABLE IF NOT EXISTS token_flows (
  id            BIGSERIAL PRIMARY KEY,
  tx_sig        TEXT NOT NULL REFERENCES transactions(signature) ON DELETE CASCADE,
  slot          BIGINT NOT NULL,
  wallet        TEXT NOT NULL,
  mint          TEXT NOT NULL,
  delta_raw     BIGINT NOT NULL,   -- raw token units (positive = received)
  delta_usd     DOUBLE PRECISION,  -- USD value at time of tx
  pool_address  TEXT,              -- which AMM pool this flow is associated with
  program_id    TEXT               -- which DEX (Raydium, Orca, Meteora, Jupiter...)
);
CREATE INDEX IF NOT EXISTS idx_flows_wallet ON token_flows (wallet);
CREATE INDEX IF NOT EXISTS idx_flows_pool ON token_flows (pool_address);
CREATE INDEX IF NOT EXISTS idx_flows_slot ON token_flows (slot DESC);
CREATE INDEX IF NOT EXISTS idx_flows_mint ON token_flows (mint);

-- ============================================================
-- MEV ATTACKS — detected events
-- ============================================================

CREATE TABLE IF NOT EXISTS mev_attacks (
  id                BIGSERIAL PRIMARY KEY,
  attack_type       TEXT NOT NULL CHECK (attack_type IN ('sandwich','arbitrage','jit','liquidation','backrun')),
  slot              BIGINT NOT NULL,
  block_time        TIMESTAMPTZ NOT NULL,
  validator         TEXT NOT NULL,

  -- Attacker info
  attacker_wallet   TEXT NOT NULL,
  entity_id         TEXT,

  -- Victim info (null for arb/jit)
  victim_wallet     TEXT,
  victim_loss_usd   DOUBLE PRECISION,

  -- Target
  pool_address      TEXT NOT NULL,
  token_mint        TEXT,

  -- Economics
  profit_usd        DOUBLE PRECISION,
  tip_lamports      BIGINT,  -- Jito tip paid (shows sophistication)

  -- Transaction hashes
  frontrun_tx       TEXT,
  victim_tx         TEXT,
  backrun_tx        TEXT,

  -- Confidence
  confidence        DOUBLE PRECISION NOT NULL DEFAULT 0.8,

  detected_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attacks_time ON mev_attacks (block_time DESC);
CREATE INDEX IF NOT EXISTS idx_attacks_type ON mev_attacks (attack_type);
CREATE INDEX IF NOT EXISTS idx_attacks_entity ON mev_attacks (entity_id);
CREATE INDEX IF NOT EXISTS idx_attacks_pool ON mev_attacks (pool_address);
CREATE INDEX IF NOT EXISTS idx_attacks_attacker ON mev_attacks (attacker_wallet);
CREATE INDEX IF NOT EXISTS idx_attacks_validator ON mev_attacks (validator);

-- ============================================================
-- ENTITIES — the clustered MEV operators
-- ============================================================

CREATE TABLE IF NOT EXISTS entities (
  id                  TEXT PRIMARY KEY,  -- deterministic hash of seed wallet
  label               TEXT,              -- "B91 Sandwich Bot", null if unknown
  operator_wallet     TEXT,              -- profit sink / likely operator address
  first_seen          TIMESTAMPTZ,
  last_seen           TIMESTAMPTZ,

  -- Economics (updated on each new attack)
  total_profit_usd    DOUBLE PRECISION DEFAULT 0,
  profit_24h_usd      DOUBLE PRECISION DEFAULT 0,
  profit_7d_usd       DOUBLE PRECISION DEFAULT 0,
  attack_count        INTEGER DEFAULT 0,
  victim_count        INTEGER DEFAULT 0,

  -- Strategy
  dominant_strategy   TEXT,
  strategies_used     TEXT[],

  -- Behavioral fingerprint (0-1 normalized)
  risk_score          DOUBLE PRECISION DEFAULT 0,
  fee_aggression      DOUBLE PRECISION DEFAULT 0,  -- how much above median priority fee
  position_dominance  DOUBLE PRECISION DEFAULT 0,  -- % of txs in slot position 0-3
  pool_concentration  DOUBLE PRECISION DEFAULT 0,  -- concentration in top pools
  profit_consistency  DOUBLE PRECISION DEFAULT 0,  -- % of interactions that are profitable
  timing_regularity   DOUBLE PRECISION DEFAULT 0,  -- machine-like timing score

  wallet_count        INTEGER DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entities_risk ON entities (risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_entities_profit ON entities (total_profit_usd DESC);
CREATE INDEX IF NOT EXISTS idx_entities_strategy ON entities (dominant_strategy);

-- Entity → wallet membership
CREATE TABLE IF NOT EXISTS entity_wallets (
  entity_id     TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  wallet        TEXT NOT NULL,
  role          TEXT DEFAULT 'executor',  -- executor | fee_payer | profit_sink | tip_wallet
  first_seen    TIMESTAMPTZ,
  tx_count      INTEGER DEFAULT 0,
  PRIMARY KEY (entity_id, wallet)
);
CREATE INDEX IF NOT EXISTS idx_ew_wallet ON entity_wallets (wallet);

-- ============================================================
-- POOL TOXICITY
-- ============================================================

CREATE TABLE IF NOT EXISTS pool_toxicity (
  pool_address        TEXT NOT NULL,
  epoch               INTEGER NOT NULL,  -- Solana epoch (~2.5 days)
  protocol            TEXT,              -- raydium | orca | meteora | jupiter | unknown

  sandwich_count      INTEGER DEFAULT 0,
  arbitrage_count     INTEGER DEFAULT 0,
  jit_count           INTEGER DEFAULT 0,
  total_attacks       INTEGER DEFAULT 0,
  total_extracted_usd DOUBLE PRECISION DEFAULT 0,
  unique_attackers    INTEGER DEFAULT 0,

  -- Toxicity score 0-100
  toxicity_score      DOUBLE PRECISION DEFAULT 0,
  top_entity_id       TEXT,

  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_address, epoch)
);
CREATE INDEX IF NOT EXISTS idx_toxicity_score ON pool_toxicity (toxicity_score DESC);
CREATE INDEX IF NOT EXISTS idx_toxicity_epoch ON pool_toxicity (epoch DESC);

-- ============================================================
-- VALIDATORS
-- ============================================================

CREATE TABLE IF NOT EXISTS validator_stats (
  identity            TEXT NOT NULL,
  epoch               INTEGER NOT NULL,

  total_slots         INTEGER DEFAULT 0,
  mev_slots           INTEGER DEFAULT 0,
  mev_slot_ratio      DOUBLE PRECISION DEFAULT 0,

  early_mev_txs       INTEGER DEFAULT 0,  -- MEV txs in position 0-3
  total_mev_txs       INTEGER DEFAULT 0,
  early_position_bias DOUBLE PRECISION DEFAULT 0,

  total_jito_tips_sol DOUBLE PRECISION DEFAULT 0,
  unique_entities     INTEGER DEFAULT 0,

  -- Capture score 0-100
  capture_score       DOUBLE PRECISION DEFAULT 0,

  PRIMARY KEY (identity, epoch)
);

-- ============================================================
-- KNOWN OPERATORS / LABELS (community intel)
-- ============================================================

CREATE TABLE IF NOT EXISTS operator_labels (
  wallet      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  entity_id   TEXT,
  source      TEXT DEFAULT 'manual',  -- manual | libmev | community
  confidence  DOUBLE PRECISION DEFAULT 1.0,
  notes       TEXT,
  added_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed known labels
INSERT INTO operator_labels (wallet, name, source, confidence, notes) VALUES
  ('b91MkNr9Z7JQNDYUbMuA5vfP3FDtCBVxKh7vGPnP9bm', 'B91 Sandwich Bot', 'community', 0.95, 'Documented in multiple MEV research papers. Peak 4,925 attacks/day.'),
  ('ARBotXVjkWdx9jQ7xNfLJjP4G7Xsdf9kPNsVMFf3k5z', 'ARB-Alpha Cluster', 'community', 0.8, 'High-frequency arbitrage across Raydium/Orca pools.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ACCESS REQUESTS (waitlist — keep from v1)
-- ============================================================

CREATE TABLE IF NOT EXISTS access_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  organization  TEXT NOT NULL,
  use_case      TEXT NOT NULL,
  message       TEXT,
  approved      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LIVE STATS CACHE (updated by worker every 30s)
-- ============================================================

CREATE TABLE IF NOT EXISTS stats_cache (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
