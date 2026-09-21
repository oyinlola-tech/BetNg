import type { TimeRange } from "../interfaces/index.js";

const DAY_MS = 86_400_000;

/** Undefined for a string that names no real day (`2026-02-31`), which `Date` would roll into March. */
export function utcDayRange(date: string): TimeRange | undefined {
  const from = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(from.getTime()) ||
    from.toISOString().slice(0, 10) !== date
  ) {
    return undefined;
  }

  return { from, to: new Date(from.getTime() + DAY_MS) };
}

export function utcToday(now: Date = new Date()): TimeRange {
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return { from, to: new Date(from.getTime() + DAY_MS) };
}
