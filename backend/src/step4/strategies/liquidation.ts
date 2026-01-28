
import { loadCsv } from "../loaders/loadCsv";

const LENDING_PROGRAMS = [
  "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo", // Solend
  "Jet111111111111111111111111111111111111111" // Jet
];

export function detectLiquidationSniping() {
  const shapes = loadCsv("data/execution_shapes.csv");
  const slots = loadCsv("data/slot_participation.csv");

  const early = new Set(
    slots
      .filter(r => Number(r.tx_index) < 3)
      .map(r => r.signer)
  );

  return shapes
    .filter(r =>
      LENDING_PROGRAMS.some(p => r.shape.includes(p)) &&
      early.has(r.signer)
    )
    .map(r => ({
      signer: r.signer,
      shape: r.shape
    }));
}
