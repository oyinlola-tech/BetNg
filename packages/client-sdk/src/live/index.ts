/**
 * @betng/client-sdk/live
 *
 * The live match stream: ordered, gap-aware and self-healing.
 */

export { createLiveClient } from "./liveClient.core.js";
export type {
  LiveClient,
  LiveClientOptions,
  LiveHandlers,
} from "./liveClient.core.js";
