import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { poolOptions } from "../src/clients/prisma.schema.js";
import { loadSecretFiles } from "../src/secrets/secretFiles.js";

const dirs: string[] = [];

function secret(value: string): string {
  const dir = mkdtempSync(join(tmpdir(), "betng-secret-"));

  dirs.push(dir);
  writeFileSync(join(dir, "s"), value);

  return join(dir, "s");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loadSecretFiles", () => {
  it("reads NAME from NAME_FILE without the trailing newline", () => {
    const env: Record<string, string | undefined> = { INTERNAL_SERVICE_TOKEN_FILE: secret("abc123\n") };

    expect(loadSecretFiles(env)).toEqual(["INTERNAL_SERVICE_TOKEN"]);
    expect(env["INTERNAL_SERVICE_TOKEN"]).toBe("abc123");
  });

  it("refuses both the value and the file", () => {
    expect(() => loadSecretFiles({ X: "inline", X_FILE: secret("file") })).toThrow(/Both X and X_FILE/);
  });

  it("refuses an empty file", () => {
    expect(() => loadSecretFiles({ X_FILE: secret("") })).toThrow(/empty/);
  });
});

describe("poolOptions", () => {
  it("defaults to ten connections and honours a bounded DB_POOL_MAX", () => {
    expect(poolOptions("postgres://x/db?schema=a", {}).max).toBe(10);
    expect(poolOptions("postgres://x/db?schema=a", { DB_POOL_MAX: "4" }).max).toBe(4);
    expect(poolOptions("postgres://x/db?schema=a", { DB_POOL_MAX: "5000" }).max).toBe(10);
  });
});
