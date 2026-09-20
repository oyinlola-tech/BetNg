/**
 * Where this client finds the platform.
 *
 * Read from Vite's environment at build time. Nothing here is hard-coded,
 * so the same bundle is pointed at a local stack or a deployed one by
 * changing `.env` rather than the source.
 */

import type { BetNgClientConfig } from "@betng/client-sdk";

const GATEWAY_URL = import.meta.env["VITE_GATEWAY_URL"] ?? "http://localhost:3000";

/**
 * The event service's WebSocket address.
 *
 * Given separately rather than derived from the gateway: the live stream is
 * a direct connection to the event service, and a deployment may put the
 * two behind different hosts.
 */
const LIVE_URL = import.meta.env["VITE_LIVE_URL"] ?? "ws://localhost:3008/live";

export const appConfig: BetNgClientConfig = Object.freeze({
  gatewayUrl: GATEWAY_URL,
  liveUrl: LIVE_URL,
  timeoutMs: 10_000,
});
