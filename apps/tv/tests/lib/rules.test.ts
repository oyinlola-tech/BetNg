import { describe, expect, it } from "vitest";
import type { MatchSummary } from "@betng/ui-core";
import { featuredMatch, goalDifferenceBar, ordinal, withinNextDay } from "../../src/lib/fixtures";
import { inSequence, replayScore, replaySchedule, revealedAt } from "../../src/lib/replay";
import { channelTarget, commandFor } from "../../src/navigation/remoteKeys";
import { event, match, standings, team } from "../fakes/platform";

const summary = (id: string, overrides: Parameters<typeof match>[1] = {}): MatchSummary => {
  const { events: _e, stats: _s, ...rest } = match(id, { phase: "BETTING_OPEN", ...overrides });

  return rest;
};

describe("TV featured upcoming match", () => {
  it("features the meeting of the highest-placed teams, deterministically", () => {
    const t = ["t1", "t2", "t3", "t4"].map((id) => team(id, id.toUpperCase()));
    const table = new Map([["league-1", standings("league-1", t)]]);
    const a = summary("a", { home: t[2] as never, away: t[3] as never });
    const b = summary("b", { home: t[0] as never, away: t[3] as never, kickoffAt: "2026-09-22T13:00:00.000Z" });
    const c = summary("c", { home: t[1] as never, away: t[2] as never, kickoffAt: "2026-09-22T12:30:00.000Z" });

    expect(featuredMatch([a, b, c], table)).toEqual({ matchId: "c", homePosition: 2, awayPosition: 3 });
    expect(featuredMatch([a, b, c], new Map())).toBeUndefined();
  });

  it("formats positions and the goal difference bar", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
    expect(goalDifferenceBar(5, 10)).toEqual({ direction: "up", percent: 50 });
    expect(goalDifferenceBar(-10, 10)).toEqual({ direction: "down", percent: 100 });
    expect(goalDifferenceBar(0, 10)).toEqual({ direction: "level", percent: 0 });
  });

  it("lists the next 24 hours from platform kick-off times", () => {
    const now = Date.parse("2026-09-22T12:00:00.000Z");
    const list = [summary("late", { kickoffAt: "2026-09-23T12:00:01.000Z" }), summary("soon", { kickoffAt: "2026-09-22T12:30:00.000Z" }), summary("past", { kickoffAt: "2026-09-22T11:00:00.000Z" })];

    expect(withinNextDay(list, now).map((m) => m.id)).toEqual(["soon"]);
  });
});

describe("TV replay", () => {
  it("plays back the recorded timeline in order with the recorded scores", () => {
    const events = inSequence([event("KICK_OFF", 0, { home: 0, away: 0 }), event("GOAL", 10, { home: 1, away: 0 }), event("GOAL", 10, { home: 1, away: 1 }, { side: "AWAY" }), event("FULL_TIME", 90, { home: 1, away: 1 })]);
    const schedule = replaySchedule(events, 100);

    expect(schedule).toEqual([0, 1000, 1700, 9000]);
    expect(revealedAt(schedule, 0)).toBe(1);
    expect(replayScore(events, revealedAt(schedule, 1200))).toEqual({ home: 1, away: 0 });
    expect(replayScore(events, revealedAt(schedule, 9000))).toEqual({ home: 1, away: 1 });
    expect(replayScore(events, 0)).toEqual({ home: 0, away: 0 });
  });
});

describe("TV remote commands", () => {
  it("maps channel, volume and info keys", () => {
    const key = (k: string): ReturnType<typeof commandFor> => commandFor({ key: k, altKey: false, ctrlKey: false, metaKey: false });

    expect(key("ChannelUp")).toBe("CHANNEL_UP");
    expect(key("PageDown")).toBe("CHANNEL_DOWN");
    expect(key("AudioVolumeUp")).toBe("VOLUME_UP");
    expect(key("-")).toBe("VOLUME_DOWN");
    expect(key("Info")).toBe("SCHEDULE");
    expect(key("ArrowUp")).toBeUndefined();
    expect(commandFor({ key: "+", altKey: false, ctrlKey: true, metaKey: false })).toBeUndefined();
  });

  it("steps through leagues on league screens and opens the board elsewhere", () => {
    const ids = ["a", "b", "c"];

    expect(channelTarget("/standings", "?league=b", ids, 1)).toEqual({ to: "/standings?league=c", leagueId: "c" });
    expect(channelTarget("/standings", "?league=a", ids, -1)).toEqual({ to: "/standings?league=c", leagueId: "c" });
    expect(channelTarget("/live/x", "", ids, 1)).toEqual({ to: "/board?league=a", leagueId: "a" });
    expect(channelTarget("/board", "", [], 1)).toBeUndefined();
  });
});
