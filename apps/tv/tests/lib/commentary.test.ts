import { describe, expect, it } from "vitest";
import { buildFeed, pickSpotlight, severityOf, spotlightScore } from "../../src/lib/commentary";
import { event, match } from "../fakes/platform";

describe("TV commentary feed", () => {
  // Grading now comes from the shared event router, so TV weighs an event
  // exactly as web, shop and mobile do. A sending-off is decisive, which is
  // why it sits with the goals rather than with the bookings.
  it("grades goals and red cards large, bookings medium and corners small", () => {
    expect(severityOf("GOAL")).toBe("major");
    expect(severityOf("PENALTY_GOAL")).toBe("major");
    expect(severityOf("RED_CARD")).toBe("major");
    expect(severityOf("YELLOW_CARD")).toBe("medium");
    expect(severityOf("CORNER")).toBe("minor");
  });

  it("puts stream arrivals first by platform time, then history by minute", () => {
    const a = match("a", {
      events: [event("CORNER", 10, { home: 0, away: 0 }), event("GOAL", 20, { home: 1, away: 0 }), event("SHOT", 30, { home: 1, away: 0 }, { occurredAt: "2026-09-22T12:05:00.000Z" })],
    });
    const b = match("b", { events: [event("YELLOW_CARD", 25, { home: 0, away: 0 }), event("GOAL", 31, { home: 0, away: 1 }, { occurredAt: "2026-09-22T12:06:00.000Z" })] });
    const feed = buildFeed([a, b]);

    expect(feed.map((i) => `${i.matchId}:${i.kind}`)).toEqual(["b:GOAL", "a:SHOT", "b:YELLOW_CARD", "a:GOAL", "a:CORNER"]);
    expect(feed[0]?.at).toBe(Date.parse("2026-09-22T12:06:00.000Z"));
    expect(feed[3]?.at).toBeUndefined();
  });

  it("keeps only goals, red cards and full time in quiet mode", () => {
    const m = match("q", { events: [event("CORNER", 5, { home: 0, away: 0 }), event("RED_CARD", 6, { home: 0, away: 0 }), event("GOAL", 7, { home: 1, away: 0 }), event("FULL_TIME", 90, { home: 1, away: 0 })] });

    expect(buildFeed([m], { quiet: true }).map((i) => i.kind)).toEqual(["FULL_TIME", "GOAL", "RED_CARD"]);
  });
});

describe("TV match of the moment", () => {
  it("scores the platform timeline by the published rule", () => {
    const m = match("s", {
      score: { home: 1, away: 1 },
      events: [event("GOAL", 30, { home: 1, away: 0 }), event("RED_CARD", 50, { home: 1, away: 0 }), event("GOAL", 88, { home: 1, away: 1 }, { side: "AWAY" })],
    });
    const s = spotlightScore(m);

    expect(s.points).toBe(3 + 2 + 3 + 4 + 2 + 1);
    expect(s.reasons).toEqual(["Late equaliser 88'", "2 goals", "Red card", "One goal in it"]);
  });

  it("follows the most eventful live match and ignores finished ones", () => {
    const quiet = match("quiet", { score: { home: 0, away: 0 } });
    const busy = match("busy", { score: { home: 2, away: 0 }, events: [event("GOAL", 10, { home: 1, away: 0 }), event("GOAL", 12, { home: 2, away: 0 })] });
    const over = match("over", { phase: "FINISHED", score: { home: 5, away: 4 }, events: [event("GOAL", 1, { home: 1, away: 0 }), event("GOAL", 2, { home: 2, away: 0 }), event("GOAL", 3, { home: 3, away: 0 })] });

    expect(pickSpotlight([quiet, busy, over])?.matchId).toBe("busy");
    expect(pickSpotlight([over])).toBeUndefined();
  });

  it("does not move for a lead smaller than the margin, and breaks ties deterministically", () => {
    const held = match("held", { score: { home: 1, away: 0 }, events: [event("GOAL", 5, { home: 1, away: 0 })] });
    const challenger = match("challenger", { score: { home: 1, away: 0 }, events: [event("GOAL", 5, { home: 1, away: 0 }), event("VAR", 6, { home: 1, away: 0 })] });

    expect(pickSpotlight([held, challenger], "held")?.matchId).toBe("held");
    expect(pickSpotlight([held, challenger])?.matchId).toBe("challenger");

    const twinA = match("a-twin", { kickoffAt: "2026-09-22T12:00:00.000Z" });
    const twinB = match("b-twin", { kickoffAt: "2026-09-22T12:00:00.000Z" });

    expect(pickSpotlight([twinB, twinA])?.matchId).toBe("a-twin");
    expect(pickSpotlight([twinA, twinB])?.matchId).toBe("a-twin");
  });
});
