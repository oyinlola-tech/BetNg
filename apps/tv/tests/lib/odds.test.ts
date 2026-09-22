import { describe, expect, it } from "vitest";
import type { MatchSummary } from "@betng/ui-core";
import { advanceTicker, EMPTY_TICKER, formatImplied, impliedProbability, movementOf, snapshotOf, tickerEntries } from "../../src/lib/odds";
import { match, resultMarket } from "../fakes/platform";

const upcoming = (id: string, phase: MatchSummary["phase"] = "BETTING_OPEN"): MatchSummary => {
  const { events: _e, stats: _s, ...summary } = match(id, { phase, status: "BETTING_OPEN" });

  return summary;
};

describe("TV odds ticker", () => {
  it("shows implied probability as 1/odds", () => {
    expect(impliedProbability(2)).toBe(0.5);
    expect(formatImplied(4)).toBe("25.0%");
    expect(formatImplied(1)).toBe("–");
    expect(formatImplied(Number.NaN)).toBe("–");
  });

  it("computes movement against the previous snapshot shown and flags moves over 10%", () => {
    expect(movementOf(2, undefined).movement).toBe("NEW");
    expect(movementOf(2, 2).movement).toBe("STEADY");
    expect(movementOf(2.1, 2)).toMatchObject({ movement: "UP", big: false });
    expect(movementOf(2.3, 2)).toMatchObject({ movement: "UP", big: true });
    expect(movementOf(1.7, 2)).toMatchObject({ movement: "DOWN", big: true });
  });

  it("treats a repeated read of the same snapshot as no change", () => {
    const first = snapshotOf([resultMarket("m1", [2, 3, 4], "t1")]);
    const second = snapshotOf([resultMarket("m1", [2.4, 3, 3.9], "t2")]);
    let state = advanceTicker(EMPTY_TICKER, first);

    state = advanceTicker(state, snapshotOf([resultMarket("m1", [2, 3, 4], "t1")]));
    expect(state.previous).toBeUndefined();

    state = advanceTicker(state, second);
    expect(state.previous).toBe(first);
    expect(state.shown).toBe(second);

    state = advanceTicker(state, snapshotOf([resultMarket("m1", [2.4, 3, 3.9], "t2")]));
    expect(state.previous).toBe(first);

    const entries = tickerEntries([upcoming("m1")], new Map([["m1", resultMarket("m1", [2.4, 3, 3.9], "t2")]]), state.previous);
    const [home, draw, away] = entries[0]?.quotes ?? [];

    expect(home).toMatchObject({ label: "1", movement: "UP", big: true, implied: "41.7%" });
    expect(draw).toMatchObject({ label: "X", movement: "STEADY" });
    expect(away).toMatchObject({ label: "2", movement: "DOWN", big: false });
  });

  it("lists only matches with betting open and markets that are open", () => {
    const suspended = resultMarket("m2", [2, 3, 4]);
    const closed = { ...suspended, markets: suspended.markets.map((m) => ({ ...m, status: "SUSPENDED" as const })) };
    const markets = new Map([
      ["m1", resultMarket("m1", [2, 3, 4])],
      ["m2", closed],
      ["m3", resultMarket("m3", [2, 3, 4])],
    ]);

    expect(tickerEntries([upcoming("m1"), upcoming("m2"), upcoming("m3", "LIVE")], markets, undefined).map((e) => e.matchId)).toEqual(["m1"]);
  });
});
