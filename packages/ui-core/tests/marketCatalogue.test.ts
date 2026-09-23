import { describe, expect, it } from "vitest";
import {
  MARKET_GROUP_ORDER,
  groupMarkets,
  isKnownMarketKind,
  marketShape,
  marketTitle,
  sortMarkets,
} from "../src/markets/catalogue.js";
import type { MarketView, SelectionView } from "../src/types/index.js";

function selection(id: string): SelectionView {
  return {
    id: id as SelectionView["id"],
    marketId: "m" as SelectionView["marketId"],
    code: id,
    label: id,
    shortLabel: id,
    odds: 2,
    probability: 0.5,
    trend: "STEADY",
  };
}

function market(
  kind: string,
  extra: Partial<MarketView> = {},
  selections = 2,
): MarketView {
  const shape = marketShape(kind, selections);

  return {
    id: `${kind}-${String(extra.line ?? 0)}` as MarketView["id"],
    matchId: "match" as MarketView["matchId"],
    kind,
    name: shape.name,
    status: "OPEN",
    columns: shape.columns,
    group: shape.group,
    selections: Array.from({ length: selections }, (_, i) =>
      selection(`s${String(i)}`),
    ),
    ...extra,
  };
}

describe("market shape", () => {
  it("names, groups and lays out a kind it knows", () => {
    expect(marketShape("MATCH_RESULT")).toMatchObject({
      name: "Match Result",
      group: "MAIN",
      columns: 3,
    });
    expect(marketShape("HALF_TIME_FULL_TIME").group).toBe("HALF");
    expect(marketShape("TOTAL_CORNERS").group).toBe("SPECIALS");
  });

  it("renders a kind the platform invented after this build shipped", () => {
    const shape = marketShape("PLAYER_SHOTS_ON_TARGET", 4);

    expect(isKnownMarketKind("PLAYER_SHOTS_ON_TARGET")).toBe(false);
    expect(shape.name).toBe("Player Shots On Target");
    expect(shape.group).toBe("SPECIALS");
    expect(shape.columns).toBe(2);
  });

  it("reads a half-time market as Half even when it also names a specials subject", () => {
    expect(marketShape("HALF_TIME_TOTAL_CORNERS").group).toBe("HALF");
  });

  it("falls back to More only when nothing in the name is recognisable", () => {
    expect(marketShape("ZZZ_UNKNOWABLE").group).toBe("OTHER");
  });

  it("lays an unknown kind out from how many selections it has", () => {
    expect(marketShape("X", 2).columns).toBe(2);
    expect(marketShape("X", 3).columns).toBe(3);
    expect(marketShape("X", 4).columns).toBe(2);
    expect(marketShape("X", 12).columns).toBe(3);
  });
});

describe("market title", () => {
  it("adds the line when the name does not already carry it", () => {
    expect(marketTitle({ name: "Total Goals", line: 2.5 })).toBe(
      "Total Goals 2.5",
    );
    expect(marketTitle({ name: "Total Goals 2.5", line: 2.5 })).toBe(
      "Total Goals 2.5",
    );
    expect(marketTitle({ name: "Match Result", line: undefined })).toBe(
      "Match Result",
    );
  });
});

describe("grouping", () => {
  it("groups in catalogue order and leaves out groups with no markets", () => {
    const groups = groupMarkets([
      market("CORRECT_SCORE", {}, 5),
      market("MATCH_RESULT", {}, 3),
      market("OVER_UNDER", { line: 2.5 }),
    ]);

    expect(groups.map((g) => g.key)).toEqual(["MAIN", "GOALS", "SCORE"]);
    expect(MARKET_GROUP_ORDER).toContain("TEAMS");
  });

  it("honours a group the platform sent over the one the kind implies", () => {
    const placed = market("TOTAL_CORNERS", { group: "MAIN" });

    expect(groupMarkets([placed])[0]?.key).toBe("MAIN");
  });

  it("orders goal lines low to high inside their group", () => {
    const sorted = sortMarkets([
      market("OVER_UNDER", { line: 3.5 }),
      market("OVER_UNDER", { line: 0.5 }),
      market("OVER_UNDER", { line: 2.5 }),
    ]);

    expect(sorted.map((m) => m.line)).toEqual([0.5, 2.5, 3.5]);
  });

  it("puts the everyday markets ahead of the exotic ones", () => {
    const sorted = sortMarkets([
      market("BOTH_TEAMS_TO_SCORE"),
      market("OVER_UNDER", { line: 1.5 }),
    ]);

    expect(sorted.map((m) => m.kind)).toEqual([
      "OVER_UNDER",
      "BOTH_TEAMS_TO_SCORE",
    ]);
  });

  it("sorts an unknown kind after everything it knows", () => {
    const sorted = sortMarkets([
      market("SOMETHING_NEW"),
      market("MATCH_RESULT", {}, 3),
    ]);

    expect(sorted[0]?.kind).toBe("MATCH_RESULT");
  });
});
