import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { MatchPhase } from "@betng/ui-core";
import { LiveMatchCard } from "../../src/domain/LiveMatchCard";
import { MatchRow } from "../../src/domain/MatchRow";
import { MatchCard } from "../../src/match/MatchCard";
import { NOW, clock, event, match } from "./fixtures";

function renderCard(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("MatchCard", () => {
  it("shows the minute the platform reported while live", () => {
    renderCard(
      <MatchCard
        now={NOW}
        match={match({
          phase: "LIVE",
          status: "IN_PLAY",
          score: { home: 2, away: 1 },
          clock: clock({ minute: 67 }),
        })}
      />,
    );

    const card = screen.getByRole("article", {
      name: "Test League, Ashford City 2, Riverside 1, live, 67th minute",
    });

    expect(within(card).getByText("67'")).toBeInTheDocument();
    expect(within(card).getByText("LIVE")).toBeInTheDocument();
  });

  it("never invents a minute: a kick-off long ago with no reported clock shows LIVE only", () => {
    renderCard(
      <MatchCard
        now={NOW}
        match={match({
          phase: "LIVE",
          status: "IN_PLAY",
          kickoffAt: new Date(NOW - 40 * 60 * 1000).toISOString(),
          score: { home: 1, away: 0 },
        })}
      />,
    );

    const card = screen.getByRole("article");

    expect(within(card).getByText("LIVE")).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/\d+'/);
    expect(card).toHaveAccessibleName(
      "Test League, Ashford City 1, Riverside 0, live",
    );
  });

  it("advances the minute only by the platform's minute length and never past the period", () => {
    renderCard(
      <MatchCard
        now={NOW + 3 * 60_000}
        match={match({
          phase: "LIVE",
          status: "IN_PLAY",
          clock: clock({ period: "FIRST_HALF", minute: 44, minuteLengthMs: 60_000 }),
        })}
      />,
    );

    expect(screen.getByText("45'")).toBeInTheDocument();
  });

  it("emphasises the winner once finished", () => {
    renderCard(
      <MatchCard
        match={match({
          phase: "FINISHED",
          status: "COMPLETED",
          score: { home: 0, away: 3 },
        })}
      />,
    );

    expect(screen.getByText("Full time")).toBeInTheDocument();
    expect(screen.getByText("Riverside")).toHaveClass("text-text-primary", "font-bold");
    expect(screen.getByText("Ashford City")).toHaveClass("text-text-secondary");
    expect(screen.getByText("3")).toHaveClass("text-text-primary");
    expect(screen.getByText("0")).toHaveClass("text-text-secondary");
  });

  it("keeps both sides primary on a draw", () => {
    renderCard(
      <MatchCard
        match={match({ phase: "SETTLED", status: "COMPLETED", score: { home: 1, away: 1 } })}
      />,
    );

    expect(screen.getByText("Ashford City")).toHaveClass("text-text-primary");
    expect(screen.getByText("Riverside")).toHaveClass("text-text-primary");
  });

  it("does not show a score or a winner before the platform says the match started", () => {
    renderCard(
      <MatchCard
        now={NOW}
        match={match({
          phase: "BETTING_OPEN",
          kickoffAt: new Date(NOW - 10 * 60_000).toISOString(),
        })}
      />,
    );

    expect(screen.getByText("Betting open")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("counts down only inside the last hour", () => {
    renderCard(
      <MatchCard
        now={NOW}
        match={match({
          phase: "BETTING_CLOSED",
          kickoffAt: new Date(NOW + 5 * 60_000).toISOString(),
        })}
      />,
    );

    expect(screen.getByText("Betting closed")).toBeInTheDocument();
    expect(screen.getByText(/in 05:00/)).toBeInTheDocument();
  });

  it.each<[MatchPhase, string]>([
    ["POSTPONED", "Postponed"],
    ["SUSPENDED", "Suspended"],
    ["CANCELLED", "Cancelled"],
    ["DELAYED", "Delayed"],
    ["HALFTIME", "Half time"],
  ])("names the %s state in words with the platform's reason", (phase, word) => {
    renderCard(
      <MatchCard match={match({ phase, statusReason: "Reason from the platform" })} />,
    );

    expect(screen.getByText(word)).toBeInTheDocument();
    expect(screen.getByText("Reason from the platform")).toBeInTheDocument();
  });

  it("shows the last event and the market slot, with markets outside the link", () => {
    renderCard(
      <MatchCard
        to="/matches/match-1"
        now={NOW}
        match={match({ phase: "LIVE", status: "IN_PLAY", clock: clock() })}
        lastEvent={event({ id: "ev-9", kind: "YELLOW_CARD", minute: 61, side: "AWAY", player: "R. Booked" })}
        markets={<button type="button">1X2</button>}
      />,
    );

    const link = screen.getByRole("link", { name: /Test League, Ashford City 0, Riverside 0, live/ });

    expect(within(link).getByText(/R. Booked/)).toBeInTheDocument();
    expect(within(link).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1X2" })).toBeInTheDocument();
  });

  it("marks stale data and holds the reported minute", () => {
    renderCard(
      <MatchCard
        stale
        now={NOW + 10 * 60_000}
        match={match({
          phase: "LIVE",
          status: "IN_PLAY",
          clock: clock({ minute: 30, period: "FIRST_HALF", minuteLengthMs: 60_000 }),
        })}
      />,
    );

    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getByText("30'")).toBeInTheDocument();
  });

  it("renders every variant", () => {
    for (const variant of ["compact", "standard", "featured", "live", "mobile", "shop", "tv"] as const) {
      const { unmount } = renderCard(<MatchCard variant={variant} match={match()} />);

      expect(screen.getByRole("article")).toBeInTheDocument();
      unmount();
    }
  });

  it("has a skeleton and an error state with retry", async () => {
    const onRetry = vi.fn();

    renderCard(
      <>
        <MatchCard.Skeleton variant="compact" />
        <MatchCard.Error variant="standard" onRetry={onRetry} />
      </>,
    );

    expect(screen.getByRole("status", { name: "Loading match" })).toHaveAttribute("aria-busy", "true");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the legacy wrappers linking to the match", () => {
    renderCard(
      <>
        <MatchRow match={match()} />
        <LiveMatchCard match={match({ id: "match-2" as never, phase: "LIVE", status: "IN_PLAY" })} />
      </>,
    );

    const [row, live] = screen.getAllByRole("link");

    expect(row).toHaveAttribute("href", "/matches/match-1");
    expect(live).toHaveAttribute("href", "/matches/match-2?view=watch");
  });
});
