import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MarketView } from "@betng/ui-core";
import { MarketBoard } from "../../src/markets/MarketBoard";
import { market, selection } from "./fixtures";

/*
 * The board is the one market surface the web, the Shop and mobile all mount,
 * so what it does with a suspended market or a market type this build has
 * never seen is what all three do.
 */

const CATALOGUE: readonly MarketView[] = [
  market({
    id: "m-result" as MarketView["id"],
    kind: "MATCH_RESULT",
    name: "Match Result",
    group: undefined,
    columns: 3,
    selections: [
      selection("r-1", "Arsenal", 2.1),
      selection("r-2", "Draw", 3.2),
      selection("r-3", "Chelsea", 2.8),
    ],
  }),
  market({
    id: "m-ou" as MarketView["id"],
    kind: "OVER_UNDER",
    name: "Total Goals",
    group: undefined,
    line: 2.5,
    columns: 2,
    selections: [selection("o-1", "Over 2.5", 1.85), selection("o-2", "Under 2.5", 1.9)],
  }),
  market({
    id: "m-corners" as MarketView["id"],
    kind: "TOTAL_CORNERS",
    name: "Total Corners",
    group: undefined,
    columns: 2,
    selections: [selection("c-1", "Over 9.5", 1.7), selection("c-2", "Under 9.5", 2.05)],
  }),
  market({
    id: "m-exotic" as MarketView["id"],
    kind: "PLAYER_SHOTS_ON_TARGET",
    name: "Player Shots On Target",
    group: undefined,
    columns: 2,
    selections: [selection("x-1", "Over 1.5", 2.4), selection("x-2", "Under 1.5", 1.5)],
  }),
];

describe("MarketBoard", () => {
  it("offers only the groups the catalogue actually has", () => {
    render(
      <MarketBoard markets={CATALOGUE} selectedIds={new Set()} onToggle={vi.fn()} />,
    );

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    const labels = tabs.map((tab) => tab.textContent?.replace(/\d+$/, ""));

    expect(labels).toEqual(["All", "Main", "Goals", "Specials"]);
    // Nothing in this catalogue is a half or a handicap, so neither is offered.
    expect(labels).not.toContain("Half");
    expect(labels).not.toContain("Handicap");
  });

  it("counts the markets in each group from the data", () => {
    render(
      <MarketBoard markets={CATALOGUE} selectedIds={new Set()} onToggle={vi.fn()} />,
    );

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");

    expect(tabs[0]).toHaveTextContent("All4");
    expect(tabs[1]).toHaveTextContent("Main1");
  });

  it("renders a market type it has never seen rather than dropping or breaking it", () => {
    render(
      <MarketBoard markets={CATALOGUE} selectedIds={new Set()} onToggle={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "Player Shots On Target" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Over 1\.5/ })).toBeEnabled();
  });

  it("will not let a suspended market be selected", async () => {
    const onToggle = vi.fn();
    const suspended = market({
      id: "m-susp" as MarketView["id"],
      kind: "BOTH_TEAMS_TO_SCORE",
      name: "Both Teams To Score",
      group: undefined,
      status: "SUSPENDED",
      columns: 2,
      selections: [selection("b-1", "Yes", 1.72), selection("b-2", "No", 2.05)],
    });

    render(
      <MarketBoard markets={[suspended]} selectedIds={new Set()} onToggle={onToggle} />,
    );

    const yes = screen.getByRole("button", { name: /Yes/ });

    expect(yes).toBeDisabled();

    await userEvent.click(yes);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("reports a selection with the market it came from", async () => {
    const onToggle = vi.fn();

    render(
      <MarketBoard markets={CATALOGUE} selectedIds={new Set()} onToggle={onToggle} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Draw/ }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle.mock.calls[0]?.[0]).toMatchObject({ kind: "MATCH_RESULT" });
    expect(onToggle.mock.calls[0]?.[1]).toMatchObject({ label: "Draw" });
  });

  it("filters a long catalogue by search", async () => {
    const many = [
      ...CATALOGUE,
      ...Array.from({ length: 6 }, (_, i) =>
        market({
          id: `m-extra-${String(i)}` as MarketView["id"],
          kind: "CORRECT_SCORE",
          name: `Extra ${String(i)}`,
          group: undefined,
          columns: 2,
          selections: [selection(`e${String(i)}-1`, "A", 2), selection(`e${String(i)}-2`, "B", 2)],
        }),
      ),
    ];

    render(<MarketBoard markets={many} selectedIds={new Set()} onToggle={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Search markets"), "corner");

    expect(screen.getByRole("heading", { name: "Total Corners" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Match Result" })).not.toBeInTheDocument();
  });

  it("says so when a search matches nothing", async () => {
    const many = [
      ...CATALOGUE,
      ...Array.from({ length: 6 }, (_, i) =>
        market({
          id: `m-x-${String(i)}` as MarketView["id"],
          kind: "CORRECT_SCORE",
          name: `Extra ${String(i)}`,
          group: undefined,
          columns: 2,
          selections: [selection(`z${String(i)}-1`, "A", 2), selection(`z${String(i)}-2`, "B", 2)],
        }),
      ),
    ];

    render(<MarketBoard markets={many} selectedIds={new Set()} onToggle={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Search markets"), "zzzzz");

    expect(screen.getByText(/No market matches/)).toBeInTheDocument();
  });

  it("shows an empty catalogue as empty rather than as a broken board", () => {
    render(<MarketBoard markets={[]} selectedIds={new Set()} onToggle={vi.fn()} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
