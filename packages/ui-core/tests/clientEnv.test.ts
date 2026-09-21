import { describe, expect, it } from "vitest";
import { readClientEnv } from "../src/runtime/clientEnv.js";

describe("client environment", () => {
  it("defaults to the platform, and honours the mock only as an explicit development or test opt-in", () => {
    expect(readClientEnv({})).toMatchObject({ appEnv: "development", dataSource: "platform", apiUrl: "http://localhost:3000", problems: [] });
    expect(readClientEnv({ VITE_DATA_SOURCE: "mock" }).dataSource).toBe("mock");
  });

  it("pins a production build to the platform whatever was asked", () => {
    const env = readClientEnv({ PROD: true, VITE_DATA_SOURCE: "mock", VITE_API_URL: "https://api.example.test", VITE_WS_URL: "wss://live.example.test/live" });

    expect(env.dataSource).toBe("platform");
    expect(env.appEnv).toBe("production");
    expect(env.problems).toEqual(["VITE_DATA_SOURCE=mock is ignored outside development and test."]);
  });

  it("lets a production-mode build run the mock only when it is declared a test build", () => {
    expect(readClientEnv({ PROD: true, VITE_APP_ENV: "test", VITE_DATA_SOURCE: "mock" }).dataSource).toBe("mock");
  });

  it("accepts the earlier variable names", () => {
    expect(readClientEnv({ VITE_GATEWAY_URL: "http://gw:3000", VITE_LIVE_URL: "ws://ev:3008/live" })).toMatchObject({ apiUrl: "http://gw:3000", realtimeUrl: "ws://ev:3008/live" });
  });

  it("flags a malformed or insecure deployment", () => {
    expect(readClientEnv({ VITE_API_URL: "gateway" }).problems).toContain("VITE_API_URL is not an http(s) URL.");
    expect(readClientEnv({ VITE_REALTIME_TRANSPORT: "sse" }).problems).toContain("VITE_WS_URL does not match the realtime transport.");
    expect(readClientEnv({ VITE_APP_ENV: "staging" }).problems).toContain("A deployed build should reach the platform over TLS.");
  });

  it("reads flags, transport, auth mode and timeout", () => {
    expect(
      readClientEnv({ VITE_FEATURE_FLAGS: "walletEnabled=false", VITE_REALTIME_AUTH: "frame", VITE_REQUEST_TIMEOUT_MS: "4000", VITE_LOG_LEVEL: "debug" }),
    ).toMatchObject({ flagOverrides: { walletEnabled: false }, realtimeAuth: "frame", requestTimeoutMs: 4000, logLevel: "debug" });
  });
});
