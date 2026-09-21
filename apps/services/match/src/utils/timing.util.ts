import type { MatchClock, MatchEventType, MatchStatus } from "@betng/contracts";
import type { MatchTiming } from "../configs/index.js";

const HALF_MINUTES = 45;
const FULL_MINUTES = 90;

export function secondHalfStartMs(
  kickoffMs: number,
  timing: MatchTiming,
): number {
  return (
    kickoffMs +
    (HALF_MINUTES * timing.secondsPerMinute + timing.halfTimeSeconds) * 1000
  );
}

export function fullTimeMs(kickoffMs: number, timing: MatchTiming): number {
  return (
    secondHalfStartMs(kickoffMs, timing) +
    HALF_MINUTES * timing.secondsPerMinute * 1000
  );
}

export function instantAtMinuteMs(
  kickoffMs: number,
  minute: number,
  timing: MatchTiming,
): number {
  if (minute <= HALF_MINUTES)
    return kickoffMs + minute * timing.secondsPerMinute * 1000;

  const capped = Math.min(minute, FULL_MINUTES);

  return (
    secondHalfStartMs(kickoffMs, timing) +
    (capped - HALF_MINUTES) * timing.secondsPerMinute * 1000
  );
}

/** When an event becomes public. The restart and the final whistle are pinned to the clock's boundaries. */
export function revealInstantMs(
  kickoffMs: number,
  event: { readonly minute: number; readonly type: MatchEventType },
  timing: MatchTiming,
): number {
  if (event.type === "FULL_TIME") return fullTimeMs(kickoffMs, timing);

  if (event.type === "SECOND_HALF") {
    return Math.max(
      secondHalfStartMs(kickoffMs, timing),
      instantAtMinuteMs(kickoffMs, event.minute, timing),
    );
  }

  return instantAtMinuteMs(kickoffMs, event.minute, timing);
}

export function minuteAtMs(
  kickoffMs: number,
  nowMs: number,
  timing: MatchTiming,
): number {
  const spmMs = timing.secondsPerMinute * 1000;

  if (nowMs <= kickoffMs) return 0;

  if (nowMs < kickoffMs + HALF_MINUTES * spmMs)
    return Math.floor((nowMs - kickoffMs) / spmMs);

  const restart = secondHalfStartMs(kickoffMs, timing);

  if (nowMs < restart) return HALF_MINUTES;

  return Math.min(
    FULL_MINUTES,
    HALF_MINUTES + Math.floor((nowMs - restart) / spmMs),
  );
}

/** The public clock. It runs only while the match is IN_PLAY, on the same instants the reveal step uses. */
export function matchClockAt(
  match: {
    readonly status: MatchStatus;
    readonly kickoffMs: number;
    readonly everKickedOff: boolean;
  },
  nowMs: number,
  timing: MatchTiming,
): MatchClock {
  const base = {
    asOf: new Date(nowMs).toISOString(),
    minuteLengthMs: Math.max(1, Math.round(timing.secondsPerMinute * 1000)),
  };
  const { status, kickoffMs } = match;

  if (status === "COMPLETED" || (status === "CANCELLED" && match.everKickedOff))
    return { period: "FULL_TIME", minute: FULL_MINUTES, ...base };

  if (status !== "IN_PLAY" || nowMs < kickoffMs)
    return { period: "PRE", minute: 0, ...base };

  const minute = minuteAtMs(kickoffMs, nowMs, timing);

  if (nowMs < kickoffMs + HALF_MINUTES * timing.secondsPerMinute * 1000)
    return { period: "FIRST_HALF", minute, ...base };

  if (nowMs < secondHalfStartMs(kickoffMs, timing))
    return { period: "HALF_TIME", minute: HALF_MINUTES, ...base };

  return { period: "SECOND_HALF", minute, ...base };
}

/** The clock an event carries on the live stream: the public clock at the instant that event is revealed. */
export function eventClockAt(
  kickoffMs: number,
  event: { readonly minute: number; readonly type: MatchEventType },
  timing: MatchTiming,
): MatchClock {
  return matchClockAt(
    {
      status: event.type === "FULL_TIME" ? "COMPLETED" : "IN_PLAY",
      kickoffMs,
      everKickedOff: true,
    },
    revealInstantMs(kickoffMs, event, timing),
    timing,
  );
}

/** The first instant at or after `earliestMs` congruent to the league's stagger modulo the round cycle. */
export function alignToLeagueGrid(
  earliestMs: number,
  staggerSeconds: number,
  timing: MatchTiming,
): number {
  const cycleMs = timing.roundCycleSeconds * 1000;
  const offsetMs = (staggerSeconds * 1000) % cycleMs;

  return Math.ceil((earliestMs - offsetMs) / cycleMs) * cycleMs + offsetMs;
}
