"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clusterEntities = clusterEntities;
const pool_1 = require("../db/pool");
const crypto_1 = require("crypto");
async function clusterEntities() {
    console.log("🧩 Clustering MEV entities");
    const res = await pool_1.pool.query(`
    SELECT wallet_a, wallet_b
    FROM entity_edges
  `);
    // Build adjacency list
    const graph = new Map();
    for (const { wallet_a, wallet_b } of res.rows) {
        if (!graph.has(wallet_a))
            graph.set(wallet_a, new Set());
        if (!graph.has(wallet_b))
            graph.set(wallet_b, new Set());
        graph.get(wallet_a).add(wallet_b);
        graph.get(wallet_b).add(wallet_a);
    }
    const visited = new Set();
    for (const wallet of graph.keys()) {
        if (visited.has(wallet))
            continue;
        // DFS to find connected component
        const stack = [wallet];
        const component = [];
        while (stack.length) {
            const w = stack.pop();
            if (visited.has(w))
                continue;
            visited.add(w);
            component.push(w);
            for (const n of graph.get(w) ?? []) {
                if (!visited.has(n))
                    stack.push(n);
            }
        }
        // Ignore tiny noise
        if (component.length < 2)
            continue;
        const entityId = (0, crypto_1.randomUUID)();
        await pool_1.pool.query(`
      INSERT INTO mev_entities (id, wallet_count, first_seen_slot)
      VALUES ($1, $2, 0)
      `, [entityId, component.length]);
        await pool_1.pool.query(`
      UPDATE wallets
      SET mev_entity_id = $1
      WHERE address = ANY($2)
      `, [entityId, component]);
    }
    console.log("✅ Entity clustering complete");
}
