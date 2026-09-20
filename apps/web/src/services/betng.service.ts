/**
 * This client's handles on the platform.
 *
 * Both come from `@betng/client-sdk`, which web, mobile and TV share. The
 * clients differ in what they render, never in how they talk to the
 * backend — which is what keeps "no mobile-only backend logic" true.
 */

import { createLiveClient, createRestClient } from "@betng/client-sdk";
import type { LiveClient, LiveHandlers } from "@betng/client-sdk";
import { appConfig } from "../configs/index";

/** REST, through the gateway. One instance for the app's lifetime. */
export const api = createRestClient(appConfig);

/**
 * Opens a live match stream.
 *
 * Created per consumer rather than shared, so a screen that stops watching
 * can close its own connection without affecting another.
 *
 * @param handlers - What to do with events, gaps and connection changes.
 * @returns A connected live client.
 */
export function openLiveStream(handlers: LiveHandlers): LiveClient {
  return createLiveClient({ config: appConfig, handlers });
}
