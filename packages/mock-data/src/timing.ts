export const VIRTUAL_TIMING = Object.freeze({
  secondsPerMinute: 2,
  halfTimeSeconds: 15,
  settlementDelaySeconds: 8,
  bettingCloseLeadSeconds: 10,
});

export const FIRST_HALF_SECONDS = 45 * VIRTUAL_TIMING.secondsPerMinute;
export const SECOND_HALF_START_SECONDS =
  FIRST_HALF_SECONDS + VIRTUAL_TIMING.halfTimeSeconds;
export const FULL_TIME_SECONDS =
  SECOND_HALF_START_SECONDS + 45 * VIRTUAL_TIMING.secondsPerMinute;

export type ClockPeriod =
  "PRE" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "FULL_TIME";

export interface MatchClock {
  readonly period: ClockPeriod;
  readonly minute: number;
  readonly second: number;
  readonly elapsedSeconds: number;
}

export function matchClock(kickoffAt: string, now: number): MatchClock {
  const elapsed = (now - Date.parse(kickoffAt)) / 1000;
  const spm = VIRTUAL_TIMING.secondsPerMinute;

  if (elapsed < 0) {
    return { period: "PRE", minute: 0, second: 0, elapsedSeconds: elapsed };
  }

  if (elapsed < FIRST_HALF_SECONDS) {
    return {
      period: "FIRST_HALF",
      minute: Math.floor(elapsed / spm),
      second: Math.floor(((elapsed % spm) / spm) * 60),
      elapsedSeconds: elapsed,
    };
  }

  if (elapsed < SECOND_HALF_START_SECONDS) {
    return {
      period: "HALF_TIME",
      minute: 45,
      second: 0,
      elapsedSeconds: elapsed,
    };
  }

  if (elapsed < FULL_TIME_SECONDS) {
    const into = elapsed - SECOND_HALF_START_SECONDS;

    return {
      period: "SECOND_HALF",
      minute: 45 + Math.floor(into / spm),
      second: Math.floor(((into % spm) / spm) * 60),
      elapsedSeconds: elapsed,
    };
  }

  return {
    period: "FULL_TIME",
    minute: 90,
    second: 0,
    elapsedSeconds: elapsed,
  };
}

export function instantAtMinute(kickoffAt: string, minute: number): number {
  const spm = VIRTUAL_TIMING.secondsPerMinute;
  const start = Date.parse(kickoffAt);

  if (minute <= 45) return start + minute * spm * 1000;

  return start + (SECOND_HALF_START_SECONDS + (minute - 45) * spm) * 1000;
}

/** When the minute a clock reports began. Minute 45 begins twice: once before the break and once after it. */
export function minuteStartedAt(kickoffAt: string, clock: MatchClock): number {
  const start = Date.parse(kickoffAt);

  if (clock.period === "SECOND_HALF" || clock.period === "FULL_TIME") {
    const into = (clock.minute - 45) * VIRTUAL_TIMING.secondsPerMinute;

    return start + (SECOND_HALF_START_SECONDS + into) * 1000;
  }

  return instantAtMinute(kickoffAt, Math.min(clock.minute, 45));
}
