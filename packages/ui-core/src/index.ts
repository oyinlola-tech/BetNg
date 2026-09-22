export type * from "./types/index.js";

export { DataSourceError } from "./dataSource.type.js";
export type {
  BetNgDataSource,
  BetSignal,
  DataSourceErrorCode,
  DataSourceErrorDetail,
  LiveMatchHandlers,
  LiveSubscription,
  MatchFilter,
  MatchSignal,
} from "./dataSource.type.js";

export {
  canBet,
  isBettable,
  isClosed,
  isFinished,
  isHalfTime,
  isInPlay,
  isInterrupted,
  isSettled,
  isStarting,
  isUpcoming,
  phaseDescription,
  phaseLabel,
  phaseTone,
  resolvePhase,
} from "./phase.js";
export type { PhaseSignals } from "./phase.js";
export {
  clockLabel,
  clockProgress,
  displayClock,
  isStale,
} from "./clock.js";
export type { DisplayClock } from "./clock.js";

export {
  formatBroadcastClock,
  formatCountdown,
  formatMatchday,
  formatMinute,
  formatOdds,
  formatScore,
} from "./format.js";
export {
  configureCurrency,
  currentCurrency,
  estimateReturn,
  formatCurrency,
  formatMoney,
  formatMoneyCompact,
  formatSignedMoney,
  multiplyOdds,
  parseMoney,
} from "./money.js";
export type { Money, MoneyFormatOptions } from "./money.js";
export {
  configureDateTime,
  formatAge,
  formatDateTime,
  formatKickoffTime,
  formatRelative,
  formatShortDate,
  formatTimeZoneName,
  localDayRange,
  toLocalDateKey,
} from "./datetime.js";
export type { DateTimeConfig } from "./datetime.js";
export { DEFAULT_FLAGS, FLAG_VARIABLES, parseFlagOverrides, resolveFlags } from "./flags.js";
export { consoleSink, createLogger, redact } from "./logger.js";
export type {
  LogCategory,
  LogEntry,
  LogLevel,
  LogSink,
  Logger,
} from "./logger.js";
export {
  MAX_SELECTIONS,
  QUICK_STAKES,
  STAKE_LIMITS,
  combinedOdds,
  createClientReference,
  isSelected,
  parseStakeInput,
  removeSelection,
  slipTotals,
  toggleSelection,
  validateSlip,
} from "./betslip.js";
export type { StakeProblem } from "./betslip.js";

export {
  MARKET_GROUP_LABEL,
  MARKET_GROUP_ORDER,
  groupMarkets,
  isKnownMarketKind,
  marketShape,
  marketTitle,
  sortMarkets,
} from "./markets/catalogue.js";
export type { MarketGroupView, MarketShape } from "./markets/catalogue.js";

export { computeStandings } from "./standings.js";

export { watchMatch } from "./live/watchMatch.js";
export type {
  LiveMatchController,
  LiveMatchSnapshot,
} from "./live/watchMatch.js";

export { createPlatformDataSource } from "./adapters/platformDataSource.js";
export type {
  KeyValueStorage,
  PlatformDataSourceOptions,
} from "./adapters/platformDataSource.js";

export { COOKIE_SESSION_TOKEN, createSessionStore, hasPermission, withoutCredential } from "./session.js";
export { createSessionMonitor } from "./sessionMonitor.js";
export type { SessionMonitor, SessionMonitorOptions, SessionMonitorPhase, SessionMonitorState } from "./sessionMonitor.js";
export { createIdempotencyKey, isAllowedExternalUrl, maskAccountNumber, safeReturnPath } from "./safety.js";
export type {
  AccountServicesSource,
  DevicesSource,
  KycSource,
  KycUploadInput,
  LimitsSource,
  PaymentsSource,
  ProfileSource,
  SecuritySource,
  UploadProgress,
} from "./accountServices.type.js";
export { createPlatformAccountServices } from "./adapters/platformAccountServices.js";
export type { PlatformAccountServicesOptions } from "./adapters/platformAccountServices.js";
export { uploadToTicket } from "./adapters/upload.js";
export type { SessionLike, SessionSnapshot, SessionStatus, SessionStorage, SessionStore } from "./session.js";

export type { AuthDataSource } from "./authDataSource.type.js";
export type { PlaceTicketInput, ShopDataSource, ShopShiftSource, TicketFilter } from "./shopDataSource.type.js";
export type { AdminDataSource, ComplianceDataSource } from "./adminDataSource.type.js";

export { createPlatformAdminSource, createPlatformAuthSource, createPlatformComplianceSource, createPlatformShopSource } from "./adapters/platformAccountSources.js";
export type { PlatformAdminOptions } from "./adapters/platformAccountSources.js";
export { translateApiError } from "./adapters/errors.js";

export { FASTBET_CODES, parseFastbet } from "./fastbet.js";
export type { FastbetPick, FastbetResult } from "./fastbet.js";

export { TOTAL_LINES, leadingSelections } from "./leading.js";
export type { LeadingCell } from "./leading.js";
export { readClientEnv } from "./runtime/clientEnv.js";
export type {
  AppEnvironment,
  ClientEnv,
  RawEnv,
} from "./runtime/clientEnv.js";
export { createPlatformClients } from "./runtime/platformClients.js";
export type {
  PlatformClientOptions,
  PlatformClients,
} from "./runtime/platformClients.js";
export { pageRows } from "./pageRows.js";
export type { PagedRows } from "./pageRows.js";
