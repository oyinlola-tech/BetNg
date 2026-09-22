import type {
  ClosedPeriodResult,
  CommissionConfigRecord,
  CommissionLedgerRecord,
  OperatorPeriodKind,
  OperatorPeriodRecord,
  OperatorSummaryRecord,
} from "../models/index.js";

export interface ClosePeriodInput {
  /** When given, only this period is closed. */
  readonly expectedPeriodId?: string;
  readonly nextKind: OperatorPeriodKind;
  readonly now: Date;
  /** Runs inside the transaction before it commits; throwing rolls the close back. */
  readonly confirm?: (result: ClosedPeriodResult, before: OperatorPeriodRecord) => Promise<void>;
}

export interface OperatorRepository {
  ensureOpenPeriod(now: Date): Promise<OperatorPeriodRecord>;
  summarise(period: OperatorPeriodRecord): Promise<OperatorSummaryRecord>;
  listClosed(limit: number): Promise<readonly OperatorSummaryRecord[]>;
  listPeriods(limit: number): Promise<readonly OperatorPeriodRecord[]>;
  /** One transaction. Undefined when no period, or not `expectedPeriodId`, is open. */
  closePeriod(input: ClosePeriodInput): Promise<ClosedPeriodResult | undefined>;
}

export interface CommissionConfigSnapshot {
  readonly platformDefault: CommissionConfigRecord | undefined;
  readonly shops: readonly CommissionConfigRecord[];
}

export interface NewCommissionConfig {
  readonly shopId: string | null;
  readonly shopShareBasisPoints: number;
  readonly createdBy: string;
  readonly reason: string;
}

export interface CommissionConfigChange {
  readonly before: CommissionConfigRecord | undefined;
  readonly after: CommissionConfigRecord;
}

export interface CommissionLedgerFilter {
  readonly periodId?: string;
  readonly limit: number;
}

export interface CommissionRepository {
  seedDefault(shopShareBasisPoints: number): Promise<boolean>;
  current(): Promise<CommissionConfigSnapshot>;
  /** `confirm` runs inside the transaction; when it throws, the version is not written. */
  append(
    config: NewCommissionConfig,
    confirm: (change: CommissionConfigChange) => Promise<void>,
  ): Promise<CommissionConfigChange>;
  listLedger(filter: CommissionLedgerFilter): Promise<readonly CommissionLedgerRecord[]>;
}
