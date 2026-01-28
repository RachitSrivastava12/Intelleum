export type EdgeScore = {
  shared: number;
  shape: number;
  slot: number;
  adjacency: number;
};

export const graph = new Map<string, Map<string, EdgeScore>>();

export function inc(a: string, b: string, k: keyof EdgeScore) {
  if (!graph.has(a)) graph.set(a, new Map());
  if (!graph.get(a)!.has(b)) {
    graph.get(a)!.set(b, { shared: 0, shape: 0, slot: 0, adjacency: 0 });
  }
  graph.get(a)!.get(b)![k]++;
}
