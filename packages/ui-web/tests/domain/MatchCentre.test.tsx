import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { HeadToHeadView, MatchLineupsView } from "@betng/ui-core";
import { HeadToHead } from "../../src/match/HeadToHead";
import { Scoreboard } from "../../src/match/Scoreboard";
import { StatsPanel } from "../../src/match/StatsPanel";
import { MatchLineups } from "../../src/match/lineups/MatchLineups";
import { AWAY, HOME, NOW, clock, lineup, match, player, stats } from "./fixtures";

const TEAMS = { home: HOME, away: AWAY };

describe("StatsPanel", () => {
  it("renders every reported metric including xG and extras", () => {
    render(
      <StatsPanel
        match={TEAMS}
        stats={stats(
          { expectedGoals: 1.4, extra: [{ key: "passes", label: "Passes", value: 412 }] },
          { expectedGoals: 0.7, extra: [{ key: "passes", label: "Passes", value: 380 }] },
        )}
      />,
    );

    for (const label of ["Possession", "Shots", "Shots on target", "Corners", "Fouls", "Offsides", "Yellow cards", "Red cards", "Expected goals (xG)", "Passes"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText("1.40")).toBeInTheDocument();
    expect(screen.getByText("412")).toBeInTheDocument();
  });

  it("omits metrics the platform did not send instead of zero-filling them", () => {
    const partial = stats();
    const stripped = {
      home: { ...partial.home, offsides: undefined, fouls: undefined },
      away: { ...partial.away, offsides: undefined },
    } as unknown as typeof partial;

    render(<StatsPanel match={TEAMS} stats={stripped} view="table" />);

    expect(screen.queryByText("Offsides")).not.toBeInTheDocument();
    expect(screen.queryByText("Expected goals (xG)")).not.toBeInTheDocument();

    const fouls = screen.getByRole("row", { name: /Fouls/ });

    expect(within(fouls).getByText("–")).toBeInTheDocument();
    expect(within(fouls).getByText("9")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ashford" })).toBeInTheDocument();
  });

  it("has an unavailable state", () => {
    render(<StatsPanel match={TEAMS} stats={undefined} />);

    expect(screen.getByText("Statistics not available")).toBeInTheDocument();
  });
});

describe("MatchLineups", () => {
  const base: MatchLineupsView = {
    matchId: "match-1" as MatchLineupsView["matchId"],
    confirmed: true,
    home: lineup("HOME", { formation: "4-4-2", manager: "M. Boss" }),
    away: lineup("AWAY"),
  };

  it("is unavailable without lineups", () => {
    const { rerender } = render(<MatchLineups lineups={undefined} home={HOME} away={AWAY} />);

    expect(screen.getByText("Lineups not available")).toBeInTheDocument();

    rerender(<MatchLineups lineups={{ matchId: base.matchId, confirmed: false }} home={HOME} away={AWAY} />);
    expect(screen.getByText("Lineups not available")).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    render(<MatchLineups lineups={undefined} home={HOME} away={AWAY} loading />);

    expect(screen.getByRole("status", { name: "Loading lineups" })).toBeInTheDocument();
  });

  it("flags unconfirmed lineups", () => {
    const { rerender } = render(<MatchLineups lineups={{ ...base, confirmed: false }} home={HOME} away={AWAY} />);

    expect(screen.getByText("Predicted")).toBeInTheDocument();
    expect(screen.getByText(/not yet confirmed/i)).toBeInTheDocument();

    rerender(<MatchLineups lineups={base} home={HOME} away={AWAY} />);
    expect(screen.queryByText("Predicted")).not.toBeInTheDocument();
  });

  it("copes with one side missing and players without shirt or position", () => {
    render(
      <MatchLineups
        lineups={{
          matchId: base.matchId,
          confirmed: true,
          home: lineup("HOME", { starting: [player("p-x", "N. Oshirt")], substitutes: [] }),
        }}
        home={HOME}
        away={AWAY}
      />,
    );

    expect(screen.getByText("N. Oshirt")).toBeInTheDocument();
    expect(screen.queryByText("Substitutes")).not.toBeInTheDocument();
    expect(screen.getByText("Lineup not available for Riverside.")).toBeInTheDocument();
  });

  it("draws the formation only when every starter has a grid position", () => {
    const placed = lineup("HOME", {
      formation: "1-1",
      manager: "M. Boss",
      starting: [
        player("p-1", "G. Keeper", { shirt: 1, grid: { row: 1, slot: 1 } }),
        player("p-2", "S. Triker", { shirt: 9, grid: { row: 2, slot: 1 } }),
      ],
    });

    render(<MatchLineups lineups={{ ...base, home: placed }} home={HOME} away={AWAY} />);

    expect(screen.getByRole("group", { name: "Ashford City formation 1-1" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Riverside formation/ })).not.toBeInTheDocument();
    expect(screen.getByText("M. Boss")).toBeInTheDocument();
  });
});

describe("HeadToHead", () => {
  const view: HeadToHeadView = {
    matchId: "match-1" as HeadToHeadView["matchId"],
    played: 6,
    homeWins: 3,
    draws: 2,
    awayWins: 1,
    meetings: [
      { matchId: "old-1" as HeadToHeadView["matchId"], kickoffAt: new Date(NOW - 86_400_000).toISOString(), leagueCode: "TLG", home: AWAY, away: HOME, score: { home: 0, away: 2 } },
    ],
  };

  it("summarises with numbers and words and lists meetings", () => {
    render(
      <MemoryRouter>
        <HeadToHead headToHead={view} home={HOME} away={AWAY} meetingHref={(m) => `/matches/${m.matchId}`} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Ashford wins").previousSibling).toHaveTextContent("3");
    expect(screen.getByText("Draws").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("Riverside wins").previousSibling).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: /Riverside 0, Ashford City 2/ })).toHaveAttribute("href", "/matches/old-1");
  });

  it("has an empty state", () => {
    render(<HeadToHead headToHead={undefined} home={HOME} away={AWAY} />);

    expect(screen.getByText("No previous meetings")).toBeInTheDocument();
  });
});

describe("Scoreboard", () => {
  it("shows competition, matchday, score, state and venue from the platform", () => {
    render(
      <Scoreboard
        now={NOW}
        match={match({ phase: "LIVE", status: "IN_PLAY", score: { home: 2, away: 1 }, clock: clock({ minute: 67 }) })}
      />,
    );

    expect(screen.getByText("Test League · Matchday 07")).toBeInTheDocument();
    expect(screen.getByText("67'")).toBeInTheDocument();
    expect(screen.getByLabelText("Ashford City 2, Riverside 1")).toBeInTheDocument();
    expect(screen.getByText("Ashford City Ground")).toBeInTheDocument();
  });

  it("shows no minute for a live match without a reported clock, and marks stale data", () => {
    render(
      <Scoreboard
        stale
        now={NOW}
        match={match({ phase: "LIVE", status: "IN_PLAY", kickoffAt: new Date(NOW - 30 * 60_000).toISOString() })}
      />,
    );

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByRole("region").textContent).not.toMatch(/\d+'|\d\d:\d\d/);
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
  });
});
