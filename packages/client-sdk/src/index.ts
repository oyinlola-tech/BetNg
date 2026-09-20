/**
 * The shared client for BetNG's web, mobile and TV applications.
 *
 * All three consume the same platform the same way: REST through the
 * gateway for state, and one WebSocket to the event service for live match
 * events. Putting that in one package is what keeps the promise that there
 * is no mobile-only backend — there is no mobile-only client code that
 * could ask for one.
 *
 * It holds no UI and no framework. Web and TV are React, mobile is React
 * Native, and this runs unchanged in all three because it uses only `fetch`
 * and `WebSocket`.
 */

export { DEFAULT_TIMEOUT_MS } from "./config/index.js";
export type { BetNgClientConfig } from "./config/index.js";

export {
  BetNgApiError,
  createRestClient,
  isErrorResponse,
} from "./rest/index.js";
export type {
  AdminFixtureQuery,
  BetNgAdminClient,
  BetNgAuthClient,
  BetNgRestClient,
  BetNgShopClient,
  LedgerEntry,
  TicketQuery,
} from "./rest/index.js";

export { createLiveClient } from "./live/index.js";
export type {
  LiveClient,
  LiveClientOptions,
  LiveHandlers,
} from "./live/index.js";
