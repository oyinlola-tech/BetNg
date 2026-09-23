import { describe, expect, it } from "vitest";
import {
  COLLECTION_PHASES,
  isInCollection,
  selectCollection,
  selectCollections,
} from "../src/matches/collections.js";
import {
  isBettable,
  isClosed,
  isHalfTime,
  isSettled,
  isStarting,
} from "../src/phase.js";
import type { MatchPhase, MatchSummary } from "../src/types/index.js";

function match(
  id: string,
  phase: MatchPhase,
  kickoffAt: string,
  minute?: number,
): MatchSummary {
  return {
    id: id as MatchSummary["id"],
    fixtureId: id as MatchSummary["fixtureId"],
    leagueId: "l" as MatchSummary["leagueId"],
    leagueName: "League",
    leagueCode: "LG",
    season: 1,
    matchday: 1,
    home: { name: "H" } as MatchSummary["home"],
    away: { name: "A" } as MatchSummary["away"],
    kickoffAt,
    bettingClosesAt: kickoffAt,
    status: "SCHEDULED",
    phase,
    score: { home: 0, away: 0 },
    openMarkets: 0,
    ...(minute === undefined
      ? {}
      : { clock: { period: "FIRST_HALF" as const, minute, asOf: kickoffAt } }),
  };
}

describe("lifecycle helpers", () => {
  it("reads each state from the phase the platform reported", () => {
    expect(isBettable("BETTING_OPEN")).toBe(true);
    expect(isBettable("BETTING_CLOSED")).toBe(false);
    expect(isClosed("BETTING_CLOSED")).toBe(true);
    expect(isStarting("BETTING_CLOSED")).toBe(true);
    expect(isStarting("DELAYED")).toBe(true);
    expect(isHalfTime("HALFTIME")).toBe(true);
    expect(isSettled("SETTLED")).toBe(true);
    expect(isSettled("FINISHED")).toBe(false);
  });
});

describe("match collections", () => {
  const MATCHES = [
    match("open-late", "BETTING_OPEN", "2026-09-22T15:00:00.000Z"),
    match("open-early", "BETTING_OPEN", "2026-09-22T12:00:00.000Z"),
    match("closed", "BETTING_CLOSED", "2026-09-22T12:30:00.000Z"),
    match("delayed", "DELAYED", "2026-09-22T12:45:00.000Z"),
    match("live-12", "LIVE", "2026-09-22T11:00:00.000Z", 12),
    match("live-70", "LIVE", "2026-09-22T11:00:00.000Z", 70),
    match("ht", "HALFTIME", "2026-09-22T11:00:00.000Z", 45),
    match("scheduled", "SCHEDULED", "2026-09-22T18:00:00.000Z"),
    match("done", "FINISHED", "2026-09-22T09:00:00.000Z"),
    match("settled", "SETTLED", "2026-09-22T08:00:00.000Z"),
  ];

  it("keeps a closed match out of open for play", () => {
    const open = selectCollection(MATCHES, "OPEN_FOR_PLAY");

    expect(open.map((m) => m.id)).toEqual(["open-early", "open-late"]);
    expect(open.some((m) => m.id === "closed")).toBe(false);
  });

  it("puts closed and delayed matches under starting soon", () => {
    expect(selectCollection(MATCHES, "STARTING_SOON").map((m) => m.id)).toEqual([
      "closed",
      "delayed",
    ]);
  });

  it("counts half time as live and leads with the match furthest along", () => {
    expect(selectCollection(MATCHES, "LIVE").map((m) => m.id)).toEqual([
      "live-70",
      "ht",
      "live-12",
    ]);
  });

  it("shows results newest first", () => {
    expect(selectCollection(MATCHES, "FINISHED").map((m) => m.id)).toEqual([
      "done",
      "settled",
    ]);
  });

  it("does not put one match in two playable collections at once", () => {
    for (const m of MATCHES) {
      const memberships = (
        ["OPEN_FOR_PLAY", "STARTING_SOON", "LIVE", "UPCOMING"] as const
      ).filter((key) => isInCollection(m.phase, key));

      expect(memberships.length).toBeLessThanOrEqual(1);
    }
  });

  it("leaves out collections the day has nothing for", () => {
    const only = selectCollections([match("a", "LIVE", "2026-09-22T11:00:00.000Z", 5)]);

    expect(only.map((c) => c.key)).toEqual(["LIVE"]);
  });

  it("asks the platform only for the phases a collection contains", () => {
    expect(COLLECTION_PHASES.OPEN_FOR_PLAY).toEqual(["BETTING_OPEN"]);
    expect(COLLECTION_PHASES.LIVE).toEqual(["LIVE", "HALFTIME"]);
  });
});
