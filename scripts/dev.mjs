#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log("Usage: node scripts/dev.mjs [--ts-only | --py-only]");
  process.exit(0);
}

if (args.has("--ts-only") && args.has("--py-only")) {
  console.error("Choose one of --ts-only or --py-only.");
  process.exit(1);
}

const envFile = resolve(root, ".env");

if (existsSync(envFile)) process.loadEnvFile(envFile);
else console.warn("No .env at the repository root; services fall back to their defaults. Copy .env.example to .env.");

const TS_SERVICES = [
  ["gateway", "apps/gateway"],
  ["match", "apps/services/match"],
  ["betting", "apps/services/betting"],
  ["wallet", "apps/services/wallet"],
  ["settlement", "apps/services/settlement"],
  ["event", "apps/services/event"],
  ["identity", "apps/services/identity"],
];

const PY_SERVICES = ["simulation", "odds", "risk", "analytics"];

const COLORS = [36, 32, 33, 35, 34, 96, 92, 93, 95];
const tint = process.stdout.isTTY ? (code, text) => `\x1b[${String(code)}m${text}\x1b[0m` : (_code, text) => text;

const targets = [];

if (!args.has("--py-only")) {
  for (const [name, directory] of TS_SERVICES) {
    const cwd = resolve(root, directory);

    targets.push({ name, command: resolve(cwd, "node_modules/.bin/tsx"), argv: ["watch", "src/server.ts"], cwd });
  }
}

if (!args.has("--ts-only")) {
  for (const name of PY_SERVICES) {
    const cwd = resolve(root, "services", name);
    const bin = resolve(cwd, ".venv", "bin", `betng-${name}`);

    if (!existsSync(bin)) {
      console.warn(`Skipping ${name}: no virtual environment. Run "pnpm py:install" first.`);
      continue;
    }

    targets.push({ name, command: bin, argv: [], cwd });
  }
}

if (targets.length === 0) {
  console.error("Nothing to run.");
  process.exit(1);
}

const width = Math.max(...targets.map((t) => t.name.length));
const children = new Map();
let stopping = false;
let exitCode = 0;

function pipe(stream, label, sink) {
  let buffered = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    const lines = (buffered + chunk).split("\n");

    buffered = lines.pop() ?? "";
    for (const line of lines) sink.write(`${label} ${line}\n`);
  });
  stream.on("end", () => {
    if (buffered !== "") sink.write(`${label} ${buffered}\n`);
  });
}

// Each service runs in its own process group so a watcher's grandchildren stop with it.
function signalGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function stop(signal) {
  if (stopping) return;

  stopping = true;
  for (const child of children.values()) signalGroup(child, signal);

  // A service that ignores the signal must not keep the terminal hostage.
  setTimeout(() => {
    for (const child of children.values()) signalGroup(child, "SIGKILL");
  }, 5000).unref();
}

targets.forEach((target, index) => {
  const label = tint(COLORS[index % COLORS.length], `${target.name.padEnd(width)} |`);
  const child = spawn(target.command, target.argv, { cwd: target.cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"], detached: true });

  children.set(target.name, child);
  pipe(child.stdout, label, process.stdout);
  pipe(child.stderr, label, process.stderr);

  child.on("error", (error) => {
    process.stderr.write(`${label} failed to start: ${error.message}\n`);
  });

  child.on("exit", (code, signal) => {
    children.delete(target.name);

    if (!stopping) {
      process.stderr.write(`${label} exited (${signal ?? String(code)}); stopping the rest.\n`);
      exitCode = code ?? 1;
      stop("SIGTERM");
    }

    if (children.size === 0) process.exit(exitCode);
  });
});

process.on("SIGINT", () => {
  stop("SIGINT");
});
process.on("SIGTERM", () => {
  stop("SIGTERM");
});

console.log(`Running ${targets.map((t) => t.name).join(", ")}. Ctrl+C stops everything.`);
