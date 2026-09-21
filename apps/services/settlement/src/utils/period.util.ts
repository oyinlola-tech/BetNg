/** Reporting period identifiers: `SESSION-YYYYMMDD-NNNN`, numbered within the UTC day. */

const PERIOD_ID = /^SESSION-(\d{8})-(\d{4})$/;

export const PERIOD_ID_PATTERN = PERIOD_ID;

export const MAX_PERIODS_PER_DAY = 9999;

export function utcDateKey(instant: Date): string {
  return instant.toISOString().slice(0, 10).replaceAll("-", "");
}

export function formatPeriodId(dateKey: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_PERIODS_PER_DAY) {
    throw new RangeError("A day holds at most 9999 reporting periods.");
  }

  return `SESSION-${dateKey}-${String(sequence).padStart(4, "0")}`;
}

export function periodPrefix(dateKey: string): string {
  return `SESSION-${dateKey}-`;
}

export function periodSequence(periodId: string): number {
  const match = PERIOD_ID.exec(periodId);

  if (match === null) {
    throw new RangeError("Not a reporting period identifier.");
  }

  return Number(match[2]);
}
