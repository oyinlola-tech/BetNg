import {
  isBettable,
  isFinished,
  isInPlay,
  isSettled,
  isStarting,
} from "../phase.js";
import type { MatchPhase, MatchSummary } from "../types/index.js";

/*
 * One canonical match entity, several views of it. Every collection here is a
 * filter over the phase the platform reported — never over local time — so a
 * match leaves "open for play" because the platform closed it, not because a
 * countdown on this device reached zero.
 */

export type MatchCollectionKey =
  | "OPEN_FOR_PLAY"
  | "STARTING_SOON"
  | "LIVE"
  | "UPCOMING"
  | "FINISHED"
  | "SETTLED";

type Predicate = (phase: MatchPhase) => boolean;

const PREDICATES: Readonly<Record<MatchCollectionKey, Predicate>> = {
  OPEN_FOR_PLAY: isBettable,
  STARTING_SOON: isStarting,
  LIVE: isInPlay,
  UPCOMING: (phase) => phase === "SCHEDULED",
  FINISHED: isFinished,
  SETTLED: isSettled,
};

/** The phases to ask the platform for when reading a collection. */
export const COLLECTION_PHASES: Readonly<
  Record<MatchCollectionKey, readonly MatchPhase[]>
> = {
  OPEN_FOR_PLAY: ["BETTING_OPEN"],
  STARTING_SOON: ["BETTING_CLOSED", "DELAYED"],
  LIVE: ["LIVE", "HALFTIME"],
  UPCOMING: ["SCHEDULED"],
  FINISHED: ["FINISHED", "SETTLED"],
  SETTLED: ["SETTLED"],
};

export const COLLECTION_LABEL: Readonly<Record<MatchCollectionKey, string>> = {
  OPEN_FOR_PLAY: "Open for play",
  STARTING_SOON: "Starting soon",
  LIVE: "Live now",
  UPCOMING: "Upcoming",
  FINISHED: "Results",
  SETTLED: "Settled",
};

function byKickoff(a: MatchSummary, b: MatchSummary): number {
  return a.kickoffAt.localeCompare(b.kickoffAt);
}

/** Live first by minute played, so the match furthest along leads. */
function byMinute(a: MatchSummary, b: MatchSummary): number {
  return (b.clock?.minute ?? 0) - (a.clock?.minute ?? 0);
}

export function selectCollection<T extends MatchSummary>(
  matches: readonly T[],
  key: MatchCollectionKey,
): readonly T[] {
  const test = PREDICATES[key];
  const members = matches.filter((match) => test(match.phase));

  if (key === "LIVE") return members.sort(byMinute);

  return members.sort(
    key === "FINISHED" || key === "SETTLED"
      ? (a, b) => byKickoff(b, a)
      : byKickoff,
  );
}

export function isInCollection(
  phase: MatchPhase,
  key: MatchCollectionKey,
): boolean {
  return PREDICATES[key](phase);
}

export interface MatchCollection<T extends MatchSummary = MatchSummary> {
  readonly key: MatchCollectionKey;
  readonly label: string;
  readonly matches: readonly T[];
}

/** Every non-empty collection, in the order the football page presents them. */
export function selectCollections<T extends MatchSummary>(
  matches: readonly T[],
  keys: readonly MatchCollectionKey[] = [
    "OPEN_FOR_PLAY",
    "STARTING_SOON",
    "LIVE",
    "UPCOMING",
  ],
): readonly MatchCollection<T>[] {
  return keys.flatMap((key) => {
    const members = selectCollection(matches, key);

    return members.length === 0
      ? []
      : [{ key, label: COLLECTION_LABEL[key], matches: members }];
  });
}
