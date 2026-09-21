export const CREST_SHAPES = ["shield", "heater", "round", "hex", "pennant", "diamond", "squareNotch", "oval"] as const;
export const CREST_PATTERNS = ["solid", "halves", "quarters", "stripes", "hoops", "sash", "chevron", "saltire", "band", "border"] as const;
export const CREST_EMBLEMS = ["star", "crown", "tower", "bolt", "anchor", "wings", "tree", "wave", "sun", "ball", "key", "arrow"] as const;

export type CrestShape = (typeof CREST_SHAPES)[number];
export type CrestPattern = (typeof CREST_PATTERNS)[number];
export type CrestEmblemName = (typeof CREST_EMBLEMS)[number];
export type CrestEmblem = CrestEmblemName | "none";
export type CrestDetail = "full" | "reduced" | "minimal";

export interface CrestSpec {
  readonly shape: CrestShape;
  readonly pattern: CrestPattern;
  readonly emblem: CrestEmblem;
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
}

export interface CrestTeamInput {
  readonly id: string;
  readonly colors: { readonly primary: string; readonly secondary: string; readonly onPrimary?: string };
  readonly crest?:
    | {
        readonly shape?: string;
        readonly pattern?: string;
        readonly emblem?: string;
        readonly accent?: string;
      }
    | undefined;
}

/** Draw in order. `clip` layers are clipped to `shapePath(spec.shape)`; strokes use round joins. */
export interface CrestLayer {
  readonly d: string;
  readonly fill: string;
  readonly opacity?: number;
  readonly clip?: boolean;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}
