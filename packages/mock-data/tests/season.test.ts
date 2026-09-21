import { describe, expect, it } from "vitest";
import { COMPETITIONS } from "../src/clubs.js";
import { marketsFor } from "../src/markets.js";
import { currentRound, fixturesForRound, findFixture, statusAt } from "../src/season.js";
import { scoringSide, scriptFor, statsAt } from "../src/simulate.js";

const NOW = Date.UTC(2026, 8, 21, 10, 0, 0);

describe("virtual season", () => {
  it("offers exactly the four simulation competitions", () => {
    expect(COMPETITIONS.map((c) => c.seed.slug)).toEqual(["premier-league", "laliga", "serie-a", "ligue-1"]);
  });

  it("schedules every club exactly once per round", () => {
    for (const competition of COMPETITIONS) {
      const fixtures = fixturesForRound(competition, currentRound(competition, NOW));
      const clubs = fixtures.flatMap((f) => [f.home.id, f.away.id]);

      expect(new Set(clubs).size).toBe(clubs.length);
      expect(clubs.length).toBe(competition.clubs.length);
    }
  });

  it("plays the same match the same way every time, so every client agrees", () => {
    const competition = COMPETITIONS[0];

    if (competition === undefined) throw new Error("no competition");

    const [fixture] = fixturesForRound(competition, currentRound(competition, NOW) - 1);

    if (fixture === undefined) throw new Error("no fixture");

    const again = findFixture(fixture.matchId, NOW, COMPETITIONS);

    expect(again?.kickoffMs).toBe(fixture.kickoffMs);
    expect(scriptFor(fixture).finalScore).toEqual(scriptFor(fixture).finalScore);
    expect(statusAt(fixture, NOW)).toBe("COMPLETED");
  });

  it("keeps the final score consistent with the goals in the script", () => {
    for (const competition of COMPETITIONS) {
      for (const fixture of fixturesForRound(competition, 3)) {
        const script = scriptFor(fixture);
        const home = script.events.filter((e) => scoringSide(e) === "HOME").length;
        const away = script.events.filter((e) => scoringSide(e) === "AWAY").length;

        expect({ home, away }).toEqual(script.finalScore);
        expect(script.events.at(-1)?.score).toEqual(script.finalScore);
      }
    }
  });

  it("scripts penalties, own goals, offsides and fouls without disturbing the score or the order", () => {
    const kinds = new Set<string>();

    for (const competition of COMPETITIONS) {
      for (let round = 0; round < 12; round += 1) {
        for (const fixture of fixturesForRound(competition, round)) {
          const script = scriptFor(fixture);
          const releases = script.events.map((e) => e.releaseSeconds);
          const stats = statsAt(script, script.events, 90, fixture.matchId);

          for (const event of script.events) kinds.add(event.kind);

          expect(releases).toEqual([...releases].sort((a, b) => a - b));
          expect(script.events[0]?.kind).toBe("KICK_OFF");
          expect(script.events.at(-1)?.kind).toBe("FULL_TIME");
          expect(script.events.filter((e) => e.kind === "OFFSIDE" && e.side === "HOME")).toHaveLength(stats.home.offsides);
          expect(script.events.filter((e) => e.kind === "FOUL" && e.side === "AWAY").length).toBeLessThanOrEqual(stats.away.fouls);

          for (const own of script.events.filter((e) => e.kind === "OWN_GOAL")) {
            const conceding = own.side === "HOME" ? fixture.home : fixture.away;

            expect(conceding.squad.some((p) => p.name === own.player)).toBe(true);
          }
        }
      }
    }

    for (const kind of ["PENALTY_GOAL", "OWN_GOAL", "PENALTY_MISSED", "VAR", "OFFSIDE", "FOUL"]) expect(kinds, kind).toContain(kind);
  });

  it("prices every open market with a bookmaker margin, never a give-away", () => {
    const competition = COMPETITIONS[1];

    if (competition === undefined) throw new Error("no competition");

    const [fixture] = fixturesForRound(competition, currentRound(competition, NOW) + 2);

    if (fixture === undefined) throw new Error("no fixture");

    const result = marketsFor(fixture, NOW).markets.find((m) => m.kind === "MATCH_RESULT");

    if (result === undefined) throw new Error("no match result market");

    const implied = result.selections.reduce((sum, s) => sum + 1 / s.odds, 0);

    expect(result.selections).toHaveLength(3);
    expect(implied).toBeGreaterThan(1.02);
    expect(implied).toBeLessThan(1.15);
    for (const s of result.selections) expect(s.odds).toBeGreaterThan(1);
  });
});
