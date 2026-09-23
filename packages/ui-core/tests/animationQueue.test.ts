import { describe, expect, it } from "vitest";
import { createAnimationQueue } from "../src/live/animationQueue.js";
import type {
  AnimationKind,
  PresentationEvent,
} from "../src/live/matchEventRouter.js";

/*
 * The queue is driven through an injected timer so the tests advance the clock
 * themselves. Nothing here waits on real time.
 */
function harness(reducedMotion = false) {
  const timers = new Map<number, { run: () => void; at: number }>();
  let handle = 0;
  let now = 0;
  const played: (string | undefined)[] = [];

  const queue = createAnimationQueue({
    reducedMotion,
    onPlay: (event) => {
      played.push(event?.id);
    },
    setTimer: (run, ms) => {
      handle += 1;
      timers.set(handle, { run, at: now + ms });

      return handle;
    },
    clearTimer: (id) => {
      timers.delete(id as number);
    },
  });

  function advance(ms: number): void {
    now += ms;

    for (const [id, timer] of [...timers.entries()]) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.run();
      }
    }
  }

  return { queue, played, advance, pending: () => timers.size };
}

function event(
  id: string,
  sequence: number,
  animation: AnimationKind,
  priority: number,
): PresentationEvent {
  return {
    id,
    sequence,
    kind: "SHOT",
    minute: sequence,
    side: "HOME",
    teamName: "Arsenal",
    teamCode: "ARS",
    player: undefined,
    secondaryPlayer: undefined,
    score: { home: 0, away: 0 },
    headline: id,
    description: id,
    severity: "minor",
    priority,
    animation,
    from: undefined,
    to: undefined,
    occurredAt: "",
    announce: false,
  };
}

describe("animation queue", () => {
  it("plays events one at a time in sequence order", () => {
    const { queue, played, advance } = harness();

    queue.push([
      event("b", 2, "SHOT", 50),
      event("a", 1, "BALL_MOVE", 30),
    ]);

    expect(played).toEqual(["a"]);

    advance(900);
    expect(played).toEqual(["a", "b"]);

    advance(1100);
    expect(played).toEqual(["a", "b", undefined]);
  });

  it("lets a goal interrupt the corner it came from", () => {
    const { queue, played, advance } = harness();

    queue.push([event("corner", 1, "BALL_MOVE", 30)]);
    expect(played).toEqual(["corner"]);

    advance(100);
    queue.push([event("goal", 2, "GOAL", 100)]);

    // The goal takes the screen immediately rather than waiting out the corner.
    expect(played).toEqual(["corner", "goal"]);
  });

  it("does not let a lesser event interrupt a goal", () => {
    const { queue, played, advance } = harness();

    queue.push([event("goal", 1, "GOAL", 100)]);
    advance(100);
    queue.push([event("foul", 2, "BALL_MOVE", 20)]);

    expect(played).toEqual(["goal"]);
  });

  it("never replays an event it has already shown", () => {
    const { queue, played, advance } = harness();
    const shot = event("s", 1, "SHOT", 50);

    queue.push([shot]);
    advance(1100);
    queue.push([shot, { ...shot }]);

    expect(played.filter((id) => id === "s")).toHaveLength(1);
  });

  it("skips events that have nothing to animate", () => {
    const { queue, played } = harness();

    queue.push([event("foul", 1, "NONE", 20)]);

    expect(played).toEqual([]);
  });

  it("seeds history without replaying it", () => {
    const { queue, played } = harness();
    const history = [event("old1", 1, "GOAL", 100), event("old2", 2, "SHOT", 50)];

    queue.seed(history);
    queue.push([...history, event("new", 3, "SHOT", 50)]);

    expect(played).toEqual(["new"]);
  });

  it("drops a backlog rather than showing stale events as current", () => {
    const { queue, played } = harness();
    const burst = Array.from({ length: 20 }, (_, i) =>
      event(`e${String(i)}`, i + 1, "SHOT", 50),
    );

    queue.push(burst);

    // The oldest are discarded; what plays first is well into the burst.
    expect(played[0]).not.toBe("e0");
    expect(queue.pending()).toBeLessThanOrEqual(12);
  });

  it("still shows every event under reduced motion, only briefly", () => {
    const { queue, played, advance } = harness(true);

    queue.push([
      event("a", 1, "GOAL", 100),
      event("b", 2, "SHOT", 50),
    ]);

    expect(played).toEqual(["a"]);

    advance(120);
    expect(played).toEqual(["a", "b"]);
  });

  it("clears the screen without touching what it has already seen", () => {
    const { queue, played } = harness();
    const shot = event("s", 1, "SHOT", 50);

    queue.push([shot]);
    queue.clear();

    expect(played).toEqual(["s", undefined]);

    queue.push([shot]);
    expect(played).toEqual(["s", undefined]);
  });

  it("stops cleanly", () => {
    const { queue, played } = harness();

    queue.stop();
    queue.push([event("s", 1, "SHOT", 50)]);

    expect(played).toEqual([]);
  });
});
