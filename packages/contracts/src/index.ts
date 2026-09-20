/**
 * @betng/contracts
 *
 * The shared BetNG domain contracts: TypeScript types and the validation
 * schemas that back them.
 *
 * This package holds contracts only. It contains no business logic, no I/O
 * and no service-specific behaviour, so every service can depend on it
 * without depending on another service.
 *
 * The contracts are language independent: they describe JSON over HTTP. The
 * Python services implement the same shapes from `docs/api.md` rather than
 * importing anything from here.
 */

export {
  API_PREFIX,
  asId,
  brandedIdSchema,
  CURRENCY,
  currencySchema,
  decimalOddsSchema,
  dependencyCheckSchema,
  errorDetailSchema,
  ErrorCodes,
  errorResponseSchema,
  healthResponseSchema,
  healthStatusSchema,
  isoTimestampSchema,
  minorUnitsSchema,
  pageSchema,
  paginationQuerySchema,
  readinessResponseSchema,
  REQUEST_ID_HEADER,
  uuidSchema,
} from "./common/index.js";
export type {
  BetId,
  Branded,
  Currency,
  DecimalOdds,
  DependencyCheck,
  ErrorCode,
  ErrorDetail,
  ErrorResponse,
  FixtureId,
  HealthResponse,
  HealthStatus,
  IsoTimestamp,
  LeagueId,
  MarketId,
  MatchEventId,
  MatchId,
  MinorUnits,
  Page,
  PaginationQuery,
  ReadinessResponse,
  SelectionId,
  SettlementId,
  TeamId,
  TransactionId,
  UserId,
  WalletId,
} from "./common/index.js";

export {
  fixtureSchema,
  leagueSchema,
  listMatchesQuerySchema,
  listTeamsQuerySchema,
  matchEventSchema,
  matchEventTypeSchema,
  matchSchema,
  matchScoreSchema,
  matchSideSchema,
  matchStatusSchema,
  teamSchema,
} from "./match/index.js";
export type {
  Fixture,
  League,
  ListMatchesQuery,
  ListTeamsQuery,
  Match,
  MatchEvent,
  MatchEventType,
  MatchScore,
  MatchSide,
  MatchStatus,
  Team,
} from "./match/index.js";

export {
  marketSchema,
  marketStatusSchema,
  marketTypeSchema,
  matchOddsSchema,
  selectionSchema,
} from "./odds/index.js";
export type {
  Market,
  MarketStatus,
  MarketType,
  MatchOdds,
  Selection,
} from "./odds/index.js";

export {
  betSchema,
  betSelectionSchema,
  betStatusSchema,
  listBetsQuerySchema,
  placeBetRequestSchema,
} from "./betting/index.js";
export type {
  Bet,
  BetSelection,
  BetStatus,
  ListBetsQuery,
  PlaceBetRequest,
} from "./betting/index.js";

export {
  depositRequestSchema,
  transactionSchema,
  transactionTypeSchema,
  walletSchema,
  withdrawRequestSchema,
} from "./wallet/index.js";
export type {
  DepositRequest,
  Transaction,
  TransactionType,
  Wallet,
  WithdrawRequest,
} from "./wallet/index.js";

export {
  settledSelectionSchema,
  settlementOutcomeSchema,
  settlementSchema,
} from "./settlement/index.js";
export type {
  SettledSelection,
  Settlement,
  SettlementOutcome,
} from "./settlement/index.js";

export {
  outcomeProbabilitiesSchema,
  probabilityRequestSchema,
  simulatedEventSchema,
  simulationRequestSchema,
  simulationResultSchema,
  simulationTeamSchema,
} from "./simulation/index.js";
export type {
  OutcomeProbabilities,
  ProbabilityRequest,
  SimulatedEvent,
  SimulationRequest,
  SimulationResult,
  SimulationTeam,
} from "./simulation/index.js";

export {
  clientFrameSchema,
  liveEventSchema,
  liveEventTypeSchema,
  MATCH_CHANNEL_PATTERN,
  matchChannel,
} from "./realtime/index.js";
export type {
  ClientFrame,
  ErrorFrame,
  EventFrame,
  LiveEvent,
  LiveEventType,
  PingFrame,
  ServerFrame,
  SubscribedFrame,
  UnsubscribedFrame,
  WelcomeFrame,
} from "./realtime/index.js";

export {
  exposureReportSchema,
  exposureRequestSchema,
  riskActionSchema,
  selectionExposureSchema,
} from "./risk/index.js";
export type {
  ExposureReport,
  ExposureRequest,
  RiskAction,
  SelectionExposure,
} from "./risk/index.js";
