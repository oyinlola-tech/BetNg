import { describe, expect, it } from "vitest";
import type { MarketView, MatchMarketsView, MatchSummary, SelectionView } from "@betng/ui-core";
import { QUICK_BET_LIMIT, bettable, marketsByMatch, quickBetFor, quickBetIds, slipSelectionFor } from "../../src/lib/quickBet";

const selection = (code: string, odds: number): SelectionView =>
  ({ id: `s-${code}`, marketId: "m-1", code, label: code, shortLabel: code, odds, probability: 0.3, trend: "STEADY" }) as unknown as SelectionView;

const market = (overrides: Partial<MarketView> = {}): MarketView =>
  ({
    id: "m-1",
    matchId: "match-1",
    kind: "MATCH_RESULT",
    name: "Match Result",
    status: "OPEN",
    columns: 3,
    group: "MAIN",
    updatedAt: "2026-09-27T10:00:00.000Z",
    selections: [selection("AWAY", 3.55), selection("HOME", 2.11), selection("DRAW", 3.17)],
    ...overrides,
  }) as unknown as MarketView;

const markets = (list: readonly MarketView[]): MatchMarketsView =>
  ({ matchId: "match-1", generatedAt: "2026-09-27T10:00:00.000Z", markets: list }) as unknown as MatchMarketsView;

const match = (id: string, phase: string): MatchSummary =>
  ({
    id,
    phase,
    leagueCode: "EPL",
    kickoffAt: "2026-09-27T10:05:00.000Z",
    bettingClosesAt: "2026-09-27T10:04:00.000Z",
    home: { name: "Arsenal" },
    away: { name: "Chelsea" },
  }) as unknown as MatchSummary;

describe("quick bet", () => {
  it("offers the match result as 1, X, 2 in that order, whatever order the platform sent", () => {
    const quick = quickBetFor(markets([market({ kind: "OVER_UNDER", id: "m-2" }), market()]));

    expect(quick?.selections.map((s) => [s.code, s.shortLabel, s.odds])).toEqual([
      ["HOME", "1", 2.11],
      ["DRAW", "X", 3.17],
      ["AWAY", "2", 3.55],
    ]);
    expect(quick?.otherMarkets).toBe(1);
  });

  it("offers nothing when the market is suspended, missing a price, or absent", () => {
    expect(quickBetFor(markets([market({ status: "SUSPENDED" })]))).toBeUndefined();
    expect(quickBetFor(markets([market({ selections: [selection("HOME", 2.11), selection("AWAY", 3.55)] })]))).toBeUndefined();
    expect(quickBetFor(markets([market({ kind: "OVER_UNDER" })]))).toBeUndefined();
    expect(quickBetFor(undefined)).toBeUndefined();
  });

  it("puts the match, the market and the price on the slip selection", () => {
    const m = market();

    expect(slipSelectionFor(match("match-1", "BETTING_OPEN"), m, selection("HOME", 2.11))).toMatchObject({
      selectionId: "s-HOME",
      marketId: "m-1",
      matchId: "match-1",
      marketKind: "MATCH_RESULT",
      odds: 2.11,
      matchLabel: "Arsenal v Chelsea",
      leagueCode: "EPL",
    });
  });

  it("asks for prices only for matches that can take a bet, and never more than the platform accepts", () => {
    const list = [match("a", "BETTING_OPEN"), match("b", "BETTING_CLOSED"), match("c", "LIVE"), match("d", "BETTING_OPEN")];

    expect(bettable(list).map((m) => m.id)).toEqual(["a", "d"]);
    expect(quickBetIds(list)).toEqual(["a", "d"]);
    expect(quickBetIds(Array.from({ length: 80 }, (_, i) => match(`m-${String(i)}`, "BETTING_OPEN")))).toHaveLength(QUICK_BET_LIMIT);
  });

  it("indexes prices by match", () => {
    expect(marketsByMatch([markets([market()])]).get("match-1")?.markets).toHaveLength(1);
    expect(marketsByMatch(undefined).size).toBe(0);
  });
});
