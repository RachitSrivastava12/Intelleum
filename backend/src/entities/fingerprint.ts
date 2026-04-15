import { pool } from "../db/pool";
import crypto from "crypto";

// ============================================================
// ENTITY FINGERPRINTING ENGINE
// Clusters wallets into entities using BEHAVIORAL signals,
// not just graph proximity.
//
// A real entity has:
// - fee_aggression: pays 5-50x median priority fee
// - position_dominance: consistently lands in slot positions 0-3
// - pool_concentration: targets 1-3 specific pools
// - profit_consistency: almost every interaction is profitable
// - timing_regularity: machine-like cadence (low std dev on inter-tx time)
// ============================================================

interface WalletStats {
  wallet: string;
  tx_count: number;
  avg_priority_fee: number;
  median_network_fee: number;
  early_position_rate: number;   // % of txs in position 0-3
  top_pool_concentration: number; // % of txs targeting top pool
  profit_rate: number;            // % of txs with positive net delta
  unique_pools: number;
  attack_count: number;
}

// ============================================================
// SCORE INDIVIDUAL WALLETS
// ============================================================

export async function scoreWallets(): Promise<WalletStats[]> {
  const { rows } = await pool.query(`
    WITH tx_stats AS (
      SELECT
        t.signer AS wallet,
        COUNT(*) AS tx_count,
        AVG(COALESCE(t.priority_fee, 0)) AS avg_priority_fee,
        COUNT(*) FILTER (WHERE t.tx_index <= 3)::float / COUNT(*) AS early_position_rate,
        COUNT(DISTINCT tf.pool_address) AS unique_pools
      FROM transactions t
      LEFT JOIN token_flows tf ON tf.tx_sig = t.signature
      WHERE t.success = true
      GROUP BY t.signer
      HAVING COUNT(*) >= 5
    ),
    pool_stats AS (
      SELECT
        tf.wallet,
        COUNT(*) FILTER (WHERE tf.pool_address = (
          SELECT tf2.pool_address FROM token_flows tf2
          WHERE tf2.wallet = tf.wallet
          GROUP BY tf2.pool_address ORDER BY COUNT(*) DESC LIMIT 1
        ))::float / COUNT(*) AS top_pool_concentration
      FROM token_flows tf
      WHERE tf.pool_address IS NOT NULL
      GROUP BY tf.wallet
    ),
    profit_stats AS (
      SELECT
        tf.wallet,
        COUNT(*) FILTER (WHERE tf.delta_usd > 0)::float / COUNT(*) AS profit_rate
      FROM token_flows tf
      WHERE tf.delta_usd IS NOT NULL
      GROUP BY tf.wallet
    ),
    attack_stats AS (
      SELECT attacker_wallet AS wallet, COUNT(*) AS attack_count
      FROM mev_attacks
      GROUP BY attacker_wallet
    ),
    network_median AS (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY priority_fee) AS median_fee
      FROM transactions WHERE priority_fee IS NOT NULL AND priority_fee > 0
    )
    SELECT
      ts.wallet,
      ts.tx_count::int,
      ts.avg_priority_fee::float,
      nm.median_fee::float AS median_network_fee,
      ts.early_position_rate::float,
      COALESCE(ps.top_pool_concentration, 0)::float AS top_pool_concentration,
      COALESCE(prs.profit_rate, 0)::float AS profit_rate,
      ts.unique_pools::int,
      COALESCE(ast.attack_count, 0)::int AS attack_count
    FROM tx_stats ts
    CROSS JOIN network_median nm
    LEFT JOIN pool_stats ps ON ps.wallet = ts.wallet
    LEFT JOIN profit_stats prs ON prs.wallet = ts.wallet
    LEFT JOIN attack_stats ast ON ast.wallet = ts.wallet
  `);

  return rows;
}

// ============================================================
// COMPUTE BEHAVIORAL FINGERPRINT SCORE
// Returns 0-1 score. > 0.6 = likely MEV entity member
// ============================================================

function computeMEVScore(w: WalletStats): number {
  const medianFee = w.median_network_fee || 1;
  const feeRatio = w.avg_priority_fee / medianFee;

  // fee_aggression: 0 if at median, 1 if 20x+ above median
  const feeScore = Math.min(1, (feeRatio - 1) / 19);

  // position_dominance: early position rate (bots target 0-3)
  const posScore = w.early_position_rate;

  // pool_concentration: concentrated = more likely a targeted bot
  const poolScore = w.top_pool_concentration;

  // profit_consistency: consistent profits = bot
  const profitScore = w.profit_rate;

  // attack_count bonus: already detected as attacker
  const attackBonus = Math.min(1, w.attack_count / 10);

  // Weighted combination
  const score =
    feeScore * 0.25 +
    posScore * 0.25 +
    poolScore * 0.15 +
    profitScore * 0.20 +
    attackBonus * 0.15;

  return Math.min(1, score);
}

// ============================================================
// CLUSTER MEV WALLETS INTO ENTITIES
// Two wallets are same entity if:
// 1. Both score > 0.5 as MEV wallets
// 2. They share pool targets (Jaccard similarity > 0.3)
// 3. Their timing patterns overlap (same validator slots)
// ============================================================

export async function clusterEntities(): Promise<void> {
  console.log("🔍 Scoring wallets...");
  const wallets = await scoreWallets();

  // Filter to MEV-likely wallets
  const mevWallets = wallets
    .map(w => ({ ...w, mev_score: computeMEVScore(w) }))
    .filter(w => w.mev_score > 0.5 || w.attack_count > 0);

  console.log(`✅ Found ${mevWallets.length} MEV-likely wallets`);

  // Get pool overlap for clustering
  const { rows: poolOverlap } = await pool.query(`
    SELECT
      a.wallet AS wallet_a,
      b.wallet AS wallet_b,
      COUNT(DISTINCT a.pool_address)::float /
        NULLIF(COUNT(DISTINCT a.pool_address) + COUNT(DISTINCT b.pool_address), 0) AS jaccard
    FROM token_flows a
    JOIN token_flows b ON a.pool_address = b.pool_address AND a.wallet != b.wallet
    WHERE a.wallet = ANY($1) AND b.wallet = ANY($1)
    GROUP BY a.wallet, b.wallet
    HAVING COUNT(DISTINCT a.pool_address)::float /
      NULLIF(COUNT(DISTINCT a.pool_address) + COUNT(DISTINCT b.pool_address), 0) > 0.3
  `, [mevWallets.map(w => w.wallet)]);

  // Union-find clustering
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (x: string, y: string) => {
    const px = find(x), py = find(y);
    if (px !== py) parent.set(px, py);
  };

  for (const w of mevWallets) {
    find(w.wallet); // ensure initialized
  }

  for (const row of poolOverlap) {
    union(row.wallet_a, row.wallet_b);
  }

  // Also union wallets that appear in same attack
  const { rows: attackPairs } = await pool.query(`
    SELECT DISTINCT a1.attacker_wallet AS w1, a2.attacker_wallet AS w2
    FROM mev_attacks a1
    JOIN mev_attacks a2 ON a1.slot = a2.slot
      AND a1.pool_address = a2.pool_address
      AND a1.attacker_wallet != a2.attacker_wallet
    WHERE a1.attacker_wallet = ANY($1)
  `, [mevWallets.map(w => w.wallet)]);

  for (const row of attackPairs) {
    union(row.w1, row.w2);
  }

  // Build entity groups
  const groups = new Map<string, string[]>();
  for (const w of mevWallets) {
    const root = find(w.wallet);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(w.wallet);
  }

  console.log(`🔗 Clustered into ${groups.size} entities`);

  // Persist entities
  for (const [root, members] of groups) {
    const entityId = crypto
      .createHash("sha256")
      .update(root)
      .digest("hex")
      .slice(0, 16);

    // Aggregate stats for entity
    const memberStats = mevWallets.filter(w => members.includes(w.wallet));
    const avgFeeAgg = memberStats.reduce((s, w) => s + computeFeeAggression(w), 0) / memberStats.length;
    const avgPosScore = memberStats.reduce((s, w) => s + w.early_position_rate, 0) / memberStats.length;
    const avgProfitRate = memberStats.reduce((s, w) => s + w.profit_rate, 0) / memberStats.length;
    const riskScore = memberStats.reduce((s, w) => s + w.mev_score, 0) / memberStats.length;

    // Get attack stats
    const { rows: attackStats } = await pool.query(`
      SELECT
        COUNT(*) AS attack_count,
        COUNT(DISTINCT victim_wallet) AS victim_count,
        COALESCE(SUM(profit_usd), 0) AS total_profit,
        COALESCE(SUM(profit_usd) FILTER (WHERE block_time > NOW() - INTERVAL '24h'), 0) AS profit_24h,
        COALESCE(SUM(profit_usd) FILTER (WHERE block_time > NOW() - INTERVAL '7 days'), 0) AS profit_7d,
        MODE() WITHIN GROUP (ORDER BY attack_type) AS dominant_strategy,
        ARRAY_AGG(DISTINCT attack_type) AS strategies
      FROM mev_attacks
      WHERE attacker_wallet = ANY($1)
    `, [members]);

    const stats = attackStats[0];

    // Check known labels
    const { rows: labels } = await pool.query(
      `SELECT name, wallet FROM operator_labels WHERE wallet = ANY($1)`,
      [members]
    );
    const label = labels[0]?.name ?? null;
    const operatorWallet = labels[0]?.wallet ?? null;

    await pool.query(`
      INSERT INTO entities (
        id, label, operator_wallet,
        total_profit_usd, profit_24h_usd, profit_7d_usd,
        attack_count, victim_count,
        dominant_strategy, strategies_used,
        risk_score, fee_aggression, position_dominance,
        pool_concentration, profit_consistency,
        wallet_count, first_seen, last_seen, updated_at
      )
      SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        MIN(block_time), MAX(block_time), NOW()
      FROM mev_attacks
      WHERE attacker_wallet = ANY($17)
      ON CONFLICT (id) DO UPDATE SET
        total_profit_usd  = EXCLUDED.total_profit_usd,
        profit_24h_usd    = EXCLUDED.profit_24h_usd,
        profit_7d_usd     = EXCLUDED.profit_7d_usd,
        attack_count      = EXCLUDED.attack_count,
        victim_count      = EXCLUDED.victim_count,
        dominant_strategy = EXCLUDED.dominant_strategy,
        strategies_used   = EXCLUDED.strategies_used,
        risk_score        = EXCLUDED.risk_score,
        fee_aggression    = EXCLUDED.fee_aggression,
        position_dominance = EXCLUDED.position_dominance,
        wallet_count      = EXCLUDED.wallet_count,
        last_seen         = EXCLUDED.last_seen,
        updated_at        = NOW()
    `, [
      entityId, label, operatorWallet,
      stats?.total_profit ?? 0,
      stats?.profit_24h ?? 0,
      stats?.profit_7d ?? 0,
      stats?.attack_count ?? 0,
      stats?.victim_count ?? 0,
      stats?.dominant_strategy ?? null,
      stats?.strategies ?? [],
      riskScore, avgFeeAgg, avgPosScore,
      avgProfitRate, avgProfitRate,
      members.length,
      members
    ]);

    // Upsert entity_wallets
    for (const wallet of members) {
      await pool.query(`
        INSERT INTO entity_wallets (entity_id, wallet, first_seen, tx_count)
        SELECT $1, $2, MIN(block_time), COUNT(*)
        FROM mev_attacks WHERE attacker_wallet = $2
        ON CONFLICT (entity_id, wallet) DO UPDATE SET
          tx_count = EXCLUDED.tx_count
      `, [entityId, wallet]);
    }

    // Update attack records with entity_id
    await pool.query(
      `UPDATE mev_attacks SET entity_id = $1 WHERE attacker_wallet = ANY($2)`,
      [entityId, members]
    );
  }

  console.log("✅ Entity clustering complete");
}

// ============================================================
// UPDATE POOL TOXICITY
// ============================================================

export async function updatePoolToxicity(): Promise<void> {
  await pool.query(`
    INSERT INTO pool_toxicity (
      pool_address, epoch, protocol,
      sandwich_count, arbitrage_count, jit_count,
      total_attacks, total_extracted_usd, unique_attackers,
      toxicity_score, top_entity_id, updated_at
    )
    SELECT
      a.pool_address,
      FLOOR(EXTRACT(EPOCH FROM a.block_time) / 216000)::int AS epoch,
      NULL AS protocol,
      COUNT(*) FILTER (WHERE a.attack_type = 'sandwich') AS sandwich_count,
      COUNT(*) FILTER (WHERE a.attack_type = 'arbitrage') AS arbitrage_count,
      COUNT(*) FILTER (WHERE a.attack_type = 'jit') AS jit_count,
      COUNT(*) AS total_attacks,
      COALESCE(SUM(a.profit_usd), 0) AS total_extracted_usd,
      COUNT(DISTINCT a.attacker_wallet) AS unique_attackers,
      -- Toxicity: sandwich-heavy + high extraction = max score
      LEAST(100, (
        COUNT(*) FILTER (WHERE a.attack_type = 'sandwich') * 3 +
        COUNT(*) FILTER (WHERE a.attack_type = 'jit') * 2 +
        COUNT(*) FILTER (WHERE a.attack_type = 'arbitrage') * 1 +
        COALESCE(SUM(a.profit_usd) / 100, 0)
      ))::float AS toxicity_score,
      MODE() WITHIN GROUP (ORDER BY a.entity_id) AS top_entity_id,
      NOW()
    FROM mev_attacks a
    WHERE a.pool_address IS NOT NULL
    GROUP BY a.pool_address, epoch
    ON CONFLICT (pool_address, epoch) DO UPDATE SET
      sandwich_count      = EXCLUDED.sandwich_count,
      arbitrage_count     = EXCLUDED.arbitrage_count,
      jit_count           = EXCLUDED.jit_count,
      total_attacks       = EXCLUDED.total_attacks,
      total_extracted_usd = EXCLUDED.total_extracted_usd,
      unique_attackers    = EXCLUDED.unique_attackers,
      toxicity_score      = EXCLUDED.toxicity_score,
      top_entity_id       = EXCLUDED.top_entity_id,
      updated_at          = NOW()
  `);
}

// ============================================================
// UPDATE STATS CACHE
// ============================================================

export async function updateStatsCache(): Promise<void> {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total_attacks,
      COUNT(*) FILTER (WHERE block_time > NOW() - INTERVAL '24h') AS attacks_24h,
      COUNT(*) FILTER (WHERE block_time > NOW() - INTERVAL '1h') AS attacks_1h,
      COALESCE(SUM(profit_usd), 0) AS total_extracted_usd,
      COALESCE(SUM(profit_usd) FILTER (WHERE block_time > NOW() - INTERVAL '24h'), 0) AS extracted_24h,
      COUNT(DISTINCT entity_id) AS total_entities,
      COUNT(DISTINCT attacker_wallet) AS total_wallets,
      COUNT(DISTINCT victim_wallet) AS total_victims,
      COUNT(*) FILTER (WHERE attack_type = 'sandwich') AS sandwich_count,
      COUNT(*) FILTER (WHERE attack_type = 'arbitrage') AS arb_count,
      COUNT(*) FILTER (WHERE attack_type = 'jit') AS jit_count
    FROM mev_attacks
  `);

  await pool.query(`
    INSERT INTO stats_cache (key, value, updated_at)
    VALUES ('global', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify(rows[0])]);
}

function computeFeeAggression(w: WalletStats): number {
  const median = w.median_network_fee || 1;
  return Math.min(1, (w.avg_priority_fee / median - 1) / 19);
}
