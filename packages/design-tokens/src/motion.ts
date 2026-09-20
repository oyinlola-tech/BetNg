/** Motion. */

export const duration = Object.freeze({
  instant: 0,
  fast: 120,
  base: 180,
  slow: 280,
  broadcast: 600,
  broadcastHold: 3200,
});

export const easing = Object.freeze({
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  decelerate: "cubic-bezier(0, 0, 0, 1)",
  accelerate: "cubic-bezier(0.3, 0, 1, 1)",
});
