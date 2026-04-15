import "dotenv/config";

console.log(
  "INTELLEUM worker is currently disabled. Live dashboard endpoints use the in-process demo/live provider, and Postgres is reserved for access-request submissions.",
);

setInterval(() => {
  console.log("Worker idle: no background indexing configured in this mode.");
}, 60_000);
