import { graph } from "./buildGraph";

export function scoreEdges(threshold = 20) {
  const edges: [string, string][] = [];

  for (const [a, m] of graph.entries()) {
    for (const [b, s] of m.entries()) {
      const score =
        s.shared * 3 +
        s.shape * 5 +
        s.slot * 2 +
        s.adjacency * 10;

      if (score >= threshold) edges.push([a, b]);
    }
  }
  return edges;
}
