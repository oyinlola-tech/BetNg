import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderConsole } from "../helpers/render";
import { SUPPORT_PERMISSIONS } from "../helpers/sources";

const overview = { activeUsers: 12, activeShops: 3, openBets: 5420, liveMatches: 7, todayStake: 1, todayPayouts: 1, todayNet: 0, generatedAt: "2026-09-21T12:00:00.000Z" };
const analytics = {
  totalMatches: 40,
  totalBets: 300,
  acceptedBets: 300,
  limitedBets: 9,
  rejectedBets: 4,
  pendingBets: 20,
  settledBets: 280,
  winningBets: 100,
  losingBets: 170,
  voidBets: 10,
  cancelledBets: 0,
  totalStake: 250_000_000,
  pendingStake: 0,
  settledStake: 240_000_000,
  totalPayout: 260_000_000,
  operatorResult: -20_000_000,
  operatorResultRate: -0.0833,
  customers: 1,
  shops: 1,
  cashiers: 1,
  generatedAt: "2026-09-21T12:00:00.000Z",
};

const card = (label: string): HTMLElement => {
  const heading = screen.getByRole("heading", { level: 3, name: label });

  if (heading.parentElement?.parentElement == null) throw new Error(`No card for ${label}`);

  return heading.parentElement.parentElement;
};

describe("dashboard", () => {
  it("shows the platform's figures as they were answered, including a negative operator result", async () => {
    renderConsole({ admin: { getOverview: overview, getAnalyticsOverview: analytics } });

    expect(await screen.findByText("5,420")).toBeInTheDocument();
    expect(within(card("Live matches")).getByText("7")).toBeInTheDocument();
    expect(within(card("Accepted bets")).getByText("300")).toBeInTheDocument();
    expect(within(card("Rejected bets")).getByText("4")).toBeInTheDocument();
    expect(within(card("Total stake")).getByText("₦2,500,000")).toBeInTheDocument();
    expect(within(card("Total payout")).getByText("₦2,600,000")).toBeInTheDocument();
    expect(within(card("Operator result")).getByText("-₦200,000")).toBeInTheDocument();
    expect(within(card("Operator result rate")).getByText("-8.3%")).toBeInTheDocument();
  });

  it("marks a figure the contracts do not carry as unavailable instead of working one out", async () => {
    renderConsole({ admin: { getOverview: overview } });

    await screen.findByText("5,420");

    expect(card("Active matches")).toHaveAttribute("data-state", "unavailable");
    expect(within(card("Active matches")).getByText("Unavailable from the platform")).toBeInTheDocument();
  });

  it("says which permission a figure needs when the role lacks it, and does not ask for it", async () => {
    const { adminSource } = renderConsole({ permissions: SUPPORT_PERMISSIONS, admin: { getOverview: overview } });

    await screen.findByText("5,420");

    expect(card("Total stake")).toHaveAttribute("data-state", "forbidden");
    expect(within(card("Total stake")).getByText(/reports:read/)).toBeInTheDocument();
    expect(adminSource.calls("getAnalyticsOverview")).not.toHaveBeenCalled();
    expect(adminSource.calls("getOperatorLedger")).not.toHaveBeenCalled();
  });
});
