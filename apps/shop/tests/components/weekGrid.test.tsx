import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MarketView, MatchMarketsView, MatchSummary } from "@betng/ui-core";
import { WeekGrid, moveCell, type GridGroup } from "../../src/components/WeekGrid";

const GROUPS: readonly GridGroup[] = [
  {
    key: "1x2",
    title: "Match Result",
    columns: [
      { key: "1", header: "1", label: "Match result, home win", kind: "MATCH_RESULT", selectionCode: "HOME" },
      { key: "x", header: "X", label: "Match result, draw", kind: "MATCH_RESULT", selectionCode: "DRAW" },
    ],
  },
  {
    key: "dc",
    title: "Double Chance",
    columns: [{ key: "1x", header: "1X", label: "Double chance, home or draw", kind: "DOUBLE_CHANCE", selectionCode: "HOME_DRAW" }],
  },
];

function team(code: string, name: string) {
  return { id: code, leagueId: "l1", name, shortName: name, code, city: name, stadium: name, colors: { primary: "#111111", secondary: "#eeeeee", onPrimary: "#ffffff" }, strength: 50 };
}

function match(id: string, home: [string, string], away: [string, string]): MatchSummary {
  return { id, home: team(...home), away: team(...away), phase: "BETTING_OPEN" } as unknown as MatchSummary;
}

function market(matchId: string, kind: MarketView["kind"], name: string, selections: readonly [string, string, number][]): MarketView {
  return {
    id: `${matchId}-${kind}`,
    matchId,
    kind,
    name,
    status: "OPEN",
    columns: selections.length,
    selections: selections.map(([code, label, odds]) => ({ id: `${matchId}-${code}`, marketId: `${matchId}-${kind}`, code, label, shortLabel: code, odds, probability: 1 / odds, trend: "FLAT" })),
  } as unknown as MarketView;
}

const MATCHES = [match("m1", ["ARS", "Arsenal"], ["CHE", "Chelsea"]), match("m2", ["LIV", "Liverpool"], ["EVE", "Everton"])];

const MARKETS = new Map<string, MatchMarketsView>(
  MATCHES.map((m) => [
    m.id,
    {
      matchId: m.id,
      generatedAt: new Date().toISOString(),
      markets: [
        market(m.id, "MATCH_RESULT", "Match Result", [["HOME", "Home", 2.1], ["DRAW", "Draw", 3.3]]),
        ...(m.id === "m1" ? [market(m.id, "DOUBLE_CHANCE", "Double Chance", [["HOME_DRAW", "Home or Draw", 1.35]])] : []),
      ],
    },
  ]),
);

function renderGrid(props: { readonly bettable?: boolean } = {}) {
  const onToggle = vi.fn();

  render(
    <WeekGrid
      matches={MATCHES}
      marketsById={MARKETS}
      groups={GROUPS}
      bettable={props.bettable ?? true}
      expandedId={undefined}
      onExpand={vi.fn()}
      isSelected={() => false}
      onToggle={onToggle}
    />,
  );

  return { onToggle, grid: screen.getByRole("grid") };
}

describe("WeekGrid", () => {
  it("names every code column and odds button by the market and selection it stands for", () => {
    const { grid } = renderGrid();

    expect(within(grid).getByRole("columnheader", { name: "1X, Double chance, home or draw" })).toBeInTheDocument();
    expect(within(grid).getByRole("button", { name: "Event 1, Arsenal v Chelsea, Double Chance, Home or Draw, 1.35" })).toBeInTheDocument();
    expect(within(grid).getByRole("button", { name: "Event 2, Liverpool v Everton, Match Result, Draw, 3.30" })).toBeInTheDocument();
    expect(within(grid).getByRole("button", { name: "Show all markets, event 1, Arsenal v Chelsea" })).toBeInTheDocument();
    expect(within(grid).getByText("Not available").closest("td")).toHaveAttribute("tabindex", "-1");
  });

  it("is a single tab stop that the arrow keys move around", async () => {
    const user = userEvent.setup();
    const { grid, onToggle } = renderGrid();
    const cell = (name: RegExp) => within(grid).getByRole("button", { name });

    expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    await user.tab();
    expect(cell(/^Event 1, .*Match Result, Home,/)).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(cell(/^Event 1, .*Match Result, Draw,/)).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(cell(/^Event 2, .*Match Result, Draw,/)).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(within(grid).getByText("Not available").closest("td")).toHaveFocus();

    await user.keyboard("{Home}");
    expect(cell(/^Show all markets, event 2/)).toHaveFocus();

    await user.keyboard("{Control>}{Home}{/Control}{End}");
    expect(cell(/^Event 1, .*Double Chance/)).toHaveFocus();
    expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    await user.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("keeps closed prices reachable but inert", async () => {
    const user = userEvent.setup();
    const { grid, onToggle } = renderGrid({ bettable: false });
    const first = within(grid).getByRole("button", { name: /^Event 1, .*Match Result, Home,/ });

    expect(first).toHaveAttribute("aria-disabled", "true");

    await user.tab();
    expect(first).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("moveCell", () => {
  it("clamps at the edges", () => {
    expect(moveCell({ row: 0, col: 0 }, "ArrowUp", false, 3, 4)).toEqual({ row: 0, col: 0 });
    expect(moveCell({ row: 2, col: 3 }, "ArrowRight", false, 3, 4)).toEqual({ row: 2, col: 3 });
    expect(moveCell({ row: 1, col: 2 }, "End", true, 3, 4)).toEqual({ row: 2, col: 3 });
    expect(moveCell({ row: 1, col: 2 }, "Tab", false, 3, 4)).toBeUndefined();
  });
});
