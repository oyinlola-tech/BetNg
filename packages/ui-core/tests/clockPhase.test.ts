import { describe, expect, it } from "vitest";
import { clockLabel, clockProgress, displayClock, isStale } from "../src/clock.js";
import { isInterrupted, isUpcoming, phaseLabel, resolvePhase } from "../src/phase.js";

const AS_OF = "2026-09-21T12:00:00.000Z";
const at = (ms: number): number => Date.parse(AS_OF) + ms;

describe("display clock", () => {
  it("is absent when the platform reported none", () => {
    expect(displayClock(undefined)).toBeUndefined();
  });

  it("shows the reported minute and does not advance without a minute length", () => {
    const clock = { period: "FIRST_HALF", minute: 23, asOf: AS_OF } as const;

    expect(displayClock(clock, at(600_000))?.minute).toBe(23);
  });

  it("advances between reports when the platform gives a minute length", () => {
    const clock = { period: "SECOND_HALF", minute: 60, asOf: AS_OF, minuteLengthMs: 2_000 } as const;

    expect(displayClock(clock, at(5_000))).toMatchObject({ minute: 62, second: 30, label: "62'" });
  });

  it("never runs past the end of the reported period", () => {
    const first = { period: "FIRST_HALF", minute: 44, asOf: AS_OF, minuteLengthMs: 2_000 } as const;
    const second = { period: "SECOND_HALF", minute: 89, asOf: AS_OF, minuteLengthMs: 2_000, addedMinutes: 3 } as const;

    expect(displayClock(first, at(60_000))).toMatchObject({ period: "FIRST_HALF", minute: 45 });
    expect(displayClock(second, at(60_000))).toMatchObject({ period: "SECOND_HALF", minute: 93, label: "90+3'" });
  });

  it("holds still at half time and full time", () => {
    const half = { period: "HALF_TIME", minute: 45, asOf: AS_OF, minuteLengthMs: 2_000 } as const;

    expect(displayClock(half, at(30_000))).toMatchObject({ minute: 45, label: "HT" });
    expect(clockLabel("FULL_TIME", 90)).toBe("FT");
  });

  it("reports progress and staleness", () => {
    expect(clockProgress({ period: "SECOND_HALF", minute: 45, second: 0, label: "45'" })).toBe(0.5);
    expect(isStale(AS_OF, at(20_000), 15_000)).toBe(true);
    expect(isStale(AS_OF, at(5_000), 15_000)).toBe(false);
    expect(isStale(undefined, at(5_000), 15_000)).toBe(false);
  });
});

describe("phase resolution", () => {
  it("takes no time input: in play is live until the platform reports half time", () => {
    expect(resolvePhase("IN_PLAY")).toBe("LIVE");
    expect(resolvePhase("IN_PLAY", { period: "HALF_TIME" })).toBe("HALFTIME");
    expect(resolvePhase("IN_PLAY", { period: "SECOND_HALF" })).toBe("LIVE");
  });

  it("is settled only when the lifecycle says settlement completed", () => {
    expect(resolvePhase("COMPLETED")).toBe("FINISHED");
    expect(resolvePhase("COMPLETED", { lifecycle: "SETTLEMENT_STARTED" })).toBe("FINISHED");
    expect(resolvePhase("COMPLETED", { lifecycle: "SETTLEMENT_COMPLETED" })).toBe("SETTLED");
  });

  it("maps voided and failed lifecycles, and passes platform interruptions through", () => {
    expect(resolvePhase("COMPLETED", { lifecycle: "VOIDED" })).toBe("CANCELLED");
    expect(resolvePhase("IN_PLAY", { lifecycle: "SIMULATION_FAILED" })).toBe("SUSPENDED");
    expect(resolvePhase("POSTPONED")).toBe("POSTPONED");
    expect(isInterrupted("POSTPONED")).toBe(true);
    expect(isUpcoming("DELAYED")).toBe(true);
    expect(phaseLabel("SUSPENDED")).toBe("SUSP");
  });
});
