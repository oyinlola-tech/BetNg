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
});

export const AUDIT_ENTITY = Object.freeze({
  MATCH: "match",
  OPERATOR_PERIOD: "operator_period",
  COMMISSION_CONFIG: "commission_config",
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
