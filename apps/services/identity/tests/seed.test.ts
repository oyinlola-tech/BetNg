import { randomUUID } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import { describe, expect, it } from "vitest";
import { loadIdentityConfig } from "../src/configs/index.js";
import type { IdentityRepositories, IdentityStore, PasswordHasher } from "../src/interfaces/index.js";
import { runDemoSeed } from "../src/seeds/index.js";
import { adminTotpContext } from "../src/services/index.js";
import { createDataProtector, decodeBase32, issueTemporarySecrets } from "../src/utils/index.js";
import { PRODUCTION_REQUIREMENTS } from "./harness.js";

const DATABASE = { IDENTITY_DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=identity" };
const silent = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined } as unknown as Logger;
const hasher = { hash: async (value: string) => `h:${value}`, verify: async () => false, verifyAgainstNothing: async () => undefined } as unknown as PasswordHasher;

interface Recorded {
  readonly admins: { id: string; email: string; totpSecret: string | undefined }[];
  readonly enrolled: Map<string, string>;
}

function recordingStore(): { store: IdentityStore; recorded: Recorded } {
  const recorded: Recorded = { admins: [], enrolled: new Map() };
  const repositories = {
    admins: {
      create: async (admin: { email: string; totpSecret: string | undefined }) => {
        const row = { id: randomUUID(), email: admin.email, totpSecret: admin.totpSecret };

        recorded.admins.push(row);

        return row;
      },
      enrolTotp: async (id: string, sealed: string) => {
        recorded.enrolled.set(id, sealed);

        return {};
      },
    },
    shops: { create: async () => ({ id: randomUUID() }) },
    cashiers: { create: async () => ({ id: randomUUID() }), setStatus: async () => ({}) },
    customers: { create: async () => ({ id: randomUUID() }) },
  } as unknown as IdentityRepositories;

  const store = {
    ...repositories,
    admins: { ...repositories.admins, count: async () => recorded.admins.length },
    transaction: async <T>(work: (tx: IdentityRepositories) => Promise<T>) => work(repositories),
  } as unknown as IdentityStore;

  return { store, recorded };
}

describe("demo seed", () => {
  it("seals a fresh random admin TOTP secret per database and prints the enrolment URI only in development", async () => {
    const config = await loadIdentityConfig({ ...DATABASE, NODE_ENV: "development", SEED_DEMO_DATA: "true" });
    const protector = createDataProtector(config.dataKey);
    const secrets: string[] = [];
    const printed: string[] = [];

    for (let run = 0; run < 2; run += 1) {
      const { store, recorded } = recordingStore();

      expect(await runDemoSeed({ config, store, hasher, protector, logger: silent, terminal: (text) => printed.push(text) })).toBe(true);

      const [id, sealed] = [...recorded.enrolled.entries()][0] ?? [];

      expect(recorded.admins.every((admin) => admin.totpSecret === undefined)).toBe(true);
      expect(sealed).toMatch(/^v1\./u);

      const secret = protector.decrypt(sealed ?? "", adminTotpContext(id ?? ""));

      expect(decodeBase32(secret)).toHaveLength(20);
      expect(secret).not.toBe("BETNGDEVSEEDTOTPSECRET234567AAAA");
      secrets.push(secret);
    }

    expect(secrets[0]).not.toBe(secrets[1]);
    expect(printed).toHaveLength(2);
    expect(printed[0]).toContain(`otpauth://totp/`);
    expect(printed[0]).toContain(`secret=${secrets[0] ?? ""}`);
  });

  it("prints nothing outside development and honours a pinned test secret", async () => {
    const pinned = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const config = await loadIdentityConfig({ ...DATABASE, NODE_ENV: "test", SEED_DEMO_DATA: "true", SEED_ADMIN_TOTP_SECRET: pinned });
    const protector = createDataProtector(config.dataKey);
    const { store, recorded } = recordingStore();
    const printed: string[] = [];

    await runDemoSeed({ config, store, hasher, protector, logger: silent, terminal: (text) => printed.push(text) });

    const [id, sealed] = [...recorded.enrolled.entries()][0] ?? [];

    expect(protector.decrypt(sealed ?? "", adminTotpContext(id ?? ""))).toBe(pinned);
    expect(printed).toEqual([]);
  });

  it("cannot run in production: the configuration refuses SEED_DEMO_DATA there", async () => {
    await expect(loadIdentityConfig({ ...DATABASE, ...PRODUCTION_REQUIREMENTS, NODE_ENV: "production", SEED_DEMO_DATA: "true" })).rejects.toThrow(/SEED_DEMO_DATA/u);

    const config = await loadIdentityConfig({ ...DATABASE, ...PRODUCTION_REQUIREMENTS, NODE_ENV: "production" });
    const { store, recorded } = recordingStore();

    expect(await runDemoSeed({ config, store, hasher, protector: createDataProtector(config.dataKey), logger: silent })).toBe(false);
    expect(recorded.admins).toEqual([]);
  });
});

describe("operator credentials", () => {
  it("issues temporary passwords of at least 12 characters and six-digit PINs, never twice the same", async () => {
    const issued = await Promise.all(Array.from({ length: 20 }, async () => issueTemporarySecrets()));

    for (const { password, pin } of issued) {
      expect(password.length).toBeGreaterThanOrEqual(12);
      expect(pin).toMatch(/^\d{6}$/u);
    }

    expect(new Set(issued.map((entry) => entry.password)).size).toBe(issued.length);
  });
});
