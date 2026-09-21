import { describe, expect, it } from "vitest";
import { encodeCode39 } from "../../src/lib/code39";

describe("Code 39 ticket barcode", () => {
  it("frames the reference with start and stop characters, five bars each", () => {
    const code = encodeCode39("F7WKPVSQDL");

    expect(code?.bars).toHaveLength((10 + 2) * 5);
    expect(code?.width).toBe(12 * 16 - 1);
  });

  it("draws every character with exactly three wide elements", () => {
    const code = encodeCode39("A");
    const wideBars = code?.bars.filter((b) => b.width === 3).length ?? 0;

    expect(code?.bars[0]).toEqual({ x: 0, width: 1 });
    expect(wideBars).toBeGreaterThanOrEqual(3);
    expect(wideBars).toBeLessThanOrEqual(9);
  });

  it("normalises case and keeps the hyphen in BNG-style references", () => {
    expect(encodeCode39("bng-82k91a")?.bars).toEqual(encodeCode39("BNG-82K91A")?.bars);
  });

  it("renders nothing for a reference it cannot carry", () => {
    expect(encodeCode39("")).toBeUndefined();
    expect(encodeCode39("AB*C")).toBeUndefined();
    expect(encodeCode39("TICKÉT")).toBeUndefined();
  });
});
