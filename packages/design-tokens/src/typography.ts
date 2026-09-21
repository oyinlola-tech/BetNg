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
  caps: "0.08em",
});

export interface TypeRole {
  readonly family: keyof typeof fontFamily;
  readonly size: number;
  readonly weight: number;
  readonly lineHeight: number;
  readonly tracking: string;
  readonly tabular?: boolean;
  readonly uppercase?: boolean;
}

/** The named roles text is set in. A component picks a role, never a raw size. */
export const typeRole = Object.freeze({
  display: { family: "display", size: 48, weight: 800, lineHeight: 1.05, tracking: "-0.02em" },
  h1: { family: "display", size: 30, weight: 700, lineHeight: 1.15, tracking: "-0.02em" },
  h2: { family: "display", size: 24, weight: 700, lineHeight: 1.2, tracking: "-0.01em" },
  h3: { family: "display", size: 17, weight: 700, lineHeight: 1.3, tracking: "0" },
  sectionHeading: { family: "display", size: 12, weight: 700, lineHeight: 1.3, tracking: "0.1em", uppercase: true },
  body: { family: "sans", size: 14, weight: 400, lineHeight: 1.5, tracking: "0" },
  small: { family: "sans", size: 12, weight: 400, lineHeight: 1.4, tracking: "0" },
  caption: { family: "sans", size: 11, weight: 600, lineHeight: 1.4, tracking: "0.08em", uppercase: true },
  data: { family: "sans", size: 14, weight: 500, lineHeight: 1.3, tracking: "0", tabular: true },
  score: { family: "display", size: 56, weight: 800, lineHeight: 1, tracking: "-0.02em", tabular: true },
  odds: { family: "sans", size: 14, weight: 700, lineHeight: 1.2, tracking: "0", tabular: true },
  financial: { family: "sans", size: 15, weight: 600, lineHeight: 1.3, tracking: "0", tabular: true },
} satisfies Record<string, TypeRole>);

export type TypeRoleName = keyof typeof typeRole;

export const tvScale = 1.75;
