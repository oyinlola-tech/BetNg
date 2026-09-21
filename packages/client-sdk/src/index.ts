export { DEFAULT_TIMEOUT_MS } from "./config/index.js";
export type { BetNgClientConfig, RequestFailure } from "./config/index.js";

export {
  BetNgApiError,
  IDEMPOTENCY_HEADER,
  codeForStatus,
  createRestClient,
  isErrorResponse,
} from "./rest/index.js";
export type { ApiFailureKind, RequestOptions } from "./rest/index.js";
export type {
  AdminFixtureQuery,
  AdminListQuery,
  AdminListResource,
  AdminListRows,
  AnalyticsBreakdownQuery,
  AnalyticsSessionQuery,
  AnalyticsWindow,
  CommissionConfigView,
  MatchWindowQuery,
  OperatorLedger,
  BetNgAdminClient,
  BetNgAuthClient,
  BetNgRestClient,
  BetNgShopClient,
  LedgerEntry,
  SearchRequest,
  TicketQuery,
  TransactionPageQuery,
} from "./rest/index.js";

export {
  SYSTEM_CHANNEL,
  accountChannel,
  createConnectionManager,
  createEventRouter,
  createRealtimeClient,
  createSubscriptionManager,
  sseTransport,
  webSocketTransport,
} from "./realtime/index.js";
export type {
  ConnectionManager,
  ConnectionManagerOptions,
  ConnectionStatus,
  EventRouter,
  EventSourceConstructor,
  RealtimeAuthMode,
  RealtimeClient,
  RealtimeClientOptions,
  RealtimeEvent,
  RealtimeEventType,
  RealtimeListener,
  RealtimeTransport,
  SubscriptionManager,
  TransportConnection,
  TransportHandlers,
  WebSocketConstructor,
} from "./realtime/index.js";
