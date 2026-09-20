import { describe, expect, it } from "vitest";
import { MAX_SELECTIONS, STAKE_LIMITS, combinedOdds, parseStakeInput, slipTotals, toggleSelection, validateSlip } from "../src/betslip.js";
import type { SlipSelection } from "../src/types/index.js";

const pick = (match: string, selection: string, odds: number): SlipSelection =>
  ({
    selectionId: selection,
    marketId: `${match}-m`,
    matchId: match,
    marketKind: "MATCH_RESULT",
    marketName: "Match Result",
    selectionLabel: selection,
    odds,
    matchLabel: match,
    leagueCode: "EPL",
    kickoffAt: "2026-09-20T12:00:00.000Z",
  }) as unknown as SlipSelection;

describe("bet slip", () => {
  it("adds, then removes, the same selection", () => {
    const one = toggleSelection([], pick("a", "a-home", 2));

    expect(one).toHaveLength(1);
    expect(toggleSelection(one, pick("a", "a-home", 2))).toHaveLength(0);
  });

  it("keeps one selection per match: a second pick replaces the first", () => {
    const slip = toggleSelection(toggleSelection([], pick("a", "a-home", 2)), pick("a", "a-draw", 3.4));

    expect(slip.map((s) => s.selectionId)).toEqual(["a-draw"]);
  });

  it("refuses to grow past the selection limit", () => {
    let slip: readonly SlipSelection[] = [];

    for (let i = 0; i < MAX_SELECTIONS + 3; i += 1) slip = toggleSelection(slip, pick(`m${String(i)}`, `s${String(i)}`, 1.5));

    expect(slip).toHaveLength(MAX_SELECTIONS);
  });

  it("multiplies odds and rounds to two places", () => {
    expect(combinedOdds([pick("a", "1", 1.85), pick("b", "2", 2.1), pick("c", "3", 3.333)])).toBe(12.95);
    expect(combinedOdds([])).toBe(0);
  });

  it("computes return and profit in minor units", () => {
    expect(slipTotals([pick("a", "1", 2.5)], 20_000)).toMatchObject({ totalOdds: 2.5, potentialReturn: 50_000, potentialProfit: 30_000 });
  });

  it("validates in order: empty, minimum, maximum, balance", () => {
    const slip = [pick("a", "1", 2)];

    expect(validateSlip([], 20_000, 1e9)).toBe("EMPTY");
    expect(validateSlip(slip, STAKE_LIMITS.min - 1, 1e9)).toBe("BELOW_MIN");
    expect(validateSlip(slip, STAKE_LIMITS.max + 1, 1e12)).toBe("ABOVE_MAX");
    expect(validateSlip(slip, 20_000, 10_000)).toBe("INSUFFICIENT");
    expect(validateSlip(slip, 20_000, 20_000)).toBeUndefined();
  });

  it("parses typed naira into kobo and ignores noise", () => {
    expect(parseStakeInput("₦1,250.50")).toBe(125_050);
    expect(parseStakeInput("")).toBe(0);
    expect(parseStakeInput(".")).toBe(0);
  });
});
