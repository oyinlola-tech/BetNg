import { describe, expect, it } from "vitest";
import {
  isGoal,
  routeMatchEvent,
  routeMatchEvents,
  severityOf,
} from "../src/live/matchEventRouter.js";
import type {
  MatchEventKind,
  MatchEventView,
  MatchSide,
  MatchView,
  TeamView,
} from "../src/types/index.js";

function team(name: string, code: string): TeamView {
  return {
    id: code as TeamView["id"],
    leagueId: "l" as TeamView["leagueId"],
    name,
    shortName: name,
    code,
    city: "",
    stadium: "",
    colors: { primary: "#000", secondary: "#fff", onPrimary: "#fff" },
    strength: 50,
  };
}

const MATCH = {
  home: team("Arsenal", "ARS"),
  away: team("Chelsea", "CHE"),
} satisfies Pick<MatchView, "home" | "away">;

function event(
  kind: MatchEventKind,
  extra: Partial<MatchEventView> = {},
): MatchEventView {
  return {
    id: extra.id ?? `${kind}-1`,
    matchId: "m" as MatchEventView["matchId"],
    sequence: extra.sequence ?? 1,
    kind,
    minute: extra.minute ?? 43,
    score: extra.score ?? { home: 0, away: 0 },
    description: extra.description ?? kind,
    occurredAt: extra.occurredAt ?? "2026-09-22T12:00:00.000Z",
    ...extra,
  };
}

describe("routing one event", () => {
  it("names the team from the side the platform reported", () => {
    const routed = routeMatchEvent(
      event("GOAL", { side: "HOME", player: "Saka", score: { home: 1, away: 0 } }),
      MATCH,
    );

    expect(routed).toMatchObject({
      headline: "Goal",
      teamName: "Arsenal",
      teamCode: "ARS",
      severity: "major",
      animation: "GOAL",
      announce: true,
    });
  });

  it("describes a goal with only what the platform sent", () => {
    const withScorer = routeMatchEvent(
      event("GOAL", { side: "HOME", player: "Saka" }),
      MATCH,
    );
    const withAssist = routeMatchEvent(
      event("GOAL", { side: "HOME", player: "Saka", secondaryPlayer: "Ødegaard" }),
      MATCH,
    );
    const bare = routeMatchEvent(event("GOAL", { side: "AWAY" }), MATCH);

    expect(withScorer.description).toBe("Saka scores for Arsenal.");
    expect(withAssist.description).toBe(
      "Saka scores for Arsenal, assisted by Ødegaard.",
    );
    // No scorer was sent, so none is named and no assist is implied.
    expect(bare.description).toBe("Chelsea");
  });

  it("puts the ball where the laws of the game put it", () => {
    const centre = routeMatchEvent(event("KICK_OFF"), MATCH);
    const corner = routeMatchEvent(event("CORNER", { side: "HOME" }), MATCH);
    const awayCorner = routeMatchEvent(event("CORNER", { side: "AWAY" }), MATCH);
    const restart = routeMatchEvent(
      event("GOAL", { side: "HOME" }),
      MATCH,
    );

    expect(centre.to).toEqual({ x: 50, y: 50 });
    expect(corner.to?.x).toBeGreaterThan(90);
    expect(awayCorner.to?.x).toBeLessThan(10);
    // A goal restarts at the centre spot.
    expect(restart.to).toEqual({ x: 50, y: 50 });
  });

  it("leaves the ball alone for an event with no inherent place", () => {
    expect(routeMatchEvent(event("FOUL", { side: "HOME" }), MATCH).to).toBeUndefined();
  });

  it("prefers coordinates the platform sent over the lawful position", () => {
    const routed = routeMatchEvent(
      event("CORNER", {
        side: "HOME",
        detail: { fromX: 20, fromY: 30, toX: 61, toY: 47 },
      }),
      MATCH,
    );

    expect(routed.from).toEqual({ x: 20, y: 30 });
    expect(routed.to).toEqual({ x: 61, y: 47 });
  });

  it("refuses coordinates that are not usable pitch points", () => {
    const outOfRange = routeMatchEvent(
      event("SHOT", { side: "HOME", detail: { toX: 400, toY: 10 } }),
      MATCH,
    );
    const nonNumeric = routeMatchEvent(
      event("SHOT", { side: "HOME", detail: { toX: "62", toY: 40 } }),
      MATCH,
    );

    // Both fall back to the lawful spot rather than drawing a guess.
    expect(outOfRange.to).toEqual({ x: 100, y: 50 });
    expect(nonNumeric.to).toEqual({ x: 100, y: 50 });
  });

  it("does not announce ordinary play to assistive technology", () => {
    expect(routeMatchEvent(event("CORNER", { side: "HOME" }), MATCH).announce).toBe(false);
    expect(routeMatchEvent(event("FOUL"), MATCH).announce).toBe(false);
    expect(routeMatchEvent(event("RED_CARD", { side: "HOME" }), MATCH).announce).toBe(true);
  });

  it("ranks a goal above the corner it came from", () => {
    const goal = routeMatchEvent(event("GOAL", { side: "HOME" }), MATCH);
    const corner = routeMatchEvent(event("CORNER", { side: "HOME" }), MATCH);

    expect(goal.priority).toBeGreaterThan(corner.priority);
    expect(severityOf("GOAL")).toBe("major");
    expect(severityOf("FOUL")).toBe("minor");
    expect(isGoal("PENALTY_GOAL")).toBe(true);
    expect(isGoal("PENALTY_MISSED")).toBe(false);
  });
});

describe("routing the stream", () => {
  it("orders by the platform's sequence, not arrival order", () => {
    const routed = routeMatchEvents(
      [
        event("CORNER", { id: "c", sequence: 3, side: "HOME" }),
        event("KICK_OFF", { id: "k", sequence: 1 }),
        event("FOUL", { id: "f", sequence: 2 }),
      ],
      MATCH,
    );

    expect(routed.map((e) => e.id)).toEqual(["k", "f", "c"]);
  });

  it("shows a redelivered goal once", () => {
    const goal = event("GOAL", { id: "g1", sequence: 5, side: "HOME", score: { home: 1, away: 0 } });
    const routed = routeMatchEvents([goal, { ...goal }], MATCH);

    expect(routed).toHaveLength(1);
  });

  it("never lets an older redelivery overwrite a newer event", () => {
    const routed = routeMatchEvents(
      [
        event("GOAL", { id: "g1", sequence: 9, minute: 61, side: "HOME" }),
        event("GOAL", { id: "g1", sequence: 4, minute: 12, side: "HOME" }),
      ],
      MATCH,
    );

    expect(routed).toHaveLength(1);
    expect(routed[0]?.minute).toBe(61);
  });
});

/** The deterministic fixture from the brief, start to finish. */
describe("a whole match", () => {
  const SEQUENCE: readonly (readonly [MatchEventKind, MatchSide | undefined])[] = [
    ["KICK_OFF", undefined],
    ["SHOT", "HOME"],
    ["CORNER", "HOME"],
    ["YELLOW_CARD", "AWAY"],
    ["GOAL", "HOME"],
    ["HALF_TIME", undefined],
    ["SECOND_HALF", undefined],
    ["SUBSTITUTION", "AWAY"],
    ["GOAL", "AWAY"],
    ["FULL_TIME", undefined],
  ];

  it("routes every event and keeps the platform's score", () => {
    const events = SEQUENCE.map(([kind, side], index) =>
      event(kind, {
        id: `e${String(index)}`,
        sequence: index + 1,
        minute: index * 9,
        ...(side === undefined ? {} : { side }),
        score:
          index >= 8
            ? { home: 1, away: 1 }
            : index >= 4
              ? { home: 1, away: 0 }
              : { home: 0, away: 0 },
      }),
    );

    const routed = routeMatchEvents(events, MATCH);

    expect(routed).toHaveLength(SEQUENCE.length);
    expect(routed.at(-1)?.score).toEqual({ home: 1, away: 1 });
    // Two goals and full time carry the weight; cards, the substitution and
    // half time are medium, and ordinary play is minor.
    expect(routed.filter((e) => e.severity === "major").map((e) => e.kind)).toEqual([
      "GOAL",
      "GOAL",
      "FULL_TIME",
    ]);
  });
});
