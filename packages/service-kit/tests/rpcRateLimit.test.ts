import { afterEach, describe, expect, it } from "vitest";
import {
  CALLER_HEADER,
  callerName,
  createCallerRateLimiter,
  createServiceServer,
  INTERNAL_TOKEN_HEADER,
  internalHeaders,
  loadServiceConfig,
  rpcRateLimiterFromEnv,
} from "../src/index.js";
import { createRPCProcedure, RPCServer } from "@zudojs/rpc";
import type { Logger } from "../src/index.js";

const silent = {
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined,
  flush: async () => undefined,
} as unknown as Logger;

const saved = { ...process.env };

afterEach(() => {
  for (const key of ["INTERNAL_SERVICE_TOKEN", "RPC_RATE_LIMIT_PER_SECOND", "RPC_RATE_LIMIT_BURST"]) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("per-caller RPC rate limit", () => {
  it("refills over time and bounds the callers it tracks", () => {
    let now = 100;
    const limiter = createCallerRateLimiter(10, 1, () => now);

    expect(limiter.acquire("betting")).toBe(0);
    expect(limiter.acquire("betting")).toBeCloseTo(0.1);
    now += 0.1;
    expect(limiter.acquire("betting")).toBe(0);

    for (let index = 0; index < 200; index += 1) limiter.acquire(`svc-${String(index)}`);
    expect(limiter.tracked()).toBeLessThanOrEqual(65);
  });

  it("has generous defaults, disables at 0 and refuses nonsense", () => {
    expect(rpcRateLimiterFromEnv({})).toBeDefined();
    expect(rpcRateLimiterFromEnv({ RPC_RATE_LIMIT_PER_SECOND: "0" })).toBeUndefined();
    expect(() => rpcRateLimiterFromEnv({ RPC_RATE_LIMIT_PER_SECOND: "-5" })).toThrow();
    expect(() => rpcRateLimiterFromEnv({ RPC_RATE_LIMIT_BURST: "lots" })).toThrow();
    expect(callerName("betting")).toBe("betting");
    expect(callerName("Bad Name\r\n")).toBe("unknown");
    expect(callerName(undefined)).toBe("unknown");
  });

  it("answers 429 with Retry-After per calling service, only for authenticated callers", async () => {
    const token = `internal-${crypto.randomUUID()}`;

    process.env["INTERNAL_SERVICE_TOKEN"] = token;
    process.env["RPC_RATE_LIMIT_PER_SECOND"] = "1";
    process.env["RPC_RATE_LIMIT_BURST"] = "2";

    const config = await loadServiceConfig({
      serviceName: "settlement",
      version: "0.0.1",
      defaultPort: 4198,
      env: { NODE_ENV: "test", LOG_LEVEL: "fatal", HOST: "127.0.0.1", SETTLEMENT_PORT: "4198" },
    });
    const rpcServer = new RPCServer();

    rpcServer.register(createRPCProcedure("kit.echo", (input: unknown) => Promise.resolve(input)));

    const server = createServiceServer({ config, logger: silent, routes: () => undefined, rpcServer });

    await server.start();

    try {
      const url = `http://127.0.0.1:${String(server.port)}/rpc`;
      const frame = JSON.stringify({ id: "f1", procedure: "kit.echo", payload: 1, metadata: {}, timestamp: 0 });
      const call = (headers: Record<string, string>) =>
        fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: frame });

      for (let index = 0; index < 4; index += 1) {
        expect((await call({ [INTERNAL_TOKEN_HEADER]: "x".repeat(token.length), [CALLER_HEADER]: "betting" })).status).toBe(404);
      }

      const betting = { [INTERNAL_TOKEN_HEADER]: token, [CALLER_HEADER]: "betting" };

      expect((await call(betting)).status).toBe(200);
      expect((await call(betting)).status).toBe(200);

      const limited = await call(betting);
      const body = (await limited.json()) as { error: { code: string } };

      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
      expect(body.error.code).toBe("RPC_RATE_LIMITED");
      expect((await call({ [INTERNAL_TOKEN_HEADER]: token, [CALLER_HEADER]: "wallet" })).status).toBe(200);
      expect(internalHeaders()[CALLER_HEADER]).toBe("settlement");
    } finally {
      await server.stop();
    }
  });
});
