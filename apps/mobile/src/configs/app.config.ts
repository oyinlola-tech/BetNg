import Constants from "expo-constants";
import type { BetNgClientConfig } from "@betng/client-sdk";

interface ExpoExtra {
  readonly dataSource?: "mock" | "platform";
  readonly gatewayUrl?: string;
  readonly liveUrl?: string;
  readonly userId?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

export const appConfig = Object.freeze({
  dataSource: extra.dataSource ?? "mock",
  userId: extra.userId ?? "11111111-1111-4111-8111-111111111111",
  client: Object.freeze({
    gatewayUrl: extra.gatewayUrl ?? "http://localhost:3000",
    liveUrl: extra.liveUrl ?? "ws://localhost:3008/live",
    timeoutMs: 15_000,
  }) satisfies BetNgClientConfig,
});
