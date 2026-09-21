/**
 * Reporting-period SQL shared by the settlement and operator repositories.
 *
 * A settlement takes a share lock on the OPEN period for the length of its transaction. Closing a period
 * updates that row, so the close waits for every in-flight settlement and none can slip an entry into a
 * period whose ledger row has already been written.
 */

import { Prisma } from "../databases/index.js";
import type { OperatorPeriodKind, OperatorPeriodRecord } from "../models/index.js";
import { periodPrefix, utcDateKey } from "../utils/index.js";

export interface PeriodRow {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly starts_at: Date;
  readonly ends_at: Date | null;
}

export function toPeriod(row: PeriodRow): OperatorPeriodRecord {
  return {
    id: row.id,
    kind: row.kind as OperatorPeriodKind,
    status: row.status === "OPEN" ? "OPEN" : "CLOSED",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

const OPEN_ATTEMPTS = 3;

/**
 * Inserts the next `SESSION-YYYYMMDD-NNNN` of the UTC day as OPEN. A concurrent opener wins quietly: the
 * single-open index turns this insert into a no-op.
 */
export async function insertNextPeriod(
  tx: Prisma.TransactionClient,
  kind: OperatorPeriodKind,
  now: Date,
): Promise<void> {
  const prefix = periodPrefix(utcDateKey(now));

  await tx.$executeRaw`
    INSERT INTO settlement.operator_periods (id, kind, status, starts_at)
    SELECT ${prefix} || lpad((COALESCE(MAX(substring(id FROM 18 FOR 4)::int), 0) + 1)::text, 4, '0'),
           ${kind}, 'OPEN', ${now}
    FROM settlement.operator_periods
    WHERE id LIKE ${`${prefix}%`}
    ON CONFLICT DO NOTHING`;
}

export type PeriodLock = "share" | "update";

/** Locks and returns the OPEN period, or undefined when none is open. */
export async function lockOpenPeriod(
  tx: Prisma.TransactionClient,
  lock: PeriodLock,
): Promise<OperatorPeriodRecord | undefined> {
  const rows =
    lock === "share"
      ? await tx.$queryRaw<PeriodRow[]>`
          SELECT id, kind, status, starts_at, ends_at
          FROM settlement.operator_periods WHERE status = 'OPEN' FOR SHARE`
      : await tx.$queryRaw<PeriodRow[]>`
          SELECT id, kind, status, starts_at, ends_at
          FROM settlement.operator_periods WHERE status = 'OPEN' FOR UPDATE`;

  const row = rows[0];

  return row === undefined ? undefined : toPeriod(row);
}

/** The OPEN period under a share lock, opening a DAY period when there is none. */
export async function lockOrOpenPeriod(
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<OperatorPeriodRecord> {
  for (let attempt = 0; attempt < OPEN_ATTEMPTS; attempt += 1) {
    const open = await lockOpenPeriod(tx, "share");

    if (open !== undefined) {
      return open;
    }

    await insertNextPeriod(tx, "DAY", now);
  }

  throw new Error("No reporting period could be opened.");
}
