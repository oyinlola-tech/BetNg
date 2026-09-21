import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchTimeline } from "../../src/match/MatchTimeline";
import { AWAY, HOME, event } from "./fixtures";

const TEAMS = { home: HOME, away: AWAY };

const EVENTS = [
  event({ id: "e-ko", kind: "KICK_OFF", sequence: 1, minute: 0 }),
  event({ id: "e-goal", kind: "GOAL", sequence: 2, minute: 12, side: "HOME", player: "A. Striker", secondaryPlayer: "B. Winger", score: { home: 1, away: 0 } }),
  event({ id: "e-og", kind: "OWN_GOAL", sequence: 3, minute: 30, side: "HOME", player: "C. Unlucky", score: { home: 1, away: 1 } }),
  event({ id: "e-ht", kind: "HALF_TIME", sequence: 4, minute: 45, score: { home: 1, away: 1 } }),
  event({ id: "e-2h", kind: "SECOND_HALF", sequence: 5, minute: 45, score: { home: 1, away: 1 } }),
  event({ id: "e-sub", kind: "SUBSTITUTION", sequence: 6, minute: 60, side: "AWAY", player: "D. Fresh", secondaryPlayer: "E. Tired" }),
  event({ id: "e-corner", kind: "CORNER", sequence: 7, minute: 70, side: "AWAY", description: "Corner to Riverside", detail: { bodyPart: "head", reviewed: true, ignored: false } }),
  event({ id: "e-ft", kind: "FULL_TIME", sequence: 8, minute: 90, score: { home: 1, away: 1 } }),
];

describe("MatchTimeline", () => {
  it("orders by the platform's sequence whatever order the events arrive in", () => {
    render(<MatchTimeline match={TEAMS} events={[...EVENTS].reverse()} newestFirst={false} />);

    const list = screen.getByRole("list", { name: "Match timeline" });
    const kinds = within(list)
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-kind"))
      .filter((kind) => kind !== null);

    expect(list.tagName).toBe("OL");
    expect(kinds).toEqual(["KICK_OFF", "GOAL", "OWN_GOAL", "HALF_TIME", "SECOND_HALF", "SUBSTITUTION", "CORNER", "FULL_TIME"]);
  });

  it("shows newest first by default", () => {
    render(<MatchTimeline match={TEAMS} events={EVENTS} />);

    const first = within(screen.getByRole("list", { name: "Match timeline" })).getAllByRole("listitem")[0];

    expect(first).toHaveAttribute("data-kind", "FULL_TIME");
  });

  it("draws period dividers", () => {
    render(<MatchTimeline match={TEAMS} events={EVENTS} />);

    for (const label of ["Kick-off", "Half time", "Second half", "Full time"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("credits an own goal through the platform's running score, not the event side", () => {
    render(<MatchTimeline match={TEAMS} events={EVENTS} newestFirst={false} />);

    const row = screen.getByText("C. Unlucky").closest("li");

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("1–1")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Own goal")).toBeInTheDocument();
  });

  it("shows assist, substitution in and out, and detail chips", () => {
    render(<MatchTimeline match={TEAMS} events={EVENTS} />);

    expect(screen.getByText(/Assist: B. Winger/)).toBeInTheDocument();
    expect(screen.getByText("In: D. Fresh")).toBeInTheDocument();
    expect(screen.getByText("Out: E. Tired")).toBeInTheDocument();
    expect(screen.getByText("body part: head")).toBeInTheDocument();
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/ignored/)).not.toBeInTheDocument();
  });

  it("filters to key events and keeps the most recent under a limit", () => {
    const { rerender } = render(<MatchTimeline match={TEAMS} events={EVENTS} keyEventsOnly />);

    expect(screen.queryByText("Corner to Riverside")).not.toBeInTheDocument();

    rerender(<MatchTimeline match={TEAMS} events={EVENTS} limit={2} />);

    expect(screen.getByText("Full time")).toBeInTheDocument();
    expect(screen.getByText("Corner to Riverside")).toBeInTheDocument();
    expect(screen.queryByText("A. Striker")).not.toBeInTheDocument();
  });

  it("animates only rows that arrive after mount", () => {
    const { rerender } = render(<MatchTimeline match={TEAMS} events={EVENTS.slice(0, 2)} />);

    expect(screen.getByText("A. Striker").closest("li")).not.toHaveClass("animate-event-in");

    rerender(<MatchTimeline match={TEAMS} events={EVENTS.slice(0, 3)} />);

    expect(screen.getByText("C. Unlucky").closest("li")).toHaveClass("animate-event-in");
    expect(screen.getByText("A. Striker").closest("li")).not.toHaveClass("animate-event-in");
  });

  it("has an empty state", () => {
    render(<MatchTimeline match={TEAMS} events={[]} />);

    expect(screen.getByText("No events yet")).toBeInTheDocument();
  });
});
