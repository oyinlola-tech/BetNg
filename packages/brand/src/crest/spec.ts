import { contrast, isHexColor, readableOn } from "./color.js";
import { CREST_EMBLEMS, CREST_PATTERNS, CREST_SHAPES } from "./types.js";
import type { CrestDetail, CrestEmblem, CrestSpec, CrestTeamInput } from "./types.js";

const FALLBACK_PRIMARY = "#1F2A44";
const FALLBACK_SECONDARY = "#E6E1D6";

function fnv1a(input: string): number {
  let h = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;

  return h >>> 0;
}

function pick<T>(list: readonly T[], id: string, salt: string): T {
  return list[fnv1a(`${salt}:${id}`) % list.length] as T;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function match<T extends string>(list: readonly T[], value: string | undefined): T | undefined {
  if (typeof value !== "string") return undefined;
  const wanted = normalise(value);

  return list.find((item) => item.toLowerCase() === wanted);
}

const EMBLEM_CHOICES: readonly CrestEmblem[] = [...CREST_EMBLEMS, "none"];

export function crestFor(team: CrestTeamInput): CrestSpec {
  const primary = isHexColor(team.colors.primary) ? team.colors.primary : FALLBACK_PRIMARY;
  const secondary = isHexColor(team.colors.secondary) ? team.colors.secondary : FALLBACK_SECONDARY;
  const shape = match(CREST_SHAPES, team.crest?.shape) ?? pick(CREST_SHAPES, team.id, "shape");
  const pattern = match(CREST_PATTERNS, team.crest?.pattern) ?? pick(CREST_PATTERNS, team.id, "pattern");

  let emblem = match(EMBLEM_CHOICES, team.crest?.emblem);

  if (emblem === undefined) {
    emblem = pick(EMBLEM_CHOICES, team.id, "emblem");
    // A derived crest is never a blank field.
    if (emblem === "none" && (pattern === "solid" || pattern === "border")) emblem = pick(CREST_EMBLEMS, team.id, "emblem-alt");
  }

  let accent: string;

  if (isHexColor(team.crest?.accent)) accent = team.crest.accent;
  else if (isHexColor(team.colors.onPrimary) && contrast(team.colors.onPrimary, primary) >= 3) accent = team.colors.onPrimary;
  else accent = readableOn(primary);

  return { shape, pattern, emblem, primary, secondary, accent };
}

export function detailFor(size: number): CrestDetail {
  if (size >= 40) return "full";

  return size >= 24 ? "reduced" : "minimal";
}
