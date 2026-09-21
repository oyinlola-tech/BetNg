import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { formatMoney, type BetRejectionReason } from "@betng/ui-core";
import { BetReceipt } from "../../src/betslip/BetReceipt";
import { BetSlipSelection } from "../../src/betslip/BetSlipSelection";
import { BetSlipStateView } from "../../src/betslip/BetSlipStateView";
import { BetSlipSummary } from "../../src/betslip/BetSlipSummary";
import { PhaseBadge } from "../../src/domain/PhaseBadge";
import { SectionHeading } from "../../src/domain/SectionHeading";
import { LeagueTable } from "../../src/standings/LeagueTable";
import { AWAY, HOME, bet, slipSelection, standingRow, standings } from "./fixtures";

describe("LeagueTable", () => {
  const view = standings([
    standingRow(1, HOME),
    standingRow(2, AWAY, { points: 17, goalDifference: -3, form: [] }),
  ]);

  it("renders rows in the platform's order with scoped headers", () => {
    render(
      <MemoryRouter>
        <LeagueTable standings={view} highlightTeamIds={[AWAY.id]} />
      </MemoryRouter>,
    );

    const table = screen.getByRole("table", { name: "League table" });
    const rows = within(table).getAllByRole("row");

    expect(rows).toHaveLength(3);
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts", "Form"]);
    expect(within(rows[1] as HTMLElement).getByRole("rowheader")).toHaveTextContent("Ashford City");
    expect(within(rows[1] as HTMLElement).getByText("+9")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("-3")).toBeInTheDocument();
    expect(rows[2]).toHaveAttribute("data-highlighted", "true");
    expect(within(rows[1] as HTMLElement).getByRole("link")).toHaveAttribute("href", "/teams/team-home");
    expect(within(rows[1] as HTMLElement).getByRole("img", { name: "Form: win, draw, loss" })).toBeInTheDocument();
  });

  it("also renders mobile cards, and drops detail columns when compact", () => {
    const { rerender } = render(
      <MemoryRouter>
        <LeagueTable standings={view} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("list", { name: "League table" })).toHaveClass("sm:hidden");

    rerender(
      <MemoryRouter>
        <LeagueTable standings={view} compact />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("list", { name: "League table" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["#", "Team", "P", "GD", "Pts"]);
  });

  it("has a tv density without links and draws zones only when the data has them", () => {
    const zoned = standings([{ ...standingRow(1, HOME), zone: { label: "Promotion", tone: "success" } } as never]);

    render(
      <MemoryRouter>
        <LeagueTable standings={zoned} density="tv" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Promotion")).toBeInTheDocument();
  });
});

describe("Bet slip presentation", () => {
  const totals = { selectionCount: 1, totalOdds: 2.1, stake: 20_000, potentialReturn: 42_000, potentialProfit: 22_000 };

  it("labels the client total as an estimate", () => {
    render(<BetSlipSummary totals={totals} />);

    expect(screen.getByText("Estimated return")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(42_000))).toBeInTheDocument();
    expect(screen.getAllByText(/accepted bet carries the platform's figure/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Potential payout")).not.toBeInTheDocument();
  });

  it("shows the platform's payout once accepted", () => {
    render(<BetSlipSummary totals={totals} accepted={bet()} />);

    expect(screen.getByText("Potential payout")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(41_500))).toBeInTheDocument();
    expect(screen.queryByText("Estimated return")).not.toBeInTheDocument();
    expect(screen.queryByText(formatMoney(42_000))).not.toBeInTheDocument();
  });

  it("shows selection status and removes by label", async () => {
    const onRemove = vi.fn();
    const pick = slipSelection();

    render(
      <ul>
        <BetSlipSelection selection={pick} status={{ kind: "PRICE_CHANGED", currentOdds: 1.95 }} onRemove={onRemove} />
      </ul>,
    );

    expect(screen.getByText("Price changed")).toBeInTheDocument();
    expect(screen.getByText("1.95")).toBeInTheDocument();
    expect(screen.getAllByText("2.10").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Remove One, Ashford City v Riverside" }));
    expect(onRemove).toHaveBeenCalledWith(pick);
  });

  it.each(["SUSPENDED", "CLOSED"] as const)("words the %s selection status", (kind) => {
    render(
      <ul>
        <BetSlipSelection selection={slipSelection()} status={{ kind }} />
      </ul>,
    );

    expect(screen.getByText(new RegExp(`^${kind}$`, "i"))).toBeInTheDocument();
  });

  it.each<BetRejectionReason>(["MARKET_CLOSED", "MARKET_SUSPENDED", "ODDS_CHANGED", "STAKE_LIMITED", "RISK_REJECTED", "INSUFFICIENT_FUNDS", "INVALID_BET"])(
    "words the %s refusal",
    (reason) => {
      render(<BetSlipStateView state={{ kind: "REJECTED", reason }} />);

      const alert = screen.getByRole("alert");

      expect(within(alert).getByText("Bet not accepted")).toBeInTheDocument();
      expect(alert.textContent?.length).toBeGreaterThan("Bet not accepted".length + 10);
      expect(alert.textContent).not.toContain(reason);
    },
  );

  it("renders every slip state", () => {
    const states = [
      [{ kind: "EMPTY" }, "Your bet slip is empty"],
      [{ kind: "SUBMITTING" }, "Placing your bet"],
      [{ kind: "ACCEPTED", bet: bet() }, "Bet accepted"],
      [{ kind: "PARTIALLY_ACCEPTED", rejectedCount: 1 }, "Bet partially accepted"],
      [{ kind: "LIMITED", maxStake: 10_000 }, "Stake limited"],
      [{ kind: "SUSPENDED" }, "Betting suspended"],
      [{ kind: "EXPIRED" }, "Bet slip expired"],
      [{ kind: "ERROR" }, "Something went wrong"],
    ] as const;

    for (const [state, title] of states) {
      const { unmount } = render(<BetSlipStateView state={state} />);

      expect(screen.getByText(title)).toBeInTheDocument();
      unmount();
    }
  });

  it("prints the platform's reference and figures on the receipt", () => {
    render(<BetReceipt bet={bet()} />);

    expect(screen.getByText("PLATFORM-REF-9")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(20_000))).toBeInTheDocument();
    expect(screen.getByText(formatMoney(41_500))).toBeInTheDocument();
    expect(screen.getByText("Placed")).toBeInTheDocument();
  });

  it("falls back to the bet id when there is no reference", () => {
    const { reference: _reference, ...rest } = bet();

    render(<BetReceipt bet={rest} />);

    expect(screen.getByText("bet-1")).toBeInTheDocument();
  });
});

describe("brand and state elements", () => {
  it("renders a badge with a word for every phase", () => {
    const phases = ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED", "LIVE", "HALFTIME", "FINISHED", "SETTLED", "CANCELLED", "POSTPONED", "SUSPENDED", "DELAYED"] as const;

    for (const phase of phases) {
      const { container, unmount } = render(<PhaseBadge phase={phase} />);

      expect(container.textContent).not.toBe("");
      unmount();
    }
  });

  it("renders the section heading at the requested level with an action", () => {
    render(
      <SectionHeading as="h3" action={<a href="/all">All</a>}>
        Live now
      </SectionHeading>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Live now" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All" })).toBeInTheDocument();
  });
});
