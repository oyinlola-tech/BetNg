/**
 * @betng/client-sdk/rest
 *
 * The REST calls every BetNG client makes, through the gateway.
 */

export { createRestClient } from "./restClient.core.js";
export type { BetNgRestClient, LedgerEntry } from "./restClient.core.js";

export { BetNgApiError, isErrorResponse } from "./restError.js";
