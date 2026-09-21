import { describe, expect, it } from "vitest";
import {
  decodeBase32,
  encodeBase32,
  generateTotp,
  hotp,
  totpStep,
  verifyTotp,
} from "../src/utils/index.js";

const RFC_KEY = Buffer.from("12345678901234567890", "ascii");
const RFC_SECRET = encodeBase32(RFC_KEY);

describe("RFC 4226 HOTP", () => {
  it("matches the appendix D vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];

    expect(expected.map((_, counter) => hotp(RFC_KEY, counter))).toEqual(expected);
  });
});

describe("RFC 6238 TOTP (SHA-1)", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches the appendix B vector at t=%i", (seconds, expected) => {
    expect(hotp(RFC_KEY, totpStep(seconds * 1000), 8)).toBe(expected);
    expect(generateTotp(RFC_SECRET, seconds * 1000)).toBe(expected.slice(2));
  });

  it("round-trips base32", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(decodeBase32(RFC_SECRET).equals(RFC_KEY)).toBe(true);
    expect(() => decodeBase32("not*base32")).toThrow();
  });
});

describe("verifyTotp", () => {
  const atMs = 1_234_567_890_000;
  const step = totpStep(atMs);
  const check = (code: string, lastUsedStep?: number): number | undefined =>
    verifyTotp({ secretBase32: RFC_SECRET, code, atMs, lastUsedStep });

  it("accepts the current step and one step either side", () => {
    expect(check(hotp(RFC_KEY, step))).toBe(step);
    expect(check(hotp(RFC_KEY, step - 1))).toBe(step - 1);
    expect(check(hotp(RFC_KEY, step + 1))).toBe(step + 1);
  });

  it("refuses codes outside the window and malformed codes", () => {
    expect(check(hotp(RFC_KEY, step - 2))).toBeUndefined();
    expect(check(hotp(RFC_KEY, step + 2))).toBeUndefined();
    expect(check("12345")).toBeUndefined();
    expect(check("12345a")).toBeUndefined();
    expect(check("١٢٣٤٥٦")).toBeUndefined();
  });

  it("refuses a code whose step was already used", () => {
    const code = hotp(RFC_KEY, step);

    expect(check(code, step - 1)).toBe(step);
    expect(check(code, step)).toBeUndefined();
    expect(check(code, step + 1)).toBeUndefined();
  });
});
