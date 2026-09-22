import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const BASE_PORT = Number(process.env["E2E_BASE_PORT"] ?? 3700);

export const PLATFORM = {
  basePort: BASE_PORT,
  database: process.env["E2E_DATABASE"] ?? "betng_e2e_ui",
  redisUrl: process.env["E2E_REDIS_URL"] ?? "redis://localhost:56379/5",
  gateway: `http://127.0.0.1:${String(BASE_PORT)}`,
  live: `ws://127.0.0.1:${String(BASE_PORT + 8)}/live`,
  stateFile: process.env["E2E_STATE_FILE"] ?? resolve(ROOT, "scripts/e2e/.logs/ui-stack.json"),
} as const;

export interface StackState {
  readonly gateway: string;
  readonly live: string;
  readonly totpSecret: string;
  readonly pid: number;
}

export function readStackState(): StackState | undefined {
  if (!existsSync(PLATFORM.stateFile)) return undefined;

  return JSON.parse(readFileSync(PLATFORM.stateFile, "utf8")) as StackState;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_MS = 30_000;

function hotp(secret: string, step: number): string {
  const bits = [...secret].map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0xf;

  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function withLock<T>(work: () => Promise<T>): Promise<T> {
  const lock = `${PLATFORM.stateFile}.lock`;

  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  try {
    return await work();
  } finally {
    rmdirSync(lock);
  }
}

/** The seeded super admin's next authenticator code. The platform accepts each 30-second step once, so parallel sign-ins take successive steps. */
export async function nextAdminCode(): Promise<string> {
  const state = readStackState();

  if (state === undefined) throw new Error(`No platform stack state at ${PLATFORM.stateFile}.`);

  const used = `${PLATFORM.stateFile}.totp-step`;

  return withLock(async () => {
    const last = existsSync(used) ? Number(readFileSync(used, "utf8")) : 0;
    const step = Math.max(Math.floor(Date.now() / STEP_MS), last + 1);

    while (Math.floor(Date.now() / STEP_MS) < step - 1) await new Promise((r) => setTimeout(r, 500));

    writeFileSync(used, String(step));

    return hotp(state.totpSecret, step);
  });
}
