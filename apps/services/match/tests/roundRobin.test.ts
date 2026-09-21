import { describe, expect, it } from "vitest";
import { buildSeason, matchdaysPerSeason } from "../src/utils/index.js";

const TEAMS = Array.from(
  { length: 20 },
  (_, index) => `team-${String(index + 1).padStart(2, "0")}`,
);

describe("round-robin season", () => {
  const season = buildSeason(TEAMS);

  it("has 38 matchdays of 10 fixtures", () => {
    expect(matchdaysPerSeason(TEAMS.length)).toBe(38);
    expect(season).toHaveLength(38);

    for (const matchday of season) expect(matchday).toHaveLength(10);
  });

  it("never plays a team twice in a matchday", () => {
    for (const matchday of season) {
      const playing = matchday.flatMap((pairing) => [
        pairing.homeTeamId,
        pairing.awayTeamId,
      ]);

      expect(new Set(playing).size).toBe(20);
    }
  });

  it("has every pair meet exactly twice, once at each ground", () => {
    const meetings = new Map<string, number>();

    for (const pairing of season.flat()) {
      const key = `${pairing.homeTeamId}>${pairing.awayTeamId}`;

      meetings.set(key, (meetings.get(key) ?? 0) + 1);
    }

    expect(meetings.size).toBe(20 * 19);

    for (const home of TEAMS) {
      for (const away of TEAMS) {
        if (home !== away) expect(meetings.get(`${home}>${away}`)).toBe(1);
      }
    }
  });

  it("mirrors the first half in the second", () => {
    for (let matchday = 0; matchday < 19; matchday += 1) {
      const first = (season[matchday] ?? [])
        .map((pairing) => `${pairing.awayTeamId}>${pairing.homeTeamId}`)
        .sort();
      const second = (season[matchday + 19] ?? [])
        .map((pairing) => `${pairing.homeTeamId}>${pairing.awayTeamId}`)
        .sort();

      expect(second).toEqual(first);
    }
  });

  it("gives an odd league a bye and keeps the pairing rule", () => {
    const odd = buildSeason(TEAMS.slice(0, 5));

    expect(odd).toHaveLength(10);
    expect(odd.every((matchday) => matchday.length === 2)).toBe(true);
    expect(
      new Set(
        odd
          .flat()
          .map((pairing) => `${pairing.homeTeamId}>${pairing.awayTeamId}`),
      ).size,
    ).toBe(20);
  });

  it("is empty for fewer than two teams", () => {
    expect(buildSeason(["only"])).toEqual([]);
  });
});
