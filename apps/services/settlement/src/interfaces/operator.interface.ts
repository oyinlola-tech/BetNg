import type {
  ClosedPeriodResult,
  CommissionConfigRecord,
  CommissionLedgerRecord,
  OperatorPeriodKind,
  OperatorPeriodRecord,
  OperatorSummaryRecord,
} from "../models/index.js";

export interface ClosePeriodInput {
  /** When given, only this period is closed; a different open period means someone else already closed it. */
  readonly expectedPeriodId?: string;
  readonly nextKind: OperatorPeriodKind;
  readonly now: Date;
}

export interface OperatorRepository {
  /** The OPEN period, opened as a DAY period when there is none. */
  ensureOpenPeriod(now: Date): Promise<OperatorPeriodRecord>;
  /** The live aggregate of a period's `operator_ledger_entries`. */
  summarise(period: OperatorPeriodRecord): Promise<OperatorSummaryRecord>;
  listClosed(limit: number): Promise<readonly OperatorSummaryRecord[]>;
  listPeriods(limit: number): Promise<readonly OperatorPeriodRecord[]>;
  /**
   * Closes the open period, writes its `operator_ledger` row and one `commission_ledger` row per shop, and
   * opens the next period — one transaction. Returns undefined when `expectedPeriodId` is no longer open.
   */
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
  /** Inserts the platform default once; a database that already has one is left alone. */
  seedDefault(shopShareBasisPoints: number): Promise<boolean>;
  /** The values in force now: the default and each shop's latest override. */
  current(): Promise<CommissionConfigSnapshot>;
  /**
   * Appends a configuration version. `confirm` runs inside the transaction with the before/after pair; when
   * it throws, the version is not written.
   */
  append(
    config: NewCommissionConfig,
    confirm: (change: CommissionConfigChange) => Promise<void>,
  ): Promise<CommissionConfigChange>;
  listLedger(filter: CommissionLedgerFilter): Promise<readonly CommissionLedgerRecord[]>;
}
