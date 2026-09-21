import { describe, expect, it } from "vitest";
import { parseFastbet } from "../src/fastbet.js";

const picks = (input: string) => {
  const result = parseFastbet(input, 10);

  if (!result.ok) throw new Error(result.error);

  return result.picks.map((p) => `${String(p.event)}:${p.kind}:${p.selectionCode}`);
};

describe("parseFastbet", () => {
  it("reads match result, double chance and both-teams codes", () => {
    expect(picks("3 1")).toEqual(["3:MATCH_RESULT:HOME"]);
    expect(picks("7x")).toEqual(["7:MATCH_RESULT:DRAW"]);
    expect(picks("10 2")).toEqual(["10:MATCH_RESULT:AWAY"]);
    expect(picks("4 1X")).toEqual(["4:DOUBLE_CHANCE:HOME_DRAW"]);
    expect(picks("4 12")).toEqual(["4:DOUBLE_CHANCE:HOME_AWAY"]);
    expect(picks("5 gg")).toEqual(["5:BOTH_TEAMS_TO_SCORE:YES"]);
    expect(picks("5-NG")).toEqual(["5:BOTH_TEAMS_TO_SCORE:NO"]);
  });

  it("reads totals in the spellings cashiers use", () => {
    expect(picks("2 O2.5")).toEqual(["2:OVER_UNDER:OVER_2_5"]);
    expect(picks("2 ov2.5")).toEqual(["2:OVER_UNDER:OVER_2_5"]);
    expect(picks("2 UN1.5")).toEqual(["2:OVER_UNDER:UNDER_1_5"]);
    expect(picks("2 under35")).toEqual(["2:OVER_UNDER:UNDER_3_5"]);
  });

  it("carries the line so the right total-goals market is found", () => {
    const result = parseFastbet("6 U3.5", 10);

    expect(result.ok && result.picks[0]?.line).toBe(3.5);
  });

  it("takes several bets at once", () => {
    expect(picks("1 1, 3 X; 7 GG")).toHaveLength(3);
  });

  it("does not confuse event 12 with the 12 double-chance code", () => {
    expect(parseFastbet("12 1", 10).ok).toBe(false);
    expect(picks("1 12")).toEqual(["1:DOUBLE_CHANCE:HOME_AWAY"]);
  });

  it("explains what is wrong instead of guessing", () => {
    expect(parseFastbet("", 10)).toMatchObject({ ok: false });
    expect(parseFastbet("11 1", 10)).toMatchObject({ ok: false, error: expect.stringContaining("no event 11") });
    expect(parseFastbet("3 ZZ", 10)).toMatchObject({ ok: false, error: expect.stringContaining("not a code") });
    expect(parseFastbet("home win", 10)).toMatchObject({ ok: false });
  });
});
