export const SETTLEMENT_COMMAND = Object.freeze({
  SETTLE_MATCH: "settlement.settleMatch",
  VOID_MATCH: "settlement.voidMatch",
  RETRY_SETTLEMENT: "settlement.retrySettlement",
  RETRY_EFFECTS: "settlement.retryEffects",
  CLOSE_PERIOD: "settlement.closePeriod",
  ROLL_OVER_PERIOD: "settlement.rollOverPeriod",
  UPDATE_COMMISSION_CONFIG: "settlement.updateCommissionConfig",
});

export type SettlementCommandType =
  (typeof SETTLEMENT_COMMAND)[keyof typeof SETTLEMENT_COMMAND];

export const SETTLEMENT_QUERY = Object.freeze({
  GET_SETTLEMENT: "settlement.getSettlement",
  LIST_SETTLEMENTS: "settlement.listSettlements",
  LIST_ADMIN_SETTLEMENTS: "settlement.listAdminSettlements",
  GET_OPERATOR_OVERVIEW: "settlement.getOperatorOverview",
  LIST_OPERATOR_PERIODS: "settlement.listOperatorPeriods",
  LIST_COMMISSION: "settlement.listCommission",
  GET_COMMISSION_CONFIG: "settlement.getCommissionConfig",
});

export type SettlementQueryType =
  (typeof SETTLEMENT_QUERY)[keyof typeof SETTLEMENT_QUERY];

export const SETTLEMENT_PROCEDURE = Object.freeze({
  SETTLE_MATCH: "settlement.settleMatch",
  VOID_MATCH: "settlement.voidMatch",
});

export const SETTLEMENT_PERMISSION = Object.freeze({
  READ: "settlement:read",
  OPERATE: "settlement:operate",
});

export const AUDIT_ACTION = Object.freeze({
  SETTLEMENT_STARTED: "settlement_started",
  SETTLEMENT_COMPLETED: "settlement_completed",
  SETTLEMENT_FAILED: "settlement_failed",
  PERIOD_CLOSED: "period_closed",
  COMMISSION_CONFIGURATION_CHANGED: "commission_configuration_changed",
  SETTLEMENT_RETRY_REQUESTED: "settlement_retry_requested",
  SETTLEMENT_RETRY_FINISHED: "settlement_retry_finished",
});

export const AUDIT_ENTITY = Object.freeze({
  MATCH: "match",
  OPERATOR_PERIOD: "operator_period",
  COMMISSION_CONFIG: "commission_config",
  BET_SETTLEMENT: "bet_settlement",
});

export const SYSTEM_ACTOR = Object.freeze({
  actorId: "system",
  actorRole: "SYSTEM",
});

export const MATCH_SETTLEMENT_KIND = Object.freeze({
  RESULT: "RESULT",
  VOID: "VOID",
});

export type MatchSettlementKind =
  (typeof MATCH_SETTLEMENT_KIND)[keyof typeof MATCH_SETTLEMENT_KIND];

/** One payout or refund per bet, however often settlement is retried. Wallet relies on these keys. */
export const WALLET_KEY = Object.freeze({
  payout: (betId: string): string => `settlement-payout:${betId}`,
  refund: (betId: string): string => `settlement-refund:${betId}`,
});

/** identity.notify is idempotent on this key, so a re-applied settlement cannot notify twice. */
export const NOTIFICATION_KEY = Object.freeze({
  settlement: (betId: string): string => `settlement:${betId}`,
});

export const NOTIFICATION_DELIVERY = Object.freeze({
  KIND: "BET_SETTLED",
  CONCURRENCY: 4,
  MAX_QUEUED: 2_000,
});

export const LIST_LIMIT = Object.freeze({
  SETTLEMENTS_DEFAULT: 50,
  SETTLEMENTS_MAX: 200,
  ADMIN_SETTLEMENTS_DEFAULT: 200,
  ADMIN_SETTLEMENTS_MAX: 500,
  PERIODS_DEFAULT: 50,
  PERIODS_MAX: 200,
  COMMISSION_DEFAULT: 200,
  COMMISSION_MAX: 500,
});

export const SETTLEMENT_BATCH = Object.freeze({
  LEG_CHUNK: 500,
  CONCURRENCY: 4,
  RETRY_LIMIT: 100,
});

export const SETTLEMENT_RETRY = Object.freeze({
  /** Automatic settle calls on a FAILED match stop here; only an operator retry runs it again. */
  AUTOMATIC_ATTEMPTS: 10,
  /** Per-settlement backoff of the effects retry loop; a payout owed is retried at the cap, never dropped. */
  EFFECTS_BACKOFF_BASE_MS: 5_000,
  EFFECTS_BACKOFF_MAX_MS: 300_000,
  EFFECTS_ALERT_AFTER: 5,
});
