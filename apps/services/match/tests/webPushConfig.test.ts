import { createECDH } from "node:crypto";
import { publicConfigSchema } from "@betng/contracts";
import { describe, expect, it } from "vitest";
import { DEFAULT_TIMING, readVapidPublicKey } from "../src/configs/index.js";
import type { PublicConfigDto } from "../src/dtos/index.js";
import { loadContainer, loadServices } from "../src/loaders/index.js";
import { GetPublicConfigQuery } from "../src/services/match/queries/index.js";

const logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined } as never;

function publicKey(): string {
  const ecdh = createECDH("prime256v1");

  ecdh.generateKeys();

  return ecdh.getPublicKey().toString("base64url");
}

async function publicConfig(vapidPublicKey: string | undefined): Promise<PublicConfigDto> {
  const container = loadContainer({
    catalogue: {} as never,
    matches: {} as never,
    simulation: {} as never,
    squads: {} as never,
    risk: { activeStakeLimits: async () => undefined },
    search: {} as never,
    lifecycle: {} as never,
    identity: {} as never,
    timing: DEFAULT_TIMING,
    clock: () => new Date(),
    logger,
    vapidPublicKey,
  });
  const { queryBus } = loadServices(container);

  return queryBus.execute<GetPublicConfigQuery, PublicConfigDto>(new GetPublicConfigQuery());
}

describe("GET /config webPush", () => {
  it("publishes the VAPID public key when configured and omits webPush otherwise", async () => {
    const key = publicKey();
    const configured = await publicConfig(key);

    expect(configured.webPush).toEqual({ vapidPublicKey: key });
    expect(publicConfigSchema.safeParse(configured).success).toBe(true);

    const unconfigured = await publicConfig(undefined);

    expect(unconfigured).not.toHaveProperty("webPush");
    expect(publicConfigSchema.safeParse(unconfigured).success).toBe(true);
  });

  it("reads only a well-formed P-256 public key from the environment", () => {
    const key = publicKey();

    expect(readVapidPublicKey({})).toBeUndefined();
    expect(readVapidPublicKey({ VAPID_PUBLIC_KEY: " " })).toBeUndefined();
    expect(readVapidPublicKey({ VAPID_PUBLIC_KEY: key })).toBe(key);
    expect(() => readVapidPublicKey({ VAPID_PUBLIC_KEY: key.slice(3) })).toThrow(/VAPID_PUBLIC_KEY/u);
    expect(() => readVapidPublicKey({ VAPID_PUBLIC_KEY: "not+base64/url=" })).toThrow(/VAPID_PUBLIC_KEY/u);
  });
});
