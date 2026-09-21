export type * from "./types/index.js";

export { DataSourceError } from "./dataSource.type.js";
export type {
  BetNgDataSource,
  DataSourceErrorCode,
  DataSourceErrorDetail,
  LiveMatchHandlers,
  LiveSubscription,
  MatchFilter,
  MatchSignal,
} from "./dataSource.type.js";

export {
  canBet,
  isFinished,
  isInPlay,
  isInterrupted,
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
export { DEFAULT_FLAGS, parseFlagOverrides, resolveFlags } from "./flags.js";
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

export { createSessionStore, hasPermission } from "./session.js";
export type { SessionLike, SessionSnapshot, SessionStatus, SessionStorage, SessionStore } from "./session.js";

export type { AuthDataSource } from "./authDataSource.type.js";
export type { PlaceTicketInput, ShopDataSource, TicketFilter } from "./shopDataSource.type.js";
export type { AdminDataSource } from "./adminDataSource.type.js";

export { createPlatformAdminSource, createPlatformAuthSource, createPlatformShopSource } from "./adapters/platformAccountSources.js";
export { translateApiError } from "./adapters/errors.js";

export { FASTBET_CODES, parseFastbet } from "./fastbet.js";
export type { FastbetPick, FastbetResult } from "./fastbet.js";

export { TOTAL_LINES, leadingSelections } from "./leading.js";
export type { LeadingCell } from "./leading.js";
