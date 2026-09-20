export type * from "./types/index.js";

export { DataSourceError } from "./dataSource.type.js";
export type {
  BetNgDataSource,
  LiveMatchHandlers,
  LiveSubscription,
  MatchFilter,
} from "./dataSource.type.js";

export {
  FIRST_HALF_SECONDS,
  FULL_TIME_SECONDS,
  SECOND_HALF_START_SECONDS,
  VIRTUAL_TIMING,
  instantAtMinute,
  matchClock,
} from "./timing.js";
export type { ClockPeriod, MatchClock } from "./timing.js";

export {
  canBet,
  derivePhase,
  isFinished,
  isInPlay,
  isUpcoming,
  phaseDescription,
  phaseLabel,
  phaseTone,
} from "./phase.js";

export {
  formatBroadcastClock,
  formatCountdown,
  formatDateTime,
  formatKickoffTime,
  formatMatchday,
  formatMinute,
  formatMoney,
  formatMoneyCompact,
  formatOdds,
  formatRelative,
  formatScore,
  formatShortDate,
  formatSignedMoney,
  toLocalDateKey,
} from "./format.js";

export {
  MAX_SELECTIONS,
  QUICK_STAKES,
  STAKE_LIMITS,
  combinedOdds,
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
