import "dotenv/config";
import { clusterEntities } from "./clusterEntities";

clusterEntities()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Clustering failed", e);
    process.exit(1);
  });
