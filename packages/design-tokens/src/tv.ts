/**
 * The ten-foot layer. Values are rem against a root size that scales with the
 * viewport, so one layout fills 1080p and 4K; see `tvRootFontSize`.
 */

export const tvRootFontSize = "clamp(16px, 1.25vw, 40px)";

export const tvType = Object.freeze({
  score: 9,
  scoreCompact: 4.5,
  teamName: 2.5,
  headline: 3,
  title: 2,
  body: 1.375,
  label: 1,
  clock: 2.25,
  tableRow: 1.5,
});

export const tvCrest = Object.freeze({ hero: 10, row: 3, strip: 2.25 });

export const tvLayout = Object.freeze({
  /** Kept clear on every edge for sets that overscan. */
  safeArea: 3,
  gutter: 2,
  rowHeight: 4,
  focusRing: 0.3,
  focusScale: 1.03,
});

export const tvMotion = Object.freeze({
  focusMs: 160,
  sceneMs: 600,
  sceneHoldMs: 14_000,
});
