// import { detectSandwiches } from "./strategies/sandwich";
// import { detectBackruns } from "./strategies/backrun";
// import { detectAtomicArb } from "./strategies/atomicArb";
// import { detectLiquidationSniping } from "./strategies/liquidation";
// import { detectPGA } from "./strategies/pga";
// import { writeCsv } from "./export/writeCsv";

// console.log("🔥 STEP 4 — STRATEGY DETECTION");

// writeCsv("data/step4/sandwiches.csv", detectSandwiches());
// async function run() {await detectBackruns();   }
// run();
// writeCsv("data/step4/atomic_arbitrage.csv", detectAtomicArb());
// writeCsv("data/step4/liquidation_sniping.csv", detectLiquidationSniping());
// writeCsv("data/step4/pga_entities.csv", detectPGA());

// console.log("✅ STEP 4 COMPLETE");


import { detectSandwiches } from "./strategies/sandwich";
import { detectBackruns } from "./strategies/backrun";
import { detectAtomicArb } from "./strategies/atomicArb";
import { detectLiquidationSniping } from "./strategies/liquidation";
import { detectPGA } from "./strategies/pga";
import { writeCsv } from "./export/writeCsv";

async function run() {
  console.log("🔥 STEP 4 — STRATEGY DETECTION");

  writeCsv("data/step4/atomic_arbitrage.csv", detectAtomicArb());
  writeCsv("data/step4/liquidation_sniping.csv", detectLiquidationSniping());
  writeCsv("data/step4/pga_entities.csv", detectPGA());

  await detectBackruns();                 // 🔥 awaited
  writeCsv("data/step4/sandwiches.csv", detectSandwiches());

  console.log("✅ STEP 4 COMPLETE");
}

run().catch(console.error);
