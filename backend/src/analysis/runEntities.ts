import "dotenv/config";
import { buildMevEntities } from "./buildEntities";

async function run() {
  await buildMevEntities();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Entity build failed", err);
  process.exit(1);
});
