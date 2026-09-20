/**
 * The type system.
 *
 * Two families. Inter carries the interface — labels, tables, odds, body —
 * because it stays legible at 12px and has tabular figures, which every
 * column of odds and every score needs. Archivo carries display: scores,
 * team names in a scoreboard, section headings on TV. It is a grotesque
 * with a wide, athletic stance that reads as sport without a novelty face.
 *
 * Sizes are unitless pixels here; each platform converts (rem for web and
 * TV, dp for React Native). TV multiplies the whole scale, see `tvScale`.
 */

export const fontFamily = Object.freeze({
  sans: "'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  display:
    "'Archivo Variable', Archivo, 'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif",
  mono: "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
});

export const fontSize = Object.freeze({
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
  "5xl": 48,
  "6xl": 64,
  /** Scoreboard digits. */
  score: 56,
  scoreLg: 96,
});

export const fontWeight = Object.freeze({
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 800,
});

export const lineHeight = Object.freeze({
  none: 1,
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
});

export const letterSpacing = Object.freeze({
  tight: "-0.02em",
  normal: "0",
  wide: "0.04em",
  /** Small uppercase labels: LIVE, MATCHDAY 04, FT. */
  caps: "0.08em",
});

/**
 * How much larger the TV client draws everything.
 *
 * A television is read from three metres away; a 14px label is invisible.
 * TV keeps the same scale and multiplies it, so the hierarchy is identical
 * to the other clients and only the absolute size changes.
 */
export const tvScale = 1.75;
