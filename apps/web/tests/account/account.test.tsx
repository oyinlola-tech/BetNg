import "@testing-library/jest-dom/vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetId } from "@betng/contracts";
import { DataSourceError, formatMoney, type NotificationView } from "@betng/ui-core";
import { TEST_USER, bet, fakeDataSource, renderAccount, resetClientState } from "../helpers/account";

beforeEach(() => {
  resetClientState();
});

describe("tickets", () => {
  it("filters by the status in the URL", async () => {
    const bets = [bet({ id: "bet-open" as BetId }), bet({ id: "bet-won" as BetId, status: "WON", payout: 40_000, settledAt: "2026-09-21T14:00:00.000Z" })];

    renderAccount({ route: "/tickets?status=won", dataSource: fakeDataSource({ listBets: async () => bets }) });

    const table = await screen.findByRole("table", { name: "Your tickets" });

    await waitFor(() => {
      expect(within(table).getAllByRole("row")).toHaveLength(2);
    });
    expect(within(table).getByText("Won")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Won/ })).toHaveAttribute("aria-selected", "true");
  });

  it("changes the URL when another status is chosen", async () => {
    const user = userEvent.setup();

    renderAccount({ route: "/tickets", dataSource: fakeDataSource({ listBets: async () => [bet()] }) });

    await user.click(await screen.findByRole("tab", { name: /Lost/ }));

    expect(screen.getByTestId("location")).toHaveTextContent("/tickets?status=lost");
    expect(await screen.findByText("No tickets with this status")).toBeInTheDocument();
  });

  it("shows the ticket code only for a reference the platform issued", async () => {
    const getBet = vi.fn(async (id: string) => (id === "bet-ref" ? bet({ id: "bet-ref" as BetId, reference: "TCK-2291-AA" }) : bet({ id: "bet-plain" as BetId })));
    const first = renderAccount({ route: "/tickets/bet-ref", dataSource: fakeDataSource({ getBet }) });

    expect(await screen.findByRole("figure", { name: "Ticket code for reference TCK-2291-AA" })).toBeInTheDocument();
    expect(screen.getByText("Potential payout").nextElementSibling).toHaveTextContent(formatMoney(40_000));
    expect(screen.getByText("Settlement").nextElementSibling).toHaveTextContent("Not settled");

    first.unmount();
    renderAccount({ route: "/tickets/bet-plain", dataSource: fakeDataSource({ getBet }) });

    expect(await screen.findByText("The platform has not issued a ticket reference for this bet.")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(screen.getByText("bet-plain")).toBeInTheDocument();
  });

  it("shows settlement, payout and leg outcomes as the platform reports them", async () => {
    const settled = bet({
      status: "WON",
      payout: 39_000,
      settledAt: "2026-09-21T14:00:00.000Z",
      legs: [{ ...bet().legs[0]!, outcome: "WON", result: "2-1" }],
    });

    renderAccount({ route: "/tickets/bet-1", dataSource: fakeDataSource({ getBet: async () => settled }) });

    expect(await screen.findByText("Result: 2-1")).toBeInTheDocument();
    expect(screen.getByText("Payout").nextElementSibling).toHaveTextContent(formatMoney(39_000));
    expect(screen.getByText("Settlement").nextElementSibling).toHaveTextContent("Settled");
  });

  it("has a not-found state for a ticket that is not on the account", async () => {
    renderAccount({
      route: "/tickets/nope",
      dataSource: fakeDataSource({
        getBet: async () => {
          throw new DataSourceError("NOT_FOUND", "no such bet");
        },
      }),
    });

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
  });

  it("redirects the old history addresses", async () => {
    const first = renderAccount({ route: "/history" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/tickets");
    });

    first.unmount();
    renderAccount({ route: "/history?tab=transactions" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/transactions");
    });
  });
});

describe("notifications", () => {
  const alerts: NotificationView[] = [
    { id: "n1", kind: "BET_SETTLED", title: "Bet settled", body: "Your ticket won.", createdAt: new Date().toISOString(), read: false, betId: "bet-1" as BetId },
    { id: "n2", kind: "MATCH_FINISHED", title: "Full time", body: "A match finished.", createdAt: "2026-01-02T10:00:00.000Z", read: true },
  ];

  it("groups by day, marks everything read and refreshes on an account signal", async () => {
    const user = userEvent.setup();
    let signal: (() => void) | undefined;
    const listNotifications = vi.fn(async () => alerts);
    const markNotificationsRead = vi.fn(async () => undefined);
    const dataSource = fakeDataSource({
      listNotifications,
      markNotificationsRead,
      subscribeAccount: (listener) => {
        signal = listener;

        return () => undefined;
      },
    });

    renderAccount({ route: "/notifications", dataSource });

    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByText("1 unread")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bet settled/ })).toHaveAttribute("href", "/tickets/bet-1");

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(markNotificationsRead).toHaveBeenCalledWith(undefined);

    const calls = listNotifications.mock.calls.length;

    signal?.();

    await waitFor(() => {
      expect(listNotifications.mock.calls.length).toBeGreaterThan(calls);
    });
  });

  it("shows the empty state when the platform has nothing", async () => {
    renderAccount({ route: "/notifications" });

    expect(await screen.findByText("No notifications")).toBeInTheDocument();
  });
});

describe("account area", () => {
  it("opens on the profile, read-only, with the section navigation", async () => {
    renderAccount({ route: "/account" });

    expect(await screen.findByLabelText("Display name")).toHaveValue(TEST_USER.displayName);
    expect(screen.getByLabelText("Display name")).toHaveAttribute("readonly");
    expect(screen.getByTestId("location")).toHaveTextContent("/account/profile");
    expect(within(screen.getByRole("navigation", { name: "Account sections" })).getAllByRole("link")).toHaveLength(6);
  });

  it("saves a notification preference through the data source", async () => {
    const user = userEvent.setup();
    const setNotificationPreferences = vi.fn(async () => undefined);

    renderAccount({ route: "/account/notifications", dataSource: fakeDataSource({ setNotificationPreferences }) });

    await user.click(await screen.findByRole("switch", { name: /Goals/ }));

    expect(setNotificationPreferences).toHaveBeenCalledWith({ matchStarting: true, matchFinished: true, betSettled: true, goals: true });
  });

  it("says what the platform does not offer yet instead of faking it", async () => {
    renderAccount({ route: "/account/security" });

    expect(await screen.findByRole("heading", { name: "Two-step verification" })).toBeInTheDocument();
    expect(screen.getByText(/not offered by the platform yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
