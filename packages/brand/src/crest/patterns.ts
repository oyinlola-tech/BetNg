import { shapeInset } from "./shapes.js";
import type { CrestDetail, CrestPattern, CrestShape } from "./types.js";

export interface PatternContext {
  readonly shape: CrestShape;
  readonly cy: number;
  readonly detail: CrestDetail;
}

export interface PatternPrimitive {
  readonly d: string;
  readonly paint: "primary" | "secondary";
}

export interface CrestPatternDef {
  readonly draw: (ctx: PatternContext) => readonly PatternPrimitive[];
  /** Colour under the emblem. */
  readonly field: "primary" | "secondary" | "mixed";
  readonly plate?: "always";
  readonly emblemScale?: number;
  readonly emblemDy?: number;
  readonly keyline?: number;
}

const n = (v: number): string => String(Math.round(v * 100) / 100);
const rect = (x: number, y: number, w: number, h: number): string => `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`;
const secondary = (...ds: string[]): readonly PatternPrimitive[] => ds.map((d) => ({ d, paint: "secondary" as const }));

function diagonal(cy: number, half: number, rising: boolean): string {
  const s = rising ? -1 : 1;

  return `M-4 ${n(cy - s * 36 - half)}L68 ${n(cy + s * 36 - half)}V${n(cy + s * 36 + half)}L-4 ${n(cy - s * 36 + half)}Z`;
}

export const BORDER_INSET = 0.74;

export const PATTERNS: Readonly<Record<CrestPattern, CrestPatternDef>> = {
  solid: { draw: () => [], field: "primary" },
  halves: { draw: () => secondary(rect(32, 0, 32, 64)), field: "mixed" },
  quarters: {
    draw: ({ cy }) => secondary(rect(32, 0, 32, cy), rect(0, cy, 32, 64 - cy)),
    field: "mixed",
    plate: "always",
  },
  stripes: {
    draw: ({ detail }) => (detail === "minimal" ? secondary(rect(23, 0, 18, 64)) : secondary(rect(17.6, 0, 9.6, 64), rect(36.8, 0, 9.6, 64))),
    field: "mixed",
  },
  hoops: {
    draw: ({ cy, detail }) =>
      detail === "minimal" ? secondary(rect(0, cy - 21, 64, 14), rect(0, cy + 7, 64, 14)) : secondary(rect(0, cy - 17.4, 64, 11.6), rect(0, cy + 5.8, 64, 11.6)),
    field: "mixed",
  },
  sash: { draw: ({ cy, detail }) => secondary(diagonal(cy, detail === "minimal" ? 12 : 10, true)), field: "mixed" },
  chevron: {
    draw: ({ cy, detail }) => {
      const a = cy + 5;
      const t = detail === "minimal" ? 14 : 11;

      return secondary(`M32 ${n(a)}L68 ${n(a + 27)}V${n(a + 27 + t)}L32 ${n(a + t)}L-4 ${n(a + 27 + t)}V${n(a + 27)}Z`);
    },
    field: "primary",
    emblemScale: 0.8,
    emblemDy: -8,
  },
  saltire: {
    draw: ({ cy, detail }) => {
      const half = detail === "minimal" ? 8 : 6.5;

      return secondary(diagonal(cy, half, true), diagonal(cy, half, false));
    },
    field: "mixed",
    plate: "always",
    emblemScale: 0.82,
  },
  band: { draw: ({ cy }) => secondary(rect(0, cy - 12, 64, 24)), field: "secondary", emblemScale: 0.8 },
  border: {
    draw: ({ shape, detail }) => [
      { d: rect(0, 0, 64, 64), paint: "secondary" },
      { d: shapeInset(shape, detail === "minimal" ? 0.68 : BORDER_INSET), paint: "primary" },
    ],
    field: "primary",
    emblemScale: 0.8,
    keyline: BORDER_INSET,
  },
};
