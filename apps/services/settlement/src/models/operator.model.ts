export type OperatorPeriodKind = "HOUR" | "DAY" | "MATCHDAY" | "ROUND" | "CUSTOM";

export type OperatorPeriodStatus = "OPEN" | "CLOSED";

export interface OperatorPeriodRecord {
  readonly id: string;
  readonly kind: OperatorPeriodKind;
  readonly status: OperatorPeriodStatus;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

/**
 * The operator's figures for a period. `operatorResult` is `grossStakes - grossPayouts` and is negative when
 * payouts exceeded stakes; it is reported as it is.
 */
export interface OperatorSummaryRecord {
  readonly period: OperatorPeriodRecord;
  readonly grossStakes: bigint;
  readonly grossPayouts: bigint;
  readonly operatorResult: bigint;
  /** NUMERIC(9,6) as text, computed by PostgreSQL. */
  readonly operatorResultRate: string;
  readonly settledBets: number;
  readonly voidBets: number;
  readonly refundedStakes: bigint;
}

export interface ClosedPeriodResult {
  readonly closed: OperatorSummaryRecord;
  readonly opened: OperatorPeriodRecord;
  readonly commissions: readonly CommissionLedgerRecord[];
}

export interface CommissionConfigRecord {
  readonly id: string;
  readonly shopId: string | null;
  /** NUMERIC(5,2) as text. */
  readonly shopSharePercent: string;
  readonly effectiveFrom: Date;
  readonly createdBy: string;
  readonly reason: string;
}

export interface CommissionLedgerRecord {
  readonly id: string;
  readonly periodId: string;
  readonly shopId: string;
  readonly grossStakes: bigint;
  readonly grossPayouts: bigint;
  readonly grossOperatorResult: bigint;
  readonly shopSharePercent: string;
  readonly shopShareAmount: bigint;
  readonly platformSharePercent: string;
  readonly platformShareAmount: bigint;
  readonly createdAt: Date;
}
