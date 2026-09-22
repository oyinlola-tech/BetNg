import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MatchId } from "@betng/contracts";
import { DataSourceError, type MatchEventView, type MatchView } from "@betng/ui-core";
import { RouteErrorBoundary } from "@betng/ui-web";
import { MatchPage } from "../../src/pages/MatchPage";
import { fakeDataSource, matchView, renderApp } from "../helpers/runtime";

const NOW = "2026-09-21T15:30:00.000Z";

function liveMatch(overrides: Partial<MatchView> = {}): MatchView {
  return matchView("m1", { phase: "LIVE", status: "IN_PLAY", score: { home: 1, away: 0 }, ...overrides });
}

function goal(sequence: number, minute: number, home: number, away: number): MatchEventView {
  return {
    id: `event-${String(sequence)}`,
    matchId: "m1" as MatchId,
    sequence,
    kind: "GOAL",
    minute,
    side: "AWAY",
    player: "Test Scorer",
    score: { home, away },
    description: "Goal",
    occurredAt: NOW,
  };
}

function source(match: MatchView, extra: Parameters<typeof fakeDataSource>[0] = {}) {
  return fakeDataSource({
    getMatch: async () => match,
    getMatchMarkets: async (matchId) => ({ matchId, markets: [], generatedAt: NOW }),
    ...extra,
  });
}

function header(): HTMLElement {
  return screen.getByRole("heading", { level: 1 }).closest("header") as HTMLElement;
}

describe("MatchPage", () => {
  it("offers a way back: history when the visit started in the app, a link on a deep link", async () => {
    const user = userEvent.setup();
    const deep = renderApp(<MatchPage />, { dataSource: source(liveMatch()), route: "/matches/m1", path: "/matches/:matchId" });

    expect(await screen.findByRole("link", { name: "Back to matches" })).toHaveAttribute("href", "/virtuals");

    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });

    expect(within(trail).getByRole("link", { name: "Fixtures" })).toHaveAttribute("href", "/virtuals");
    expect(within(trail).getByText("m1 Home v m1 Away")).toHaveAttribute("aria-current", "page");

    deep.unmount();

    const { router } = renderApp(<MatchPage />, {
      dataSource: source(liveMatch()),
      routes: [
        { path: "/virtuals", element: <h1>Fixtures list</h1> },
        { path: "/matches/:matchId", element: <MatchPage /> },
      ],
      route: "/virtuals",
    });

    await act(async () => {
      await router.navigate("/matches/m1");
    });

    await user.click(await screen.findByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Fixtures list" })).toBeInTheDocument();
  });

  it("shows the minute the platform reported in match.clock", async () => {
    const match = liveMatch({ clock: { period: "SECOND_HALF", minute: 67, asOf: NOW } });

    renderApp(<MatchPage />, { dataSource: source(match), route: "/matches/m1", path: "/matches/:matchId" });

    expect(await screen.findByRole("heading", { level: 1, name: "m1 Home v m1 Away" })).toBeInTheDocument();
    expect(within(header()).getByText(/67'/)).toBeInTheDocument();
  });

  it("shows LIVE with no minute when the platform reported no clock", async () => {
    renderApp(<MatchPage />, { dataSource: source(liveMatch()), route: "/matches/m1", path: "/matches/:matchId" });

    await screen.findByRole("heading", { level: 1, name: "m1 Home v m1 Away" });

    expect(within(header()).getByText(/live/i)).toBeInTheDocument();
    expect(within(header()).queryByText(/\d+'/)).not.toBeInTheDocument();
    expect(within(header()).queryByText(/\d{1,3}:\d{2}/)).not.toBeInTheDocument();
  });

  it("applies an event pushed through subscribeMatch", async () => {
    const dataSource = source(liveMatch({ clock: { period: "SECOND_HALF", minute: 67, asOf: NOW } }));

    renderApp(<MatchPage />, { dataSource, route: "/matches/m1", path: "/matches/:matchId" });
    await screen.findByRole("heading", { level: 1, name: "m1 Home v m1 Away" });

    const handlers = dataSource.matchHandlers.get("m1");

    expect(handlers).toBeDefined();
    expect(within(header()).getByLabelText("m1 Home 1, m1 Away 0")).toBeInTheDocument();
    expect(within(header()).getByText(/67'/)).toBeInTheDocument();

    act(() => {
      handlers?.onEvent(goal(1, 70, 1, 1));
    });

    await waitFor(() => {
      expect(within(header()).getByLabelText("m1 Home 1, m1 Away 1")).toBeInTheDocument();
    });
    expect(within(header()).queryByLabelText("m1 Home 1, m1 Away 0")).not.toBeInTheDocument();
    expect(within(header()).getByText(/70'/)).toBeInTheDocument();
    expect(within(header()).queryByText(/67'/)).not.toBeInTheDocument();
  });

  it("keeps the tab in the URL and renders unavailable states", async () => {
    const dataSource = source(liveMatch(), {
      getMatchLineups: async () => {
        throw new DataSourceError("NOT_IMPLEMENTED", "not served");
      },
      getHeadToHead: async () => {
        throw new DataSourceError("NOT_IMPLEMENTED", "not served");
      },
    });
    const { router } = renderApp(<MatchPage />, { dataSource, route: "/matches/m1", path: "/matches/:matchId" });

    await screen.findByRole("heading", { level: 1, name: "m1 Home v m1 Away" });

    const tabs = within(screen.getByRole("tablist", { name: "Match sections" }));

    for (const name of ["Overview", "Timeline", "Stats", "Lineups", "Markets", "Head to Head", "Table"]) {
      expect(tabs.getByRole("tab", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }

    await userEvent.click(tabs.getByRole("tab", { name: /^Lineups/ }));
    expect(router.state.location.search).toBe("?tab=lineups");
    expect(await screen.findByText("Lineups not available")).toBeInTheDocument();

    await userEvent.click(tabs.getByRole("tab", { name: /^Head to Head/ }));
    expect(router.state.location.search).toBe("?tab=h2h");
    expect(await screen.findByText("Head to head not available")).toBeInTheDocument();
    expect(screen.queryByText("not served")).not.toBeInTheDocument();
  });

  it("re-reads the markets when the platform's match state changes", async () => {
    let current = liveMatch({ phase: "BETTING_OPEN", status: "BETTING_OPEN", updatedAt: "2026-09-21T15:00:00.000Z" });
    const getMatchMarkets = vi.fn(async (matchId: MatchId) => ({ matchId, markets: [], generatedAt: NOW }));
    const dataSource = fakeDataSource({ getMatch: async () => current, getMatchMarkets });

    renderApp(<MatchPage />, { dataSource, route: "/matches/m1", path: "/matches/:matchId" });
    await screen.findByRole("heading", { level: 1, name: "m1 Home v m1 Away" });
    await waitFor(() => {
      expect(getMatchMarkets).toHaveBeenCalled();
    });

    const before = getMatchMarkets.mock.calls.length;

    current = { ...current, updatedAt: "2026-09-21T15:00:30.000Z" };
    act(() => {
      dataSource.matchHandlers.get("m1")?.onSignal?.("ODDS_UPDATED");
    });

    await waitFor(() => {
      expect(getMatchMarkets.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it("shows not found for a match the platform does not have", async () => {
    const dataSource = fakeDataSource({
      getMatch: async () => {
        throw new DataSourceError("NOT_FOUND", "no such match");
      },
    });

    renderApp(<MatchPage />, { dataSource, route: "/matches/nope", path: "/matches/:matchId" });

    expect(await screen.findByRole("heading", { level: 1, name: "Match not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See fixtures" })).toHaveAttribute("href", "/virtuals");
    expect(screen.queryByText("no such match")).not.toBeInTheDocument();
  });
});

describe("RouteErrorBoundary", () => {
  it("shows the 404 state when no route matches", async () => {
    renderApp(<div />, {
      route: "/missing",
      routes: [{ path: "/", element: <p>home</p>, errorElement: <RouteErrorBoundary /> }],
    });

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("home")).not.toBeInTheDocument();
  });
});
