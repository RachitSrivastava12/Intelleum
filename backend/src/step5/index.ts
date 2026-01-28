import { writeCsv } from "./export/writeCsv";
import { computeEntityConcentration } from "./metrics/entityConcentration";
import { computeAdverseSelection } from "./metrics/adverseSelection";
import { computePoolToxicity } from "./metrics/poolToxicity";
import { computeToxicScore } from "./metrics/toxicScore";
import { loadCsv } from "./loaders/loadCsv";

console.log("🔥 STEP 5 — MARKET TOXICITY");

const concentration = computeEntityConcentration();
writeCsv("data/step5/entity_concentration.csv", concentration);

const adverse = computeAdverseSelection();
writeCsv("data/step5/adverse_selection.csv", adverse);

const pools = computePoolToxicity();
writeCsv("data/step5/pool_toxicity.csv", pools);

const strategies = loadCsv<any>("data/step4/atomic_arbitrage.csv");

const toxic = computeToxicScore(concentration, adverse, pools, strategies);
writeCsv("data/step5/toxic_entities.csv", toxic);

console.log("✅ STEP 5 COMPLETE");
