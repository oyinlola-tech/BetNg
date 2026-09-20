/**
 * Where the mobile client finds the platform.
 *
 * Read from Expo's `extra` block, which is baked into the build from
 * `app.json`. A build is pointed at a different stack by changing that
 * file, never by editing source.
 */

import Constants from "expo-constants";
import type { BetNgClientConfig } from "@betng/client-sdk";

interface ExpoExtra {
  readonly gatewayUrl?: string;
  readonly liveUrl?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

export const appConfig: BetNgClientConfig = Object.freeze({
  gatewayUrl: extra.gatewayUrl ?? "http://localhost:3000",
  liveUrl: extra.liveUrl ?? "ws://localhost:3008/live",
  // Mobile networks are slower and less reliable than a desktop's, so the
  // timeout is more generous than the web client's.
  timeoutMs: 15_000,
});
