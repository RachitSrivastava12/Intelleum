import { writeCsv } from "./export/writeCsv";

import { validatorEntityActivity } from "./analysis/validatorEntityActivity";
import { validatorMevRate } from "./analysis/validatorMevRate";
import { validatorEarlyBias } from "./analysis/validatorEarlyBias";
import { validatorEntityLoyalty } from "./analysis/validatorLoyalty";
import { validatorCaptureScore } from "./analysis/validatorCaptureScore";
import { validatorTxMevRate } from "./analysis/validatorTxMevRate";


async function run() {
  console.log("🔥 STEP 6 — VALIDATOR CAPTURE");

//   writeCsv(
//     "data/step6/validator_entity_activity.csv",
//     await validatorEntityActivity()
//   );

//   writeCsv(
//     "data/step6/validator_mev_rate.csv",
//     await validatorMevRate()
//   );

//   writeCsv(
//     "data/step6/validator_early_bias.csv",
//     await validatorEarlyBias()
//   );

//   writeCsv(
//     "data/step6/validator_entity_loyalty.csv",
//     await validatorEntityLoyalty()
//   );

//   writeCsv(
//     "data/step6/validator_capture_score.csv",
//     await validatorCaptureScore()
//   ); 

  writeCsv(
  "data/step6/validator_tx_mev_rate.csv",
  await validatorTxMevRate()
);

  console.log("✅ STEP 6 COMPLETE");
}

run().catch(console.error);
