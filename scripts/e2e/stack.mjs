// Boots the whole platform on spare ports against a throwaway database, for the end-to-end scenario.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const DATABASE = process.env.E2E_DATABASE ?? "betng_e2e";
const PG = { host: "localhost", port: process.env.POSTGRES_PORT ?? "55432" };
const BASE_PORT = Number(process.env.E2E_BASE_PORT ?? 4600);

export const SERVICES = [
  { name: "identity", kind: "ts", dir: "apps/services/identity", offset: 10 },
  { name: "wallet", kind: "ts", dir: "apps/services/wallet", offset: 3 },
  { name: "event", kind: "ts", dir: "apps/services/event", offset: 8 },
  { name: "simulation", kind: "py", dir: "services/simulation", offset: 5 },
  { name: "odds", kind: "py", dir: "services/odds", offset: 6 },
  { name: "risk", kind: "py", dir: "services/risk", offset: 7 },
  { name: "analytics", kind: "py", dir: "services/analytics", offset: 9 },
  { name: "betting", kind: "ts", dir: "apps/services/betting", offset: 2 },
  { name: "settlement", kind: "ts", dir: "apps/services/settlement", offset: 4 },
  { name: "match", kind: "ts", dir: "apps/services/match", offset: 1 },
  { name: "gateway", kind: "ts", dir: "apps/gateway", offset: 0 },
];

const PRISMA_SERVICES = ["match", "betting", "wallet", "settlement", "identity"];
const PYTHON_SCHEMAS = ["simulation", "odds", "risk", "analytics"];

export const port = (name) => BASE_PORT + SERVICES.find((s) => s.name === name).offset;
export const url = (name) => `http://127.0.0.1:${port(name)}`;

function databaseUrl(service, prisma) {
  const base = `postgresql://betng_${service}:betng_${service}_local@${PG.host}:${PG.port}/${DATABASE}`;

  return prisma ? `${base}?schema=${service}` : base;
}

export function stackEnv(overrides = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "test",
    LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? "info",
    HOST: "127.0.0.1",
    REDIS_URL: process.env.E2E_REDIS_URL ?? "redis://localhost:56379/3",
    INTERNAL_SERVICE_TOKEN: "e2e-internal-service-token-0123456789",
    SIMULATION_SEED_SECRET: "e2e-simulation-seed-secret-0123456789abcdef",
    DEV_VERIFICATION_CODE: "246810",
    SEED_DEMO_DATA: "true",
    CORS_ORIGINS: "http://localhost:4200",
    LOGIN_RATE_LIMIT: "1000",
    SERVICE_TIMEOUT_MS: "8000",
    MATCH_SECONDS_PER_MINUTE: "0.05",
    MATCH_HALF_TIME_SECONDS: "1",
    BETTING_CLOSE_LEAD_SECONDS: "2",
    ROUND_CYCLE_SECONDS: "3600",
    UPCOMING_ROUNDS: "1",
    ...overrides,
  };

  for (const service of SERVICES) {
    const key = service.name.toUpperCase();

    env[`${key}_PORT`] = String(port(service.name));
    env[`${key}_SERVICE_URL`] = url(service.name);
  }

  for (const service of PRISMA_SERVICES) env[`${service.toUpperCase()}_DATABASE_URL`] = databaseUrl(service, true);
  for (const service of PYTHON_SCHEMAS) env[`${service.toUpperCase()}_DATABASE_URL`] = databaseUrl(service, false);

  return env;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }

  return result.stdout;
}

export function psql(sql, database = DATABASE) {
  return run("psql", ["-h", PG.host, "-p", PG.port, "-U", "betng", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atc", sql], {
    env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD ?? "betng_local_dev" },
  }).trim();
}

export function resetDatabase() {
  if (DATABASE === "betng") throw new Error("Refusing to drop the development database.");

  psql(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`, "postgres");
  migrateDatabase();
  run("redis-cli", ["-u", stackEnv().REDIS_URL, "FLUSHDB"]);
}

export function migrateDatabase() {
  run("bash", [resolve(ROOT, "scripts/db-bootstrap.sh"), DATABASE]);

  const env = { ...process.env, ...stackEnv() };

  for (const service of PRISMA_SERVICES) {
    const cwd = resolve(ROOT, "apps/services", service);

    run(resolve(cwd, "node_modules/.bin/prisma"), ["migrate", "deploy"], { cwd, env });
  }
}

async function waitReady(name, deadlineMs) {
  const deadline = Date.now() + deadlineMs;

  for (;;) {
    try {
      const response = await fetch(`${url(name)}/ready`, { signal: AbortSignal.timeout(2000) });

      if (response.ok) return;
    } catch {
      /* not listening yet */
    }

    if (Date.now() > deadline) throw new Error(`${name} did not become ready. See logs in ${LOG_DIR}.`);

    await new Promise((r) => setTimeout(r, 400));
  }
}

const LOG_DIR = resolve(ROOT, "scripts/e2e/.logs");

export async function startStack(overrides = {}) {
  mkdirSync(LOG_DIR, { recursive: true });

  const env = stackEnv(overrides);
  const children = [];

  const stop = async () => {
    for (const child of children) child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1500));
    for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
  };

  try {
    for (const service of SERVICES) {
      const cwd = resolve(ROOT, service.dir);
      const [command, args] =
        service.kind === "ts"
          ? [resolve(cwd, "node_modules/.bin/tsx"), ["src/server.ts"]]
          : [resolve(cwd, ".venv/bin", `betng-${service.name}`), []];

      if (!existsSync(command)) throw new Error(`${service.name}: ${command} is missing.`);

      const log = createWriteStream(resolve(LOG_DIR, `${service.name}.log`));
      const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });

      child.stdout.pipe(log);
      child.stderr.pipe(log);
      children.push(child);

      await waitReady(service.name, 60_000);
    }
  } catch (error) {
    await stop();
    throw error;
  }

  return { env, stop, logs: LOG_DIR };
}
