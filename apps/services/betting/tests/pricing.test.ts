import { describe, expect, it } from "vitest";
import {
  formatHundredths,
  parseHundredths,
  priceSlip,
  submittedHundredths,
} from "../src/utils/index.js";

describe("slip pricing", () => {
  it("prices a single exactly where a float would lose a kobo", () => {
    expect(priceSlip(50_000, [215])).toEqual({
      totalOddsHundredths: 215,
      potentialPayout: 107_500,
    });

    expect(Math.floor(100 * 1.15)).toBe(114);
    expect(priceSlip(100, [115])?.potentialPayout).toBe(115);

    expect(Math.floor(100 * 4.35)).toBe(434);
    expect(priceSlip(100, [435])?.potentialPayout).toBe(435);
  });

  it("prices three legs from the integer product, flooring once", () => {
    // 215 × 340 × 185 = 13 523 500 → 13.5235
    expect(priceSlip(10_000, [215, 340, 185])).toEqual({
      totalOddsHundredths: 1352,
      potentialPayout: 135_235,
    });

    // 1.1³ = 1.331: the payout floors to 1 kobo, never rounds up to 2.
    expect(priceSlip(1, [110, 110, 110])).toEqual({
      totalOddsHundredths: 133,
      potentialPayout: 1,
    });

    expect(priceSlip(33_333, [129, 187, 301])?.potentialPayout).toBe(
      Number((33_333n * 129n * 187n * 301n) / 1_000_000n),
    );
  });

  it("refuses a product too large to store or to carry in JSON", () => {
    expect(priceSlip(1_000_000, Array.from({ length: 20 }, () => 100_000))).toBeUndefined();
  });

  it("rejects odds at or below 1.00 and a non-integer stake", () => {
    expect(() => priceSlip(100, [100])).toThrow();
    expect(() => priceSlip(10.5, [200])).toThrow();
  });

  it("reads and writes decimal text without a float", () => {
    expect(parseHundredths("2.15")).toBe(215);
    expect(parseHundredths("3.4")).toBe(340);
    expect(parseHundredths("11")).toBe(1100);
    expect(formatHundredths(215)).toBe("2.15");
    expect(formatHundredths(1005)).toBe("10.05");
    expect(() => parseHundredths("2.155")).toThrow();
  });

  it("maps a submitted price to hundredths only when it has two decimals", () => {
    expect(submittedHundredths(2.15)).toBe(215);
    expect(submittedHundredths(1.1)).toBe(110);
    expect(submittedHundredths(2.155)).toBeUndefined();
  });
});
