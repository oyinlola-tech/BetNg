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

export type { BetNgAuthClient, LoginResult } from "./authClient.js";
export type {
  BetNgAccountClient,
  BetNgDevicesClient,
  BetNgKycClient,
  BetNgLimitsClient,
  BetNgPaymentsClient,
  BetNgProfileClient,
  BetNgSecurityClient,
  IdempotentOptions,
} from "./accountClient.js";
export type { AdminPaymentQuery, BetNgComplianceClient, CompliancePageQuery } from "./complianceClient.js";
export type { PageShape, ResponseSchema } from "./validated.js";
export { validated, validatedList, validatedPage } from "./validated.js";
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
