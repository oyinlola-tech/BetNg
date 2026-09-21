import type { BetNgClientConfig } from "@betng/client-sdk";

export type DataSourceMode = "mock" | "platform";

export const appConfig = Object.freeze({
  dataSource: (import.meta.env["VITE_DATA_SOURCE"] ?? "mock"),
  client: Object.freeze({
    gatewayUrl: import.meta.env["VITE_GATEWAY_URL"] ?? "http://localhost:3000",
    liveUrl: import.meta.env["VITE_LIVE_URL"] ?? "ws://localhost:3008/live",
    timeoutMs: 10_000,
  }) satisfies BetNgClientConfig,
});
