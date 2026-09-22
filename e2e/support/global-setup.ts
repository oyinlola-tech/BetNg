import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PLATFORM, ROOT, readStackState } from "./platform";

const BOOT_TIMEOUT_MS = 600_000;

async function ready(): Promise<boolean> {
  try {
    const response = await fetch(`${PLATFORM.gateway}/ready`, { signal: AbortSignal.timeout(2_000) });

    return response.ok;
  } catch {
    return false;
  }
}

/** Matches the scheduler has created whose markets the odds service has not published yet, or undefined while the list cannot be read. */
async function unpublished(): Promise<number | undefined> {
  try {
    const response = await fetch(`${PLATFORM.gateway}/api/v1/matches?limit=500`, { signal: AbortSignal.timeout(5_000) });

    if (!response.ok) return undefined;

    const { items } = (await response.json()) as { items?: { lifecycle?: string }[] };

    return items === undefined || items.length === 0 ? undefined : items.filter((match) => match.lifecycle === "FIXTURE_CREATED").length;
  } catch {
    return undefined;
  }
}

/* The first rounds are priced one match at a time; the suites need every league's next rounds open for betting. */
async function marketsOpen(): Promise<boolean> {
  const backlog = await unpublished();

  return backlog !== undefined && backlog <= 10;
}

function base32Secret(): string {
  const bits = [...randomBytes(20)].map((byte) => byte.toString(2).padStart(8, "0")).join("");

  return (bits.match(/.{5}/g) ?? []).map((chunk) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[parseInt(chunk, 2)]).join("");
}

async function until(label: string, probe: () => Promise<boolean>, child?: ChildProcess): Promise<void> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;

  while (!(await probe())) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`The platform stack exited (${String(child.exitCode)}). See scripts/e2e/.logs.`);
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}.`);

    await new Promise((r) => setTimeout(r, 1_000));
  }
}

/** Starts the platform stack, or reuses one already serving on the same ports, and waits until its upcoming rounds are open for betting. */
export default async function globalSetup(): Promise<() => Promise<void>> {
  process.env["E2E_STATE_FILE"] = PLATFORM.stateFile;

  if ((await ready()) && readStackState() !== undefined) {
    await until("published markets", marketsOpen);

    return async () => undefined;
  }

  mkdirSync(dirname(PLATFORM.stateFile), { recursive: true });
  rmSync(`${PLATFORM.stateFile}.totp-step`, { force: true });

  const log = createWriteStream(resolve(dirname(PLATFORM.stateFile), "ui-stack.log"));
  const child = spawn(process.execPath, [resolve(ROOT, "e2e/support/platform-stack.mjs")], {
    cwd: ROOT,
    env: {
      ...process.env,
      E2E_DATABASE: PLATFORM.database,
      E2E_BASE_PORT: String(PLATFORM.basePort),
      E2E_REDIS_URL: PLATFORM.redisUrl,
      E2E_STATE_FILE: PLATFORM.stateFile,
      E2E_ADMIN_TOTP_SECRET: base32Secret(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.pipe(log);
  child.stderr?.pipe(log);

  const stop = async (): Promise<void> => {
    if (child.exitCode !== null) return;

    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
  };

  try {
    await until("the platform stack", async () => (await ready()) && readStackState() !== undefined, child);
    await until("published markets", marketsOpen, child);
  } catch (error) {
    await stop();
    throw error;
  }

  return stop;
}
