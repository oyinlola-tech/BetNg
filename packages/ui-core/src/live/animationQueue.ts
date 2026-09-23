import type { AnimationKind, PresentationEvent } from "./matchEventRouter.js";

/*
 * Events arrive when the platform sends them, which is not the rhythm they
 * should be watched at: a resync can deliver six at once, and a goal can land
 * while a corner is still playing. The queue gives the stadium one event at a
 * time, in sequence order, for a bounded moment each.
 *
 * It schedules; it never decides what happened. Nothing here can add, drop or
 * reorder a fact — a skipped animation still reaches the timeline, because the
 * timeline renders the event stream, not this queue.
 */

export const ANIMATION_MS: Readonly<Record<AnimationKind, number>> = {
  NONE: 0,
  BALL_MOVE: 900,
  PASS: 600,
  DRIBBLE: 800,
  SHOT: 1100,
  GOAL: 3200,
  CARD: 1800,
  SUBSTITUTION: 1800,
  VAR: 2600,
  PERIOD: 2400,
};

/** Beyond this the queue is behind the match, so it keeps only what still reads as live. */
const MAX_PENDING = 12;

export interface AnimationQueueOptions {
  /** The event now on screen, or nothing when the stadium returns to normal play. */
  readonly onPlay: (event: PresentationEvent | undefined) => void;
  /** No animation runs longer than an instant; every event still plays in order. */
  readonly reducedMotion?: boolean;
  readonly durations?: Readonly<Record<AnimationKind, number>>;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface AnimationQueue {
  /**
   * Marks events as already seen without showing them. Used on mount so that
   * opening a match in its 80th minute does not replay the first 79.
   */
  readonly seed: (events: readonly PresentationEvent[]) => void;
  /** Adds events not already queued or played. Safe to call with the whole stream. */
  readonly push: (events: readonly PresentationEvent[]) => void;
  readonly current: () => PresentationEvent | undefined;
  readonly pending: () => number;
  /** Drops what is queued and clears the screen. The event stream is untouched. */
  readonly clear: () => void;
  readonly stop: () => void;
}

export function createAnimationQueue(
  options: AnimationQueueOptions,
): AnimationQueue {
  const durations = options.durations ?? ANIMATION_MS;
  const setTimer =
    options.setTimer ??
    ((run: () => void, ms: number) => setTimeout(run, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });

  const queue: PresentationEvent[] = [];
  const played = new Set<string>();
  let playing: PresentationEvent | undefined;
  let timer: unknown;
  let stopped = false;

  function cancelTimer(): void {
    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }
  }

  function durationOf(event: PresentationEvent): number {
    const base = durations[event.animation] ?? 0;

    /*
     * Reduced motion still shows the event, briefly, so nothing is lost —
     * only the long travel and the dwell go.
     */
    return options.reducedMotion === true ? Math.min(base, 120) : base;
  }

  function advance(): void {
    if (stopped) return;

    const next = queue.shift();

    if (next === undefined) {
      playing = undefined;
      options.onPlay(undefined);

      return;
    }

    playing = next;
    played.add(next.id);
    options.onPlay(next);

    const ms = durationOf(next);

    if (ms <= 0) {
      advance();

      return;
    }

    timer = setTimer(() => {
      timer = undefined;
      advance();
    }, ms);
  }

  return {
    seed: (events) => {
      for (const event of events) played.add(event.id);
    },
    push: (events) => {
      if (stopped) return;

      let queued = false;

      for (const event of events) {
        if (played.has(event.id) || queue.some((e) => e.id === event.id)) {
          continue;
        }
        if (playing?.id === event.id) continue;
        if (event.animation === "NONE") {
          played.add(event.id);
          continue;
        }

        queue.push(event);
        queued = true;
      }

      if (!queued) return;

      queue.sort((a, b) => a.sequence - b.sequence);

      /*
       * A backlog means the stadium is behind the match. Keep the most recent
       * events — what is happening now — and mark the rest played so they are
       * never shown late as though they were current.
       */
      if (queue.length > MAX_PENDING) {
        for (const dropped of queue.splice(0, queue.length - MAX_PENDING)) {
          played.add(dropped.id);
        }
      }

      if (playing === undefined) {
        advance();

        return;
      }

      /*
       * A higher-priority event interrupts what is on screen: a goal never
       * waits behind the corner that led to it. The interrupted event is not
       * requeued — it has already been seen, and it stays in the timeline.
       */
      const leader = queue[0];

      if (leader !== undefined && leader.priority > playing.priority) {
        cancelTimer();
        advance();
      }
    },
    current: () => playing,
    pending: () => queue.length,
    clear: () => {
      cancelTimer();
      queue.length = 0;
      playing = undefined;
      options.onPlay(undefined);
    },
    stop: () => {
      stopped = true;
      cancelTimer();
      queue.length = 0;
      playing = undefined;
    },
  };
}
