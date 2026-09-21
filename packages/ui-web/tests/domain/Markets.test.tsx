import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MarketView } from "@betng/ui-core";
import { MarketCard } from "../../src/markets/MarketCard";
import { MarketList } from "../../src/markets/MarketList";
import { market, selection } from "./fixtures";

const MARKETS: readonly MarketView[] = [
  market({ id: "m-main" as MarketView["id"], name: "Alpha market", group: "MAIN" }),
  market({
    id: "m-goals" as MarketView["id"],
    name: "Beta market",
    group: "GOALS",
    line: 2.5,
    columns: 2,
    selections: [selection("g-1", "Over", 1.8), selection("g-2", "Under", 2.0)],
  }),
  market({
    id: "m-unknown" as MarketView["id"],
    name: "Gamma market",
    kind: "SOMETHING_NEW" as MarketView["kind"],
    columns: 4,
    selections: [
      selection("u-1", "Aa", 5),
      selection("u-2", "Bb", 6),
      selection("u-3", "Cc", 7),
      selection("u-4", "Dd", 8),
    ],
  }),
];

describe("MarketList", () => {
  it("builds tabs only for the groups the data has, in the platform's grouping", () => {
    render(<MarketList markets={MARKETS} selectedIds={new Set()} onToggle={vi.fn()} />);

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");

    expect(tabs.map((tab) => tab.textContent)).toEqual(["Main1", "Goals1", "More1"]);
    expect(screen.queryByRole("tab", { name: /Handicap/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alpha market" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Beta market/ })).not.toBeInTheDocument();
  });

  it("switches group and renders an unknown market kind by its columns", async () => {
    const onToggle = vi.fn();

    render(<MarketList markets={MARKETS} selectedIds={new Set(["u-2"])} onToggle={onToggle} matchLabel="Ashford City v Riverside" />);

    await userEvent.click(screen.getByRole("tab", { name: /More/ }));

    const card = screen.getByRole("region", { name: "Gamma market" });
    const grid = within(card).getByRole("group");

    expect(grid).toHaveStyle({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" });
    expect(within(grid).getAllByRole("button")).toHaveLength(4);
    expect(within(grid).getByRole("button", { name: /Bb, odds 6.00/ })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(within(grid).getByRole("button", { name: "Ashford City v Riverside, Gamma market, Aa, odds 5.00" }));
    expect(onToggle).toHaveBeenCalledWith(MARKETS[2]?.selections[0], MARKETS[2]);
  });

  it("appends the line to the market title", async () => {
    render(<MarketList markets={MARKETS} selectedIds={new Set()} onToggle={vi.fn()} />);

    await userEvent.click(screen.getByRole("tab", { name: /Goals/ }));

    expect(screen.getByRole("heading", { name: "Beta market 2.5" })).toBeInTheDocument();
  });

  it("has loading, empty and dense row layouts", () => {
    const { rerender } = render(<MarketList markets={undefined} selectedIds={new Set()} onToggle={vi.fn()} />);

    expect(screen.getByRole("status", { name: "Loading markets" })).toBeInTheDocument();

    rerender(<MarketList markets={[]} selectedIds={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText("No markets")).toBeInTheDocument();

    rerender(<MarketList layout="rows" markets={MARKETS} selectedIds={new Set()} onToggle={vi.fn()} />);
    expect(screen.getAllByRole("group")).toHaveLength(3);
  });
});

describe("MarketCard", () => {
  it("locks a suspended market and shows the platform's reason", async () => {
    const onToggle = vi.fn();

    render(
      <MarketCard
        market={market({ status: "SUSPENDED", suspensionReason: "Goal under review" })}
        isSelected={() => false}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByText("Goal under review")).toBeInTheDocument();

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it.each(["CLOSED", "SETTLED", "VOID"] as const)("disables selections when %s", (status) => {
    render(<MarketCard market={market({ status })} onToggle={vi.fn()} />);

    expect(screen.getByText(new RegExp(`^${status}$`, "i"))).toBeInTheDocument();

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("keeps the legacy (market, selection) callback order", async () => {
    const onToggle = vi.fn();
    const open = market();

    render(<MarketCard market={open} isSelected={(id) => id === "sel-2"} onToggle={onToggle} />);

    expect(screen.getByRole("button", { name: /Two/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /One/ }));
    expect(onToggle).toHaveBeenCalledWith(open, open.selections[0]);
  });
});
