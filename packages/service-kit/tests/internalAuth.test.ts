import { describe, expect, it } from "vitest";
import {
  allowsTokenlessInternalCalls,
  assertInternalTokenConfigured,
  INTERNAL_TOKEN_HEADER,
  isInternalRequest,
  loadServiceConfig,
} from "../src/index.js";

const request = (token?: string) =>
  ({ getHeader: (name: string) => (name === INTERNAL_TOKEN_HEADER ? token : undefined) }) as unknown as Parameters<typeof isInternalRequest>[0];

describe("internal service token", () => {
  it.each(["development", "test"])("lets NODE_ENV=%s run without a token", (mode) => {
    expect(allowsTokenlessInternalCalls({ NODE_ENV: mode })).toBe(true);
    expect(() => assertInternalTokenConfigured({ NODE_ENV: mode })).not.toThrow();
    expect(isInternalRequest(request(), { NODE_ENV: mode })).toBe(true);
  });

  it.each([undefined, "production", "staging", "Development", "dev", "test ", ""])("fails closed without a token when NODE_ENV is %o", (mode) => {
    const env = mode === undefined ? {} : { NODE_ENV: mode };

    expect(allowsTokenlessInternalCalls(env)).toBe(false);
    expect(() => assertInternalTokenConfigured(env)).toThrow(/INTERNAL_SERVICE_TOKEN must be set/);
    expect(isInternalRequest(request(), env)).toBe(false);
    expect(isInternalRequest(request("anything-at-all-000000000000"), env)).toBe(false);
  });

  it("requires the exact token once one is configured, in every mode", () => {
    const token = "a-long-enough-internal-token-0001";

    for (const mode of ["development", "test", "production"]) {
      const env = { NODE_ENV: mode, INTERNAL_SERVICE_TOKEN: token };

      expect(isInternalRequest(request(token), env)).toBe(true);
      expect(isInternalRequest(request(), env)).toBe(false);
      expect(isInternalRequest(request(`${token}x`), env)).toBe(false);
      expect(isInternalRequest(request(token.slice(0, -1)), env)).toBe(false);
    }
  });

  it("refuses a short token and the public placeholder in production", () => {
    expect(() => assertInternalTokenConfigured({ NODE_ENV: "development", INTERNAL_SERVICE_TOKEN: "short" })).toThrow(/at least/);
    expect(() =>
      assertInternalTokenConfigured({ NODE_ENV: "production", INTERNAL_SERVICE_TOKEN: "betng-local-development-internal-token" }),
    ).toThrow(/placeholder/);
  });
});

describe("Redis authentication", () => {
  const load = (env: Record<string, string>) =>
    loadServiceConfig({ serviceName: "gateway", version: "0.0.1", defaultPort: 4199, usesRedis: true, env });

  it("refuses a passwordless REDIS_URL in production", async () => {
    await expect(load({ NODE_ENV: "production", REDIS_URL: "redis://redis:6379" })).rejects.toThrow(/Redis password/);
    await expect(load({ NODE_ENV: "production", REDIS_URL: "redis://user@redis:6379" })).rejects.toThrow(/Redis password/);
    await expect(load({ NODE_ENV: "production", REDIS_URL: "not a url" })).rejects.toThrow(/REDIS_URL/);
  });

  it("accepts an authenticated URL in production and a passwordless one in development", async () => {
    expect((await load({ NODE_ENV: "production", REDIS_URL: "redis://:s3cret-hex@redis:6379" })).redisUrl).toBe("redis://:s3cret-hex@redis:6379");
    expect((await load({ NODE_ENV: "development", REDIS_URL: "redis://localhost:56379" })).redisUrl).toBe("redis://localhost:56379");
  });

  it("refuses an unknown NODE_ENV such as staging", async () => {
    await expect(load({ NODE_ENV: "staging" })).rejects.toThrow(/NODE_ENV/);
  });
});
