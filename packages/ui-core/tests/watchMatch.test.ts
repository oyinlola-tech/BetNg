import { describe, expect, it, vi } from "vitest";
import type { BetNgDataSource, LiveMatchHandlers } from "../src/dataSource.type.js";
import { watchMatch } from "../src/live/watchMatch.js";
import type { MatchEventView, MatchView } from "../src/types/index.js";

const T = "2026-09-21T12:00:00.000Z";

const base = { id: "m1", status: "IN_PLAY", phase: "LIVE", kickoffAt: T, score: { home: 0, away: 0 }, events: [] } as unknown as MatchView;

const event = (sequence: number, kind: MatchEventView["kind"], minute: number, score = { home: 0, away: 0 }): MatchEventView =>
  ({ id: `m1-${String(sequence)}`, matchId: "m1", sequence, kind, minute, score, description: kind, occurredAt: T }) as MatchEventView;

function harness(match: MatchView = base): { source: BetNgDataSource; handlers: () => LiveMatchHandlers; getMatch: ReturnType<typeof vi.fn> } {
  let handlers: LiveMatchHandlers | undefined;
  const getMatch = vi.fn(async () => match);
  const source = {
    getMatch,
    getConnectionState: () => "CONNECTED",
    subscribeMatch: (_id: string, h: LiveMatchHandlers) => {
      handlers = h;

      return { unsubscribe: () => undefined };
    },
  } as unknown as BetNgDataSource;

  return { source, getMatch, handlers: () => handlers as LiveMatchHandlers };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("watchMatch", () => {
  it("moves to half time and back on the platform's events alone", async () => {
    const { source, handlers } = harness();
    const controller = watchMatch(source, "m1" as never);

    await settle();
    handlers().onEvent(event(3, "GOAL", 12, { home: 1, away: 0 }));
    handlers().onEvent(event(4, "HALF_TIME", 45, { home: 1, away: 0 }));

    expect(controller.getSnapshot().match).toMatchObject({ phase: "HALFTIME", clock: { period: "HALF_TIME", minute: 45 }, score: { home: 1, away: 0 } });

    handlers().onEvent(event(5, "SECOND_HALF", 45, { home: 1, away: 0 }));

    expect(controller.getSnapshot().match?.phase).toBe("LIVE");
    controller.stop();
  });

  it("ignores a duplicate or older event", async () => {
    const { source, handlers } = harness();
    const controller = watchMatch(source, "m1" as never);

    await settle();
    handlers().onEvent(event(3, "GOAL", 12, { home: 1, away: 0 }));
    handlers().onEvent(event(3, "GOAL", 12, { home: 1, away: 0 }));
    handlers().onEvent(event(2, "CORNER", 10));

    expect(controller.getSnapshot().match?.events).toHaveLength(1);
    controller.stop();
  });

  it("re-reads the match on a sequence gap, a lifecycle signal, full time and a reconnect", async () => {
    const { source, handlers, getMatch } = harness();
    const controller = watchMatch(source, "m1" as never);

    await settle();
    expect(getMatch).toHaveBeenCalledTimes(1);

    handlers().onEvent(event(3, "CORNER", 10));
    handlers().onEvent(event(6, "CORNER", 20));
    await settle();
    expect(getMatch).toHaveBeenCalledTimes(2);

    handlers().onSignal?.("SETTLEMENT_COMPLETED");
    await settle();
    expect(getMatch).toHaveBeenCalledTimes(3);

    handlers().onEvent(event(7, "FULL_TIME", 90));
    await settle();
    expect(getMatch).toHaveBeenCalledTimes(4);

    handlers().onConnection("RECONNECTING");
    handlers().onConnection("CONNECTED");
    await settle();
    expect(getMatch).toHaveBeenCalledTimes(5);
    expect(controller.getSnapshot().syncedAt).toBeTypeOf("number");
    controller.stop();
  });

  it("does not duplicate an event the re-read already contained", async () => {
    const already = { ...base, events: [{ ...event(1, "GOAL", 12, { home: 1, away: 0 }), id: "rest-id" }] } as MatchView;
    const { source, handlers } = harness(already);
    const controller = watchMatch(source, "m1" as never);

    await settle();
    handlers().onEvent(event(9, "GOAL", 12, { home: 1, away: 0 }));

    expect(controller.getSnapshot().match?.events).toHaveLength(1);
    controller.stop();
  });
});
