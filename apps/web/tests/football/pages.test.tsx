import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSourceError, type MatchFilter, type MatchSummary } from "@betng/ui-core";
import { HomePage } from "../../src/pages/HomePage";
import { LivePage } from "../../src/pages/LivePage";
import { ResultsPage } from "../../src/pages/ResultsPage";
import { fakeDataSource, league, matchSummary, matchView, renderApp } from "../helpers/runtime";

const live = matchSummary("live1", { phase: "LIVE", status: "IN_PLAY", score: { home: 2, away: 1 } });
const finished = matchSummary("done1", { phase: "FINISHED", status: "COMPLETED", score: { home: 3, away: 0 } });

function byPhase(filter: MatchFilter | undefined, matches: readonly MatchSummary[]): readonly MatchSummary[] {
  return matches.filter((match) => filter?.phases === undefined || filter.phases.includes(match.phase));
}

describe("HomePage", () => {
  it("goes from loading to the platform's matches", async () => {
    const dataSource = fakeDataSource({
      listLeagues: async () => [league("league-a", "Zebra Invitational")],
      listMatches: async (filter) => byPhase(filter, [live, finished]),
      getStandings: async (leagueId) => ({ leagueId, season: 3, matchdaysPlayed: 0, rows: [] }),
      getMatchMarkets: async (matchId) => ({ matchId, markets: [], generatedAt: "2026-09-21T12:00:00.000Z" }),
    });

    renderApp(<HomePage />, { dataSource });

    expect(screen.getByRole("heading", { level: 1, name: "Football today" })).toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: /Loading/ }).length).toBeGreaterThan(0);

    expect(await screen.findByRole("link", { name: /live1 Home 2, live1 Away 1/ })).toHaveAttribute("href", "/matches/live1");
    expect(await screen.findByRole("link", { name: /done1 Home 3, done1 Away 0/ })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Zebra Invitational/ })).toBeInTheDocument();
  });

  it("shows designed empty states when the platform has nothing", async () => {
    renderApp(<HomePage />, { dataSource: fakeDataSource() });

    expect((await screen.findAllByText("No upcoming matches")).length).toBeGreaterThan(0);
    expect(await screen.findByText("No competitions")).toBeInTheDocument();
  });
});

describe("LivePage", () => {
  it("groups live matches by competition", async () => {
    const other = matchSummary("live2", { phase: "HALFTIME", status: "IN_PLAY", leagueId: "league-b" as never, leagueName: "Quartz Cup", leagueCode: "QTZ" });
    const dataSource = fakeDataSource({
      listMatches: async (filter) => byPhase(filter, [live, other]),
      getMatch: async (matchId) => matchView(matchId, matchId === "live1" ? live : other),
    });

    renderApp(<LivePage />, { dataSource });

    expect(screen.getByRole("status", { name: "Loading live matches" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: /Test League A/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Quartz Cup/ })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Quartz Cup live matches" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows the empty state when nothing is in play", async () => {
    renderApp(<LivePage />, { dataSource: fakeDataSource() });

    expect(await screen.findByText("No live matches")).toBeInTheDocument();
  });

  it("shows an error with retry when the list cannot be read", async () => {
    const listMatches = vi.fn(async (): Promise<readonly MatchSummary[]> => {
      throw new DataSourceError("SERVER", "stack trace from the server");
    });

    renderApp(<LivePage />, { dataSource: fakeDataSource({ listMatches }) });

    expect((await screen.findAllByRole("button", { name: /try again|retry/i })).length).toBeGreaterThan(0);
    expect(screen.queryByText(/stack trace from the server/)).not.toBeInTheDocument();
  });
});

describe("ResultsPage", () => {
  it("reads its filters from the URL and passes them to the data source", async () => {
    const listMatches = vi.fn(async (filter?: MatchFilter) => (filter?.date === "2026-09-19" ? [finished] : []));

    renderApp(<ResultsPage />, { dataSource: fakeDataSource({ listMatches }), route: "/results?league=league-a&date=2026-09-19", path: "/results" });

    expect(await screen.findByRole("link", { name: /done1 Home 3, done1 Away 0/ })).toHaveAttribute("href", "/matches/done1");
    expect(listMatches).toHaveBeenCalledWith(expect.objectContaining({ leagueId: "league-a", date: "2026-09-19", phases: ["FINISHED", "SETTLED"] }));
    expect(screen.getByText("done1 Home by 3")).toBeInTheDocument();
  });

  it("writes the date back to the URL when the day is stepped", async () => {
    const { router } = renderApp(<ResultsPage />, { dataSource: fakeDataSource(), route: "/results?league=league-a&date=2026-09-19", path: "/results" });

    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("?league=league-a&date=2026-09-18");
    });
  });

  it("shows the empty state for a day with no results", async () => {
    renderApp(<ResultsPage />, { dataSource: fakeDataSource(), route: "/results?date=2026-09-19", path: "/results" });

    expect(await screen.findByText("No matches finished on this day.")).toBeInTheDocument();
  });
});
