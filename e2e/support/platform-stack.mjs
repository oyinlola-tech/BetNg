// The platform the browser suites run against: every service from source on a throwaway database, seeded with the identity demo accounts.
// Started by e2e/support/global-setup.ts; run it by hand to keep one stack across `playwright test` runs.

import { writeFileSync, rmSync } from "node:fs";
import { resetDatabase, startStack, url } from "../../scripts/e2e/stack.mjs";

const statePath = process.env.E2E_STATE_FILE;

if (statePath === undefined) throw new Error("E2E_STATE_FILE is not set.");

const origins = [4200, 4300, 4400, 4500].flatMap((port) => [`http://127.0.0.1:${String(port)}`, `http://localhost:${String(port)}`]).join(",");
const totpSecret = process.env.E2E_ADMIN_TOTP_SECRET;

if (totpSecret === undefined || !/^[A-Z2-7]{32}$/.test(totpSecret)) throw new Error("E2E_ADMIN_TOTP_SECRET must be 32 base32 characters.");

rmSync(statePath, { force: true });
resetDatabase();

const stack = await startStack({
  NODE_ENV: "test",
  SEED_DEMO_DATA: "true",
  SEED_ADMIN_TOTP_SECRET: totpSecret,
  DEV_VERIFICATION_CODE: "246810",
  MATCH_SECONDS_PER_MINUTE: "2",
  MATCH_HALF_TIME_SECONDS: "15",
  BETTING_CLOSE_LEAD_SECONDS: "10",
  ROUND_CYCLE_SECONDS: "240",
  UPCOMING_ROUNDS: "2",
  CORS_ORIGINS: origins,
  LOGIN_RATE_LIMIT: "1000",
  GATEWAY_RATE_GLOBAL: "100000/60",
  GATEWAY_RATE_BETS: "1000/60",
  GATEWAY_RATE_HEALTH: "1000/60",
});

writeFileSync(statePath, JSON.stringify({ gateway: url("gateway"), live: `${url("event").replace("http", "ws")}/live`, totpSecret, pid: process.pid }), { mode: 0o600 });
console.log(`Platform up. Gateway ${url("gateway")}  logs ${stack.logs}`);

const stop = async () => {
  rmSync(statePath, { force: true });
  await stack.stop();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
