import { describe, expect, it } from "vitest";
import {
  basisPointsToPercentText,
  formatPeriodId,
  oddsToHundredths,
  percentToBasisPoints,
  periodSequence,
  resolveBet,
  splitCommission,
  toSafeNumber,
  utcDateKey,
} from "../src/utils/index.js";

describe("oddsToHundredths", () => {
  it("reads NUMERIC(8,2) text exactly", () => {
    expect(oddsToHundredths("2.50")).toBe(250n);
    expect(oddsToHundredths("2.5")).toBe(250n);
    expect(oddsToHundredths("1.01")).toBe(101n);
    expect(oddsToHundredths("3")).toBe(300n);
    expect(oddsToHundredths("999999.99")).toBe(99999999n);
  });

  it.each(["", "abc", "2.505", "-1.50", "0", "0.00", "1e3", "2,5"])("rejects %j", (odds) => {
    expect(() => oddsToHundredths(odds)).toThrow(RangeError);
  });
});

describe("resolveBet", () => {
  it("pays floor(stake * odds) for a single", () => {
    expect(resolveBet(10_000n, [{ outcome: "WON", odds: "1.85" }])).toEqual({ outcome: "WON", payout: 18_500n });
    expect(resolveBet(333n, [{ outcome: "WON", odds: "1.33" }])).toEqual({ outcome: "WON", payout: 442n });
  });

  it("multiplies the stored leg odds as integers, never floats", () => {
    // 1.10 * 1.10 * 1.10 = 1.331 exactly; in doubles 100 * 1.1 * 1.1 * 1.1 is 133.10000000000002.
    const legs = [
      { outcome: "WON", odds: "1.10" },
      { outcome: "WON", odds: "1.10" },
      { outcome: "WON", odds: "1.10" },
    ] as const;

    expect(resolveBet(100_000n, legs).payout).toBe(133_100n);
    expect(resolveBet(1_000n, legs).payout).toBe(1_331n);
    expect(resolveBet(999n, legs).payout).toBe(1_329n);
  });

  it("stays exact beyond what a double can hold", () => {
    const legs = Array.from({ length: 12 }, () => ({ outcome: "WON" as const, odds: "9.99" }));

    expect(resolveBet(9_007_199_254_740_993n, legs).payout).toBe(
      (9_007_199_254_740_993n * 999n ** 12n) / 100n ** 12n,
    );
  });

  it("treats a void leg as 1.00", () => {
    expect(
      resolveBet(5_000n, [
        { outcome: "WON", odds: "2.00" },
        { outcome: "VOID", odds: "7.50" },
        { outcome: "WON", odds: "1.50" },
      ]),
    ).toEqual({ outcome: "WON", payout: 15_000n });
  });

  it("loses when any leg loses, whatever else happened", () => {
    expect(
      resolveBet(5_000n, [
        { outcome: "WON", odds: "2.00" },
        { outcome: "VOID", odds: "3.00" },
        { outcome: "LOST", odds: "1.50" },
      ]),
    ).toEqual({ outcome: "LOST", payout: 0n });
  });

  it("returns the stake when every leg is void", () => {
    expect(
      resolveBet(7_777n, [
        { outcome: "VOID", odds: "2.00" },
        { outcome: "VOID", odds: "3.00" },
      ]),
    ).toEqual({ outcome: "VOID", payout: 7_777n });
  });

  it("refuses a negative stake and a bet without legs", () => {
    expect(() => resolveBet(-1n, [{ outcome: "WON", odds: "2.00" }])).toThrow(RangeError);
    expect(() => resolveBet(1n, [])).toThrow(RangeError);
  });
});

describe("splitCommission", () => {
  it("gives the shop floor(result * percent) of a positive result", () => {
    expect(splitCommission(300_000n, 2000)).toEqual({
      shopShareBasisPoints: 2000,
      shopShareAmount: 60_000n,
      platformShareBasisPoints: 8000,
      platformShareAmount: 240_000n,
    });
    expect(splitCommission(999n, 1250).shopShareAmount).toBe(124n);
    expect(splitCommission(999n, 1250).platformShareAmount).toBe(875n);
  });

  it("leaves a negative result whole on the platform side", () => {
    expect(splitCommission(-100_000n, 2000)).toMatchObject({
      shopShareAmount: 0n,
      platformShareAmount: -100_000n,
    });
    expect(splitCommission(0n, 2000)).toMatchObject({ shopShareAmount: 0n, platformShareAmount: 0n });
  });

  it("converts percents without floats", () => {
    expect(percentToBasisPoints("20.00")).toBe(2000);
    expect(percentToBasisPoints(12.5)).toBe(1250);
    expect(percentToBasisPoints("0.07")).toBe(7);
    expect(percentToBasisPoints(100)).toBe(10_000);
    expect(basisPointsToPercentText(1250)).toBe("12.50");
    expect(basisPointsToPercentText(7)).toBe("0.07");
    expect(() => percentToBasisPoints("100.01")).toThrow(RangeError);
    expect(() => percentToBasisPoints(12.345)).toThrow(RangeError);
    expect(() => percentToBasisPoints("-1")).toThrow(RangeError);
  });
});

describe("periods and money", () => {
  it("formats SESSION-YYYYMMDD-NNNN in UTC", () => {
    const key = utcDateKey(new Date("2026-09-21T23:59:59.999Z"));

    expect(key).toBe("20260921");
    expect(formatPeriodId(key, 1)).toBe("SESSION-20260921-0001");
    expect(periodSequence("SESSION-20260921-0042")).toBe(42);
    expect(() => formatPeriodId(key, 10_000)).toThrow(RangeError);
  });

  it("refuses to round kobo into a JSON number", () => {
    expect(toSafeNumber(-100_000n)).toBe(-100_000);
    expect(() => toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });
});
