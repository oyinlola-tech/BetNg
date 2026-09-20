/**
 * Motion.
 *
 * Every animation communicates a change — a selection added, a score
 * moving, a connection dropping — or it does not exist. The durations are
 * short because the product is about live information, and the client
 * always honours `prefers-reduced-motion`, which each platform maps to
 * `duration.instant` for everything.
 */

export const duration = Object.freeze({
  instant: 0,
  fast: 120,
  base: 180,
  slow: 280,
  /** Broadcast overlays: a goal card sliding in on TV. */
  broadcast: 600,
  /** How long a broadcast overlay holds before leaving. */
  broadcastHold: 3200,
});

export const easing = Object.freeze({
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  decelerate: "cubic-bezier(0, 0, 0, 1)",
  accelerate: "cubic-bezier(0.3, 0, 1, 1)",
});
