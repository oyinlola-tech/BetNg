/**
 * The mobile client's handles on the platform.
 *
 * The same `@betng/client-sdk` the web and TV clients use. Mobile is not a
 * wrapper around the web app — it has its own screens and navigation — but
 * it consumes exactly the same backend, which is why there is no
 * mobile-only service or endpoint anywhere in the platform.
 *
 * React Native provides `fetch` and `WebSocket`, so the SDK runs unchanged.
 */

import { createLiveClient, createRestClient } from "@betng/client-sdk";
import type { LiveClient, LiveHandlers } from "@betng/client-sdk";

import { appConfig } from "../configs";

/** REST, through the gateway. One instance for the app's lifetime. */
export const api = createRestClient(appConfig);

/**
 * Opens a live match stream.
 *
 * @param handlers - What to do with events, gaps and connection changes.
 * @returns A connected live client.
 */
export function openLiveStream(handlers: LiveHandlers): LiveClient {
  return createLiveClient({ config: appConfig, handlers });
}
