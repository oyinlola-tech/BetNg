import "@testing-library/jest-dom/vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LimitsSummary, ResponsibleGamingLimit } from "@betng/contracts";
import { DataSourceError, formatMoney, type SlipSelection } from "@betng/ui-core";
import { ErrorState, rejectionHelpTopic } from "@betng/ui-web";
import { BetSlipPanel } from "../../src/features/betslip";
import { LimitsStatus, stakeLimitWarning } from "../../src/features/limits";
import { OfflineBanner } from "../../src/layouts/shell/OfflineBanner";
import { HelpPage } from "../../src/pages/HelpPage";
import { __handleWorkerMessageForTests, __resetPwaForTests } from "../../src/pwa/pwa";
import { useBetSlip } from "../../src/stores/betslip.store";
import { fakeAccountServices, openBet, renderHarness, resetState } from "./harness";

function limit(kind: ResponsibleGamingLimit["kind"], value: number, used?: number, status: ResponsibleGamingLimit["status"] = "active"): ResponsibleGamingLimit {
  return { kind, status, value, ...(used === undefined ? {} : { used }), effectiveAt: "2026-09-01T00:00:00.000Z" };
}

function summary(overrides: Partial<LimitsSummary> = {}): LimitsSummary {
  return { limits: [], selfExclusion: { active: false }, restricted: false, ...overrides };
}

function selection(): SlipSelection {
  const leg = openBet("b", "m1").legs[0];

  if (leg === undefined) throw new Error("fixture bet has no legs");

  const { outcome: _outcome, ...rest } = leg;

  return rest;
}

function renderSlip(limits: LimitsSummary, stake: number) {
  useBetSlip.setState({ selections: [selection()], stake });

  return renderHarness({
    route: "/slip",
    routes: [{ path: "/slip", element: <BetSlipPanel /> }],
    flags: { responsibleGamingEnabled: true },
    accountServices: fakeAccountServices({ limits: { getSummary: vi.fn(async () => limits) } }),
  });
}

beforeEach(() => {
  resetState();
  __resetPwaForTests();
});

describe("responsible gaming status", () => {
  it("reports what the platform's figures leave on each limit in force", () => {
    renderHarness({
      routes: [
        {
          path: "/",
          element: <LimitsStatus summary={summary({ limits: [limit("loss_daily", 50_000, 20_000), limit("deposit_weekly", 900_000), limit("session_minutes", 60, 10, "expired")] })} />,
        },
      ],
    });

    expect(screen.getByTestId("limit-status-loss_daily")).toHaveTextContent(`${formatMoney(30_000)} left of ${formatMoney(50_000)}`);
    expect(screen.getByTestId("limit-status-deposit_weekly")).toHaveTextContent(`${formatMoney(900_000)} limit`);
    expect(screen.queryByTestId("limit-status-session_minutes")).not.toBeInTheDocument();
  });

  it("warns on the tightest loss limit a stake exceeds, and not otherwise", () => {
    const current = summary({ limits: [limit("loss_daily", 50_000, 45_000), limit("loss_weekly", 200_000, 100_000)] });

    expect(stakeLimitWarning(current, 4_000)).toBeUndefined();
    expect(stakeLimitWarning(current, 10_000)).toBe(`This stake is more than the ${formatMoney(5_000)} left on your daily loss limit. The platform may limit or refuse it.`);
  });

  it("pre-warns in the slip but still lets the platform decide", async () => {
    renderSlip(summary({ limits: [limit("loss_daily", 50_000, 45_000)] }), 20_000);

    expect(await screen.findByTestId("slip-limit-warning")).toHaveTextContent(formatMoney(5_000));
    expect(screen.getByRole("button", { name: "Place bet" })).toBeEnabled();
  });

  it("holds the slip only while the platform reports the account as restricted", async () => {
    renderSlip(summary({ restricted: true, selfExclusion: { active: true } }), 20_000);

    expect(await screen.findByText("Your account is restricted.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place bet" })).toBeDisabled();
  });
});

describe("error help and offline", () => {
  it("links a platform refusal to the explanation in the help centre", async () => {
    renderHarness({ routes: [{ path: "/", element: <ErrorState error={new DataSourceError("STAKE_LIMITED", "Too high")} /> }] });

    expect(screen.getByRole("link", { name: "Why was my stake limited?" })).toHaveAttribute("href", "/help#stake-limited");
    expect(rejectionHelpTopic("RISK_REJECTED")).toBe("bet-rejected");
  });

  it("offers a retry for a failure a retry can fix, and none for one it cannot", () => {
    const retry = vi.fn();

    renderHarness({
      routes: [
        {
          path: "/",
          element: (
            <>
              <ErrorState error={new DataSourceError("NETWORK", "offline")} onRetry={retry} />
              <ErrorState error={new DataSourceError("BET_REJECTED", "no")} onRetry={retry} />
            </>
          ),
        },
      ],
    });

    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Connection problems" })).toBeInTheDocument();
  });

  it("explains every error topic on the help page", async () => {
    renderHarness({ route: "/help", routes: [{ path: "/help", element: <HelpPage /> }] });

    const problems = await screen.findByRole("region", { name: "When something goes wrong" });

    for (const id of ["bet-rejected", "stake-limited", "odds-changed", "market-suspended", "betting-closed", "insufficient-funds", "limits", "self-exclusion", "verification", "payment-failed", "too-many-requests", "connection-problems"]) {
      expect(problems.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("says money commands are never queued while offline, and marks saved data as stale", async () => {
    const { rerender } = renderHarness({ routes: [{ path: "/", element: <OfflineBanner online={false} /> }] });

    expect(screen.getByRole("status")).toHaveTextContent("You are offline");
    expect(screen.getByRole("status")).toHaveTextContent("Bets, deposits and withdrawals are never queued");

    rerender(<></>);
    renderHarness({ routes: [{ path: "/", element: <OfflineBanner online /> }] });
    expect(screen.queryByText("Showing saved data.", { exact: false })).not.toBeInTheDocument();

    act(() => {
      __handleWorkerMessageForTests({ type: "betng:stale", cachedAt: Date.now() - 120_000 });
    });
    await waitFor(() => {
      expect(screen.getByText("The platform is not answering. Showing saved data.")).toBeInTheDocument();
    });

    act(() => {
      __handleWorkerMessageForTests({ type: "betng:fresh" });
    });
    expect(screen.queryByText("The platform is not answering. Showing saved data.")).not.toBeInTheDocument();
  });

  it("tells the customer bets are not queued when the slip is offline", async () => {
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);

    try {
      renderSlip(summary(), 20_000);
      const note = await screen.findByText(/Bets are never queued/);

      expect(within(note).queryByRole("button")).toBeNull();
    } finally {
      online.mockRestore();
    }
  });
});
