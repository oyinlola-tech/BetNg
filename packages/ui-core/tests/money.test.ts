import { afterEach, describe, expect, it } from "vitest";
import {
  configureCurrency,
  estimateReturn,
  formatCurrency,
  formatMoney,
  formatMoneyCompact,
  formatSignedMoney,
  multiplyOdds,
  parseMoney,
} from "../src/money.js";

const NGN = { code: "NGN", symbol: "₦", minorUnits: 2, locale: "en-NG" };

afterEach(() => {
  configureCurrency(NGN);
});

describe("money", () => {
  it("formats minor units without passing through a float", () => {
    expect(formatMoney(50_000)).toBe("₦500.00");
    expect(formatMoney(1_250_050)).toBe("₦12,500.50");
    expect(formatMoney(-100_001)).toBe("-₦1,000.01");
    expect(formatMoney(9_007_199_254_740_991)).toBe("₦90,071,992,547,409.91");
  });

  it("signs a ledger amount and rounds a compact one", () => {
    expect(formatSignedMoney(420_000)).toBe("+₦4,200.00");
    expect(formatSignedMoney(-100_000)).toBe("-₦1,000.00");
    expect(formatMoneyCompact(1_249_950)).toBe("₦12,500");
  });

  it("follows the platform's currency configuration", () => {
    configureCurrency({ code: "JPY", symbol: "¥", minorUnits: 0, locale: "ja-JP" });

    expect(formatMoney(1500)).toBe("¥1,500");
    expect(formatCurrency({ amount: 1500, currency: "JPY" })).toBe("¥1,500");
    expect(formatCurrency({ amount: 1500, currency: "USD" })).toBe("USD 1,500");
  });

  it("parses typed amounts digit by digit", () => {
    expect(parseMoney("500")).toBe(50_000);
    expect(parseMoney("1,250.5")).toBe(125_050);
    expect(parseMoney("₦ 0.07")).toBe(7);
    expect(parseMoney("19.999")).toBe(1_999);
    expect(parseMoney("")).toBeUndefined();
    expect(parseMoney("12.3.4")).toBeUndefined();
    expect(parseMoney("-5")).toBeUndefined();
  });

  it("never produces a fractional minor unit", () => {
    for (const stake of [1, 33, 50_000, 123_457, 50_000_000]) {
      for (const odds of [[1.01], [2.1, 3.333], [1.85, 2.1, 3.35, 1.4], [999.99]]) {
        expect(Number.isInteger(estimateReturn(stake, odds))).toBe(true);
      }
    }
  });

  it("multiplies prices exactly where floats drift", () => {
    expect(multiplyOdds([1.1, 1.1, 1.1])).toBe(1.33);
    expect(multiplyOdds([1.85, 2.1, 3.333])).toBe(12.95);
    expect(estimateReturn(10_000, [1.1, 1.1, 1.1])).toBe(13_310);
    expect(estimateReturn(50_000, [2.15])).toBe(107_500);
    expect(estimateReturn(0, [2])).toBe(0);
    expect(estimateReturn(1_000, [])).toBe(0);
  });
});
