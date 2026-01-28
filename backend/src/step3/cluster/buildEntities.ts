import { UnionFind } from "./unionFind";

export function buildEntities(edges: [string, string][]) {
  const uf = new UnionFind();

  for (const [a, b] of edges) uf.union(a, b);

  const out = new Map<string, string[]>();
  for (const w of uf.parent.keys()) {
    const r = uf.find(w);
    if (!out.has(r)) out.set(r, []);
    out.get(r)!.push(w);
  }
  return out;
}
