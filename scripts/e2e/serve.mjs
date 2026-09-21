// Runs the whole platform from source with the real match clock, until interrupted.
//   E2E_DATABASE=betng E2E_BASE_PORT=3100 node scripts/e2e/serve.mjs

import { migrateDatabase, startStack, url } from "./stack.mjs";

migrateDatabase();

const stack = await startStack({
  NODE_ENV: "development",
  LOG_VERIFICATION_CODES: "true",
  MATCH_SECONDS_PER_MINUTE: "2",
  MATCH_HALF_TIME_SECONDS: "15",
  BETTING_CLOSE_LEAD_SECONDS: "10",
  ROUND_CYCLE_SECONDS: "240",
  UPCOMING_ROUNDS: "3",
  CORS_ORIGINS: "http://localhost:4200,http://localhost:4300,http://localhost:4400,http://localhost:4500,http://localhost:8081",
  LOGIN_RATE_LIMIT: "30",
});

console.log(`Platform up. Gateway ${url("gateway")}  live ${url("event").replace("http", "ws")}/live  logs ${stack.logs}`);

const stop = async () => {
  await stack.stop();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
