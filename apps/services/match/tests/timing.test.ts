import { describe, expect, it } from "vitest";
import { DEFAULT_TIMING, readTiming } from "../src/configs/index.js";
import {
  alignToLeagueGrid,
  fullTimeMs,
  minuteAtMs,
  revealInstantMs,
} from "../src/utils/index.js";

const KICKOFF_MS = Date.parse("2026-09-21T12:00:00.000Z");

/** docs/architecture.md §5 with its defaults: 2 s per minute, 15 s half time. */
function expectedInstant(minute: number): number {
  return minute <= 45
    ? KICKOFF_MS + minute * 2000
    : KICKOFF_MS + 45 * 2000 + 15_000 + (minute - 45) * 2000;
}

function expectedMinute(elapsedSeconds: number): number {
  if (elapsedSeconds < 0) return 0;
  if (elapsedSeconds < 90) return Math.floor(elapsedSeconds / 2);
  if (elapsedSeconds < 105) return 45;

  return Math.min(90, 45 + Math.floor((elapsedSeconds - 105) / 2));
}

describe("match timing", () => {
  it("defaults to the architecture's constants", () => {
    expect(readTiming({})).toEqual(DEFAULT_TIMING);
    expect(DEFAULT_TIMING).toEqual({
      secondsPerMinute: 2,
      halfTimeSeconds: 15,
      bettingCloseLeadSeconds: 10,
      roundCycleSeconds: 240,
      leagueStaggerSeconds: 60,
      upcomingRounds: 3,
    });
  });

  it("reveals every minute at its instant", () => {
    for (let minute = 0; minute <= 90; minute += 1) {
      expect(
        revealInstantMs(KICKOFF_MS, { minute, type: "GOAL" }, DEFAULT_TIMING),
      ).toBe(expectedInstant(minute));
    }
  });

  it("puts full time at kickoff + 90*spm + half time", () => {
    expect(fullTimeMs(KICKOFF_MS, DEFAULT_TIMING)).toBe(KICKOFF_MS + 195_000);
    expect(expectedInstant(90)).toBe(KICKOFF_MS + 195_000);
    expect(expectedInstant(10)).toBe(KICKOFF_MS + 20_000);
    expect(expectedInstant(46)).toBe(KICKOFF_MS + 107_000);
    expect(
      revealInstantMs(
        KICKOFF_MS,
        { minute: 90, type: "FULL_TIME" },
        DEFAULT_TIMING,
      ),
    ).toBe(KICKOFF_MS + 195_000);
  });

  it("never reveals the restart during the break", () => {
    const restart = KICKOFF_MS + (45 * 2 + 15) * 1000;

    expect(
      revealInstantMs(
        KICKOFF_MS,
        { minute: 45, type: "SECOND_HALF" },
        DEFAULT_TIMING,
      ),
    ).toBe(restart);
    expect(
      revealInstantMs(
        KICKOFF_MS,
        { minute: 45, type: "HALF_TIME" },
        DEFAULT_TIMING,
      ),
    ).toBe(KICKOFF_MS + 90_000);
  });

  it("reads the current minute off the same clock", () => {
    for (const elapsedSeconds of [
      -5, 0, 1, 61, 89.9, 90, 100, 105, 150, 194.9, 195, 400,
    ]) {
      const now = KICKOFF_MS + elapsedSeconds * 1000;

      expect(minuteAtMs(KICKOFF_MS, now, DEFAULT_TIMING)).toBe(
        expectedMinute(elapsedSeconds),
      );
    }
  });

  it("accepts a fractional seconds-per-minute and rejects nonsense", () => {
    expect(
      readTiming({ MATCH_SECONDS_PER_MINUTE: "0.05" }).secondsPerMinute,
    ).toBe(0.05);
    expect(() => readTiming({ MATCH_SECONDS_PER_MINUTE: "fast" })).toThrow();
    expect(() => readTiming({ UPCOMING_ROUNDS: "2.5" })).toThrow();
  });

  it("keeps each league on its own stagger", () => {
    const cycleMs = DEFAULT_TIMING.roundCycleSeconds * 1000;

    for (const stagger of [0, 60, 120, 180]) {
      const kickoff = alignToLeagueGrid(
        KICKOFF_MS + 1234,
        stagger,
        DEFAULT_TIMING,
      );

      expect(kickoff).toBeGreaterThanOrEqual(KICKOFF_MS + 1234);
      expect(kickoff - (KICKOFF_MS + 1234)).toBeLessThan(cycleMs);
      expect(kickoff % cycleMs).toBe(stagger * 1000);
      expect(alignToLeagueGrid(kickoff, stagger, DEFAULT_TIMING)).toBe(kickoff);
    }
  });
});
