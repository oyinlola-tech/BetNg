export { createRestClient } from "./restClient.core.js";
export type {
  BetNgRestClient,
  LedgerEntry,
  MatchWindowQuery,
  SearchRequest,
  TransactionPageQuery,
} from "./restClient.core.js";

export { BetNgApiError, codeForStatus, isErrorResponse } from "./restError.js";
export type { ApiFailureKind } from "./restError.js";
export { IDEMPOTENCY_HEADER } from "./request.js";
export type { RequestOptions } from "./request.js";

export type { BetNgAuthClient } from "./authClient.js";
export type { BetNgShopClient, TicketQuery } from "./shopClient.js";
export type {
  AdminFixtureQuery,
  AdminListQuery,
  AdminListResource,
  AdminListRows,
  AnalyticsBreakdownQuery,
  AnalyticsSessionQuery,
  AnalyticsWindow,
  BetNgAdminClient,
  CommissionConfigView,
  OperatorLedger,
} from "./adminClient.js";
