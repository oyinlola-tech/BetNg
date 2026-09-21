import { describe, expect, it } from "vitest";
import { FULL_TIME_SECONDS, instantAtMinute, matchClock, VIRTUAL_TIMING } from "../../../../packages/ui-core/src/timing.js";
import { DEFAULT_TIMING, readTiming } from "../src/configs/index.js";
import { alignToLeagueGrid, fullTimeMs, minuteAtMs, revealInstantMs } from "../src/utils/index.js";

const KICKOFF = "2026-09-21T12:00:00.000Z";
const KICKOFF_MS = Date.parse(KICKOFF);

describe("match timing", () => {
  it("defaults to the constants the clients draw the clock with", () => {
    expect(DEFAULT_TIMING.secondsPerMinute).toBe(VIRTUAL_TIMING.secondsPerMinute);
    expect(DEFAULT_TIMING.halfTimeSeconds).toBe(VIRTUAL_TIMING.halfTimeSeconds);
    expect(DEFAULT_TIMING.bettingCloseLeadSeconds).toBe(VIRTUAL_TIMING.bettingCloseLeadSeconds);
    expect(readTiming({})).toEqual(DEFAULT_TIMING);
  });

  it("reveals every minute at the instant the client clock reaches it", () => {
    for (let minute = 0; minute <= 90; minute += 1) {
      expect(revealInstantMs(KICKOFF_MS, { minute, type: "GOAL" }, DEFAULT_TIMING)).toBe(instantAtMinute(KICKOFF, minute));
    }
  });

  it("puts full time at kickoff + 90*spm + half time", () => {
    expect(fullTimeMs(KICKOFF_MS, DEFAULT_TIMING)).toBe(KICKOFF_MS + FULL_TIME_SECONDS * 1000);
    expect(revealInstantMs(KICKOFF_MS, { minute: 90, type: "FULL_TIME" }, DEFAULT_TIMING)).toBe(KICKOFF_MS + 195_000);
  });

  it("never reveals the restart during the break", () => {
    const restart = KICKOFF_MS + (45 * 2 + 15) * 1000;

    expect(revealInstantMs(KICKOFF_MS, { minute: 45, type: "SECOND_HALF" }, DEFAULT_TIMING)).toBe(restart);
    expect(revealInstantMs(KICKOFF_MS, { minute: 45, type: "HALF_TIME" }, DEFAULT_TIMING)).toBe(KICKOFF_MS + 90_000);
  });

  it("agrees with the client clock on the current minute", () => {
    for (const elapsedSeconds of [-5, 0, 1, 61, 89.9, 90, 100, 105, 150, 194.9, 195, 400]) {
      const now = KICKOFF_MS + elapsedSeconds * 1000;

      expect(minuteAtMs(KICKOFF_MS, now, DEFAULT_TIMING)).toBe(matchClock(KICKOFF, now).minute);
    }
  });

  it("accepts a fractional seconds-per-minute and rejects nonsense", () => {
    expect(readTiming({ MATCH_SECONDS_PER_MINUTE: "0.05" }).secondsPerMinute).toBe(0.05);
    expect(() => readTiming({ MATCH_SECONDS_PER_MINUTE: "fast" })).toThrow();
    expect(() => readTiming({ UPCOMING_ROUNDS: "2.5" })).toThrow();
  });

  it("keeps each league on its own stagger", () => {
    const cycleMs = DEFAULT_TIMING.roundCycleSeconds * 1000;

    for (const stagger of [0, 60, 120, 180]) {
      const kickoff = alignToLeagueGrid(KICKOFF_MS + 1234, stagger, DEFAULT_TIMING);

      expect(kickoff).toBeGreaterThanOrEqual(KICKOFF_MS + 1234);
      expect(kickoff - (KICKOFF_MS + 1234)).toBeLessThan(cycleMs);
      expect(kickoff % cycleMs).toBe(stagger * 1000);
      expect(alignToLeagueGrid(kickoff, stagger, DEFAULT_TIMING)).toBe(kickoff);
    }
  });
});
