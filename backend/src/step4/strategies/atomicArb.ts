import { loadCsv } from "../loaders/loadCsv";

export function detectAtomicArb() {
  const shapes = loadCsv<any>("data/execution_shapes.csv");

  return shapes
    .filter(s => s.shape.split("->").length >= 3)
    .map(s => ({
      wallet: s.wallet,
      shape: s.shape
    }));
}
