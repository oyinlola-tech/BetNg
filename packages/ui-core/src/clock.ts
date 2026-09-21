import type { ClockPeriod, MatchClockView, MatchPhase } from "./types/index.js";

export interface DisplayClock {
  readonly period: ClockPeriod;
  readonly minute: number;
  readonly second: number;
  readonly label: string;
}

const PERIOD_CAP: Readonly<Record<ClockPeriod, number>> = Object.freeze({
  PRE: 0,
  FIRST_HALF: 45,
  HALF_TIME: 45,
  SECOND_HALF: 90,
  FULL_TIME: 90,
});

/**
 * The clock to draw. The period always comes from the platform; the minute
 * advances past the reported one only when the platform supplied a minute
 * length, and never beyond the end of the reported period.
 */
export function displayClock(
  clock: MatchClockView | undefined,
  now: number = Date.now(),
): DisplayClock | undefined {
  if (clock === undefined) return undefined;

  const running = clock.period === "FIRST_HALF" || clock.period === "SECOND_HALF";
  let minute = clock.minute;
  let second = 0;

  if (running && clock.minuteLengthMs !== undefined && clock.minuteLengthMs > 0) {
    const elapsed = Math.max(0, now - Date.parse(clock.asOf));
    const cap = PERIOD_CAP[clock.period] + (clock.addedMinutes ?? 0);
    const advanced = clock.minute + elapsed / clock.minuteLengthMs;

    if (advanced < cap) {
      minute = Math.floor(advanced);
      second = Math.floor((advanced - minute) * 60);
    } else {
      minute = cap;
    }
  }

  return { period: clock.period, minute, second, label: clockLabel(clock.period, minute) };
}

export function clockLabel(period: ClockPeriod, minute: number): string {
  switch (period) {
    case "PRE":
      return "";
    case "HALF_TIME":
      return "HT";
    case "FULL_TIME":
      return "FT";
    case "FIRST_HALF":
      return minute > 45 ? `45+${String(minute - 45)}'` : `${String(minute)}'`;
    case "SECOND_HALF":
      return minute > 90 ? `90+${String(minute - 90)}'` : `${String(minute)}'`;
  }
}

/** How far through the match the clock is, 0 to 1, for a progress bar. */
export function clockProgress(clock: DisplayClock | undefined): number {
  if (clock === undefined) return 0;

  return Math.min(1, Math.max(0, clock.minute / 90));
}

export function isStale(
  updatedAt: string | undefined,
  now: number,
  maxAgeMs: number,
): boolean {
  if (updatedAt === undefined) return false;

  return now - Date.parse(updatedAt) > maxAgeMs;
}

export function periodForPhase(phase: MatchPhase): ClockPeriod | undefined {
  if (phase === "HALFTIME") return "HALF_TIME";
  if (phase === "FINISHED" || phase === "SETTLED") return "FULL_TIME";

  return undefined;
}
