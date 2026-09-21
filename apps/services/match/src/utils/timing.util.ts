/**
 * The virtual match clock, server side.
 *
 * The same formula `packages/ui-core/src/timing.ts` draws the clock with: a first-half minute `m` happens at
 * `kickoff + m*spm`, a second-half minute at `kickoff + 45*spm + halfTime + (m-45)*spm`, and full time at
 * `kickoff + 90*spm + halfTime`. An event is public once its instant has passed, and not before.
 */

import type { MatchEventType } from "@betng/contracts";
import type { MatchTiming } from "../configs/index.js";

const HALF_MINUTES = 45;
const FULL_MINUTES = 90;

export function secondHalfStartMs(kickoffMs: number, timing: MatchTiming): number {
  return kickoffMs + (HALF_MINUTES * timing.secondsPerMinute + timing.halfTimeSeconds) * 1000;
}

export function fullTimeMs(kickoffMs: number, timing: MatchTiming): number {
  return secondHalfStartMs(kickoffMs, timing) + HALF_MINUTES * timing.secondsPerMinute * 1000;
}

export function instantAtMinuteMs(kickoffMs: number, minute: number, timing: MatchTiming): number {
  if (minute <= HALF_MINUTES) return kickoffMs + minute * timing.secondsPerMinute * 1000;

  const capped = Math.min(minute, FULL_MINUTES);

  return secondHalfStartMs(kickoffMs, timing) + (capped - HALF_MINUTES) * timing.secondsPerMinute * 1000;
}

/**
 * When an event becomes public. The restart and the final whistle are pinned to the clock's own boundaries, so
 * neither can be seen during the break or before the ninetieth minute has been played.
 */
export function revealInstantMs(
  kickoffMs: number,
  event: { readonly minute: number; readonly type: MatchEventType },
  timing: MatchTiming,
): number {
  if (event.type === "FULL_TIME") return fullTimeMs(kickoffMs, timing);

  if (event.type === "SECOND_HALF") {
    return Math.max(secondHalfStartMs(kickoffMs, timing), instantAtMinuteMs(kickoffMs, event.minute, timing));
  }

  return instantAtMinuteMs(kickoffMs, event.minute, timing);
}

export function minuteAtMs(kickoffMs: number, nowMs: number, timing: MatchTiming): number {
  const spmMs = timing.secondsPerMinute * 1000;

  if (nowMs <= kickoffMs) return 0;

  if (nowMs < kickoffMs + HALF_MINUTES * spmMs) return Math.floor((nowMs - kickoffMs) / spmMs);

  const restart = secondHalfStartMs(kickoffMs, timing);

  if (nowMs < restart) return HALF_MINUTES;

  return Math.min(FULL_MINUTES, HALF_MINUTES + Math.floor((nowMs - restart) / spmMs));
}

/**
 * The first kick-off at or after `earliestMs` on a league's grid: instants congruent to the league's stagger
 * modulo the round cycle. Every league keeps its own offset, so their rounds never start together.
 */
export function alignToLeagueGrid(earliestMs: number, staggerSeconds: number, timing: MatchTiming): number {
  const cycleMs = timing.roundCycleSeconds * 1000;
  const offsetMs = (staggerSeconds * 1000) % cycleMs;

  return Math.ceil((earliestMs - offsetMs) / cycleMs) * cycleMs + offsetMs;
}
