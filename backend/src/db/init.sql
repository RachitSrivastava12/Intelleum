CREATE TABLE IF NOT EXISTS blocks (
  slot            BIGINT PRIMARY KEY,
  block_time      INTEGER,
  leader_validator TEXT NOT NULL,
  tx_count        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_leader_validator
  ON blocks (leader_validator);

CREATE TABLE IF NOT EXISTS transactions (
  signature     TEXT PRIMARY KEY,
  slot          BIGINT NOT NULL,
  fee_lamports  BIGINT NOT NULL,
  priority_fee  BIGINT,
  success       BOOLEAN NOT NULL,
  signer        TEXT NOT NULL,

  CONSTRAINT fk_transactions_block
    FOREIGN KEY (slot)
    REFERENCES blocks(slot)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_slot
  ON transactions (slot);

CREATE INDEX IF NOT EXISTS idx_transactions_signer
  ON transactions (signer);

CREATE TABLE IF NOT EXISTS instructions (
  id                BIGSERIAL PRIMARY KEY,
  tx_signature      TEXT NOT NULL,
  instruction_index INTEGER NOT NULL,
  program_id        TEXT NOT NULL,
  accounts          TEXT[] NOT NULL,
  compute_units     INTEGER,

  CONSTRAINT fk_instructions_transaction
    FOREIGN KEY (tx_signature)
    REFERENCES transactions(signature)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_instructions_program_id
  ON instructions (program_id);

CREATE INDEX IF NOT EXISTS idx_instructions_tx_signature
  ON instructions (tx_signature);

CREATE TABLE IF NOT EXISTS mev_entities (
  id                TEXT PRIMARY KEY,
  wallet_count      INTEGER NOT NULL,
  first_seen_slot   BIGINT NOT NULL,
  avg_latency_ms    DOUBLE PRECISION,
  fee_aggression    DOUBLE PRECISION,
  dominant_strategy TEXT
);

CREATE INDEX IF NOT EXISTS idx_mev_entities_dominant_strategy
  ON mev_entities (dominant_strategy);

CREATE TABLE IF NOT EXISTS wallets (
  address          TEXT PRIMARY KEY,
  first_seen_slot  BIGINT NOT NULL,
  last_seen_slot   BIGINT NOT NULL,
  mev_entity_id    TEXT,

  CONSTRAINT fk_wallets_mev_entity
    FOREIGN KEY (mev_entity_id)
    REFERENCES mev_entities(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wallets_mev_entity_id
  ON wallets (mev_entity_id);

CREATE TABLE IF NOT EXISTS strategies (
  id               TEXT PRIMARY KEY,
  trigger_type     TEXT NOT NULL,
  execution_shape  TEXT NOT NULL,
  atomicity        TEXT NOT NULL,
  avg_profit       DOUBLE PRECISION,
  success_rate     DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_strategies_trigger_type
  ON strategies (trigger_type);

CREATE TABLE IF NOT EXISTS pools (
  address        TEXT PRIMARY KEY,
  protocol       TEXT NOT NULL,
  token_a        TEXT NOT NULL,
  token_b        TEXT NOT NULL,
  liquidity_usd  DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_pools_protocol
  ON pools (protocol);

CREATE TABLE IF NOT EXISTS entity_pool_stats (
  id              BIGSERIAL PRIMARY KEY,
  entity_id       TEXT NOT NULL,
  pool_address    TEXT NOT NULL,
  executions      INTEGER NOT NULL,
  profit_usd      DOUBLE PRECISION NOT NULL,
  first_seen_slot BIGINT NOT NULL,
  last_seen_slot  BIGINT NOT NULL,

  CONSTRAINT fk_entity_pool_stats_entity
    FOREIGN KEY (entity_id)
    REFERENCES mev_entities(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_entity_pool_stats_pool
    FOREIGN KEY (pool_address)
    REFERENCES pools(address)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_pool_stats_entity
  ON entity_pool_stats (entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_pool_stats_pool
  ON entity_pool_stats (pool_address);

CREATE TABLE IF NOT EXISTS validators (
  identity          TEXT PRIMARY KEY,
  slots_led         INTEGER NOT NULL,
  mev_captured_usd  DOUBLE PRECISION,
  dominant_pools    TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_validators_slots_led
  ON validators (slots_led);
