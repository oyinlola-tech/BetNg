import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetId } from "@betng/contracts";
import { DataSourceError, type NotificationView } from "@betng/ui-core";
import { notificationTarget } from "../../src/features/notifications/notificationMeta";
import { fakeDataSource, renderAccount, resetClientState } from "../helpers/account";

beforeEach(() => {
  resetClientState();
});

function alert(overrides: Partial<NotificationView>): NotificationView {
  return { id: "n", kind: "MATCH_FINISHED", title: "Notice", body: "", createdAt: new Date().toISOString(), read: false, ...overrides };
}

describe("notification targets", () => {
  it.each([
    ["KYC_UPDATED", "/kyc"],
    ["LIMIT_WARNING", "/responsible-gaming"],
    ["PAYMENT_UPDATED", "/payments"],
    ["SECURITY_ALERT", "/account/sessions"],
  ] as const)("sends %s to %s", (kind, target) => {
    expect(notificationTarget(alert({ kind }))).toBe(target);
  });

  it("opens the payment when the notification carries a valid reference", () => {
    expect(notificationTarget(alert({ kind: "PAYMENT_UPDATED", paymentReference: "DEP000123" }))).toBe("/payments/DEP000123");
    expect(notificationTarget(alert({ kind: "PAYMENT_UPDATED", paymentReference: "../admin" }))).toBe("/payments");
  });

  it("opens the ticket for a bet notification", () => {
    expect(notificationTarget(alert({ kind: "BET_ACCEPTED", betId: "bet-9" as BetId }))).toBe("/tickets/bet-9");
  });
});

describe("mark as read", () => {
  function deferred(): { promise: Promise<undefined>; resolve: () => void; reject: (error: unknown) => void } {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<undefined>((ok, fail) => {
      resolve = () => {
        ok(undefined);
      };
      reject = fail;
    });

    return { promise, resolve, reject };
  }

  const items: NotificationView[] = [
    alert({ id: "a1", kind: "KYC_UPDATED", title: "Verification updated" }),
    alert({ id: "a2", kind: "LIMIT_WARNING", title: "Limit close" }),
  ];

  it("shows the notification as read at once and keeps it when the platform agrees", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    let stored = items;
    const markNotificationsRead = vi.fn(async (ids?: readonly string[]) => {
      await pending.promise;
      stored = stored.map((item) => (ids === undefined || ids.includes(item.id) ? { ...item, read: true } : item));
    });

    renderAccount({ route: "/notifications", dataSource: fakeDataSource({ listNotifications: async () => stored, markNotificationsRead }) });

    expect(await screen.findByText("2 unread")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(await screen.findByText("All read")).toBeInTheDocument();
    expect(markNotificationsRead).toHaveBeenCalledWith(undefined);

    pending.resolve();

    await waitFor(() => {
      expect(screen.getByText("All read")).toBeInTheDocument();
    });
    expect(screen.queryByText("Not marked as read")).not.toBeInTheDocument();
  });

  it("rolls back and says so when the platform refuses", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const markNotificationsRead = vi.fn(async () => pending.promise);

    renderAccount({ route: "/notifications", dataSource: fakeDataSource({ listNotifications: async () => items, markNotificationsRead }) });

    expect(await screen.findByText("2 unread")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(await screen.findByText("All read")).toBeInTheDocument();

    pending.reject(new DataSourceError("UNAVAILABLE", "Down."));

    expect(await screen.findByText("Not marked as read")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("2 unread")).toBeInTheDocument();
    });
  });
});
