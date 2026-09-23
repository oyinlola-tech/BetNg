import type { MatchSide } from "../types/index.js";

/*
 * One pitch coordinate system for every surface. x runs 0 (home goal line) to
 * 100 (away goal line); y runs 0 (near touchline) to 100 (far touchline). The
 * home side attacks towards x=100. A renderer scales these into its own
 * viewBox, so the model never depends on a pixel size.
 */
export interface PitchPoint {
  readonly x: number;
  readonly y: number;
}

export const PITCH_CENTRE: PitchPoint = { x: 50, y: 50 };

/** Landmarks, as fractions of the pitch, taken from the laws of the game. */
export const PITCH = {
  penaltySpot: 11.5,
  penaltyAreaDepth: 17,
  goalAreaDepth: 5.8,
  centreCircleRadius: 9.15,
  cornerArcRadius: 1,
} as const;

function mirrored(point: PitchPoint): PitchPoint {
  return { x: 100 - point.x, y: 100 - point.y };
}

/** The point an attack by `side` aims at. */
export function attackingGoal(side: MatchSide): PitchPoint {
  return side === "HOME" ? { x: 100, y: 50 } : { x: 0, y: 50 };
}

export function penaltySpot(side: MatchSide): PitchPoint {
  const home = { x: 100 - PITCH.penaltySpot, y: 50 };

  return side === "HOME" ? home : mirrored(home);
}

/** A corner for `side`: the flag nearest the goal it attacks. `near` picks the touchline. */
export function cornerFlag(side: MatchSide, near = true): PitchPoint {
  const x = side === "HOME" ? 99 : 1;

  return { x, y: near ? 1 : 99 };
}

export function clampToPitch(point: PitchPoint): PitchPoint {
  return {
    x: Math.min(Math.max(point.x, 0), 100),
    y: Math.min(Math.max(point.y, 0), 100),
  };
}

/** Straight-line interpolation, for visual smoothing only. */
export function interpolate(
  from: PitchPoint,
  to: PitchPoint,
  progress: number,
): PitchPoint {
  const t = Math.min(Math.max(progress, 0), 1);

  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

export function distance(from: PitchPoint, to: PitchPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/*
 * A pitch point the platform sent on an event, under the documented `detail`
 * keys. Anything missing, out of range or non-numeric is no point at all: the
 * ball stays where the last authoritative event put it rather than jumping to
 * a guess.
 */
export function readPoint(
  detail: Readonly<Record<string, string | number | boolean>> | undefined,
  xKey: string,
  yKey: string,
): PitchPoint | undefined {
  if (detail === undefined) return undefined;

  const x = detail[xKey];
  const y = detail[yKey];

  if (typeof x !== "number" || typeof y !== "number") return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  if (x < 0 || x > 100 || y < 0 || y > 100) return undefined;

  return { x, y };
}
