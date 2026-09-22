import type { MatchEventView, Score } from "@betng/ui-core";

export const MS_PER_MINUTE = 500;
const MIN_GAP_MS = 700;

/* When each recorded event appears during playback. Timing is the display's pacing only; order, minute and score are the platform's. */
export function replaySchedule(events: readonly MatchEventView[], msPerMinute: number = MS_PER_MINUTE): readonly number[] {
  const at: number[] = [];
  let last = -MIN_GAP_MS;

  for (const e of events) {
    const next = Math.max(e.minute * msPerMinute, last + MIN_GAP_MS);

    at.push(next);
    last = next;
  }

  return at;
}

export function revealedAt(schedule: readonly number[], elapsedMs: number): number {
  let n = 0;

  while (n < schedule.length && (schedule[n] ?? 0) <= elapsedMs) n += 1;

  return n;
}

export function replayScore(events: readonly MatchEventView[], revealed: number): Score {
  return revealed === 0 ? { home: 0, away: 0 } : (events[revealed - 1]?.score ?? { home: 0, away: 0 });
}

export function inSequence(events: readonly MatchEventView[]): readonly MatchEventView[] {
  return [...events].sort((a, b) => a.sequence - b.sequence);
}
