export { createRestClient } from "./restClient.core.js";
export type { BetNgRestClient, LedgerEntry, MatchWindowQuery } from "./restClient.core.js";

export { BetNgApiError, isErrorResponse } from "./restError.js";

export type { BetNgAuthClient } from "./authClient.js";
export type { BetNgShopClient, TicketQuery } from "./shopClient.js";
export type {
  AdminFixtureQuery,
  AnalyticsBreakdownQuery,
  AnalyticsSessionQuery,
  AnalyticsWindow,
  BetNgAdminClient,
  CommissionConfigView,
  OperatorLedger,
} from "./adminClient.js";
