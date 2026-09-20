/**
 * Delivers live match events to web, mobile and TV over WebSocket.
 *
 * The stream is a projection of what the simulation already decided, never
 * the source of truth: a client that misses a frame re-reads the match from
 * the match service and is correct again. Clients are consumers — the
 * protocol has no frame that publishes.
 */

export { createApp } from "./app.js";
export type { EventApp } from "./app.js";
export {
  DEFAULT_PORT,
  LIVE_PATH,
  loadEventConfig,
  SERVICE_NAME,
  SERVICE_VERSION,
} from "./configs/index.js";
export { createInMemoryChannelRegistry } from "./repositories/index.js";
