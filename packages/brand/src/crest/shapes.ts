import { scaleAbout } from "./path.js";
import type { CrestShape } from "./types.js";

export const CREST_SIZE = 64;
export const CREST_VIEWBOX = "0 0 64 64";

export interface CrestShapeDef {
  readonly d: string;
  /** Optical centre of the field, where patterns cross and the emblem sits. */
  readonly cy: number;
  /** Emblem box edge in crest units. */
  readonly emblem: number;
}

export const SHAPES: Readonly<Record<CrestShape, CrestShapeDef>> = {
  shield: { d: "M8 8C16 8 25 6.6 32 3C39 6.6 48 8 56 8V30C56 45 46 55 32 61C18 55 8 45 8 30Z", cy: 30, emblem: 26 },
  heater: { d: "M9 5H55V27C55 43 45.5 53.5 32 61C18.5 53.5 9 43 9 27Z", cy: 28, emblem: 26 },
  round: { d: "M3 32A29 29 0 1 1 61 32A29 29 0 1 1 3 32Z", cy: 32, emblem: 28 },
  hex: { d: "M32 3L57.11 17.5V46.5L32 61L6.89 46.5V17.5Z", cy: 32, emblem: 27 },
  pennant: { d: "M9 4H55L53 40L32 61L11 40Z", cy: 27, emblem: 25 },
  diamond: { d: "M32 2L60 32L32 62L4 32Z", cy: 32, emblem: 22 },
  squareNotch: { d: "M14 5H50A6 6 0 0 0 56 11V53A6 6 0 0 0 50 59H14A6 6 0 0 0 8 53V11A6 6 0 0 0 14 5Z", cy: 32, emblem: 28 },
  oval: { d: "M7 32A25 29 0 1 1 57 32A25 29 0 1 1 7 32Z", cy: 32, emblem: 27 },
};

export function shapePath(shape: CrestShape): string {
  return SHAPES[shape].d;
}

export function shapeInset(shape: CrestShape, scale: number): string {
  return scaleAbout(SHAPES[shape].d, scale, 32, 32);
}
