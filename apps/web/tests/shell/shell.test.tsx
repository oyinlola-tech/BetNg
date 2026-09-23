import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomNav } from "../../src/layouts/shell/BottomNav";
import { Header } from "../../src/layouts/shell/Header";
import { LeagueBar } from "../../src/layouts/shell/LeagueBar";
import { fakeDataSource, league, matchSummary, renderApp } from "../helpers/runtime";

describe("Header", () => {
  it("renders the primary navigation", () => {
    renderApp(<Header />);

    const nav = screen.getByRole("navigation", { name: "Primary" });

    for (const name of ["Football", "Live", "Virtuals", "Results", "Standings"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /search/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
  });

  it("drops the entries whose feature flag is off", () => {
    renderApp(<Header />, { flags: { liveEnabled: false, virtualFootballEnabled: false, searchEnabled: false } });

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(within(nav).queryByRole("link", { name: "Live" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Virtuals" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Results" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /search/i })).not.toBeInTheDocument();
  });

  it("offers sign-in and no wallet chip to a signed-out visitor", () => {
    renderApp(<Header />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Wallet" })).not.toBeInTheDocument();
  });
});

describe("LeagueBar", () => {
  it("renders the competitions the data source lists, and the live count", async () => {
    const dataSource = fakeDataSource({
      listLeagues: async () => [league("league-a", "Zebra Invitational"), league("league-b", "Quartz Cup")],
      listMatches: async () => [matchSummary("m1", { phase: "LIVE" }), matchSummary("m2", { phase: "HALFTIME" })],
    });

    renderApp(<LeagueBar />, { dataSource });

    const bar = screen.getByRole("navigation", { name: "Competitions" });

    expect(await within(bar).findByRole("link", { name: /Zebra Invitational/ })).toHaveAttribute("href", "/leagues/league-a");
    expect(within(bar).getByRole("link", { name: /Quartz Cup/ })).toBeInTheDocument();
    expect(await within(bar).findByRole("link", { name: "Live now, 2 matches" })).toBeInTheDocument();
  });

  it("filters in place and marks the active league on a filter page", async () => {
    const dataSource = fakeDataSource({ listLeagues: async () => [league("league-a", "Zebra Invitational"), league("league-b", "Quartz Cup")] });

    renderApp(<LeagueBar />, { dataSource, route: "/results?league=league-b&date=2026-09-20", path: "/results" });

    const active = await screen.findByRole("link", { name: /Quartz Cup/ });

    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Zebra Invitational/ })).toHaveAttribute("href", "/results?date=2026-09-20&league=league-a");
    expect(screen.getByRole("link", { name: "All competitions" })).toHaveAttribute("href", "/results?date=2026-09-20");
  });

  it("hides the live count when live is switched off", async () => {
    const dataSource = fakeDataSource({ listLeagues: async () => [league("league-a", "Zebra Invitational")] });

    renderApp(<LeagueBar />, { dataSource, flags: { liveEnabled: false } });

    await screen.findByRole("link", { name: /Zebra Invitational/ });
    expect(screen.queryByRole("link", { name: /Live now/ })).not.toBeInTheDocument();
  });
});

describe("BottomNav", () => {
  it("renders Home, Football, Live, Bets and More", () => {
    renderApp(<BottomNav moreOpen={false} onMore={() => undefined} />);

    const nav = screen.getByRole("navigation", { name: "Main" });

    for (const name of ["Home", "Football", "Live", "Bets"]) expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    // Virtual football moved under More so the primary play surface takes a slot.
    expect(within(nav).queryByRole("link", { name: "Virtuals" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "More" })).toHaveAttribute("aria-haspopup", "dialog");
  });
});
