export function computeToxicScore(
  concentration: any[],
  adverse: any[],
  pools: any[],
  strategies: any[]
) {
  const score: Record<string, number> = {};

  for (const r of adverse) {
    score[r.entity_id] = (score[r.entity_id] ?? 0) + r.early_rate * 3;
  }

  for (const r of pools) {
    score[r.entity_id] = (score[r.entity_id] ?? 0) + Math.log(1 + r.interaction_count);
  }

  for (const r of strategies) {
    score[r.entity_id] = (score[r.entity_id] ?? 0) + 2;
  }

  return Object.entries(score)
    .map(([entity_id, toxic_score]) => ({ entity_id, toxic_score }))
    .sort((a, b) => b.toxic_score - a.toxic_score);
}
