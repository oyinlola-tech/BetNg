import { describe, expect, it, vi } from "vitest";
import { BetNgApiError, type BetNgRestClient, type RealtimeClient, type RealtimeEvent } from "@betng/client-sdk";
import { createPlatformDataSource } from "../src/adapters/platformDataSource.js";
import type { MatchSignal } from "../src/dataSource.type.js";
import type { MatchEventView, SlipSelection } from "../src/types/index.js";
import * as wire from "../../contracts/tests/fixtures/wire.js";

const T = "2026-09-21T12:00:00.000Z";

const league = { id: wire.IDS.league, name: "Premier League", code: "EPL", slug: "premier-league", country: "England", status: "ACTIVE", createdAt: T };
const team = (id: string, name: string): Record<string, unknown> => ({ id, leagueId: wire.IDS.league, name, shortName: name.slice(0, 3).toUpperCase(), strength: 70, createdAt: T });

function fakeRealtime(): { client: RealtimeClient; emit: (channel: string, event: RealtimeEvent) => void; desync: (channel: string) => void; channels: string[] } {
  const listeners = new Map<string, Set<(event: RealtimeEvent) => void>>();
  const gaps = new Set<(channel: string) => void>();
  const channels: string[] = [];

  return {
    channels,
    emit: (channel, event) => {
      for (const l of listeners.get(channel) ?? []) l(event);
    },
    desync: (channel) => {
      for (const l of gaps) l(channel);
    },
    client: {
      connect: () => undefined,
      close: () => undefined,
      subscribe: (channel, listener) => {
        channels.push(channel);

        const set = listeners.get(channel) ?? new Set();

        set.add(listener);
        listeners.set(channel, set);

        return () => set.delete(listener);
      },
      on: () => () => undefined,
      onDesync: (listener) => {
        gaps.add(listener);

        return () => gaps.delete(listener);
      },
      status: () => "CONNECTED",
      onStatus: () => () => undefined,
      lastConnectedAt: () => undefined,
      replaceConnection: () => undefined,
    },
  };
}

function fakeRest(over: Partial<BetNgRestClient>): BetNgRestClient {
  const notServed = async (): Promise<never> => {
    throw new BetNgApiError(404, { code: "NOT_FOUND", message: "not served", requestId: "r" });
  };
  const base = {
    listLeagues: async () => [league],
    listTeams: async () => [team(wire.IDS.home, "Ashford City"), team(wire.IDS.away, "Riverside")],
    listFixtures: async () => [wire.fixtureResponse],
    getMatch: async () => wire.matchResponse,
    ...over,
  };

  return new Proxy(base, { get: (target, key) => (target as Record<string | symbol, unknown>)[key] ?? notServed }) as unknown as BetNgRestClient;
}

const selection = { matchId: wire.IDS.match, marketId: wire.IDS.market, selectionId: wire.IDS.selectionHome, marketKind: "MATCH_RESULT", marketName: "Match Result", selectionLabel: "Home", odds: 2.15, oddsVersion: 3, matchLabel: "A v B", leagueCode: "EPL", kickoffAt: T } as unknown as SlipSelection;

describe("platform data source", () => {
  it("takes the phase and clock from the platform's own events, never from the time", async () => {
    const events = [
      { id: "e1", matchId: wire.IDS.match, type: "KICK_OFF", minute: 0, description: "Kick-off" },
      { id: "e2", matchId: wire.IDS.match, type: "GOAL", minute: 12, side: "HOME", description: "Goal" },
      { id: "e3", matchId: wire.IDS.match, type: "HALF_TIME", minute: 45, description: "Half time" },
    ];
    const source = createPlatformDataSource({ rest: fakeRest({ listMatchEvents: async () => events as never }), realtime: fakeRealtime().client, userId: wire.IDS.user });
    const match = await source.getMatch(wire.IDS.match as never);

    expect(match.phase).toBe("HALFTIME");
    expect(match.clock).toMatchObject({ period: "HALF_TIME", minute: 45 });
    expect(match.score).toEqual({ home: 1, away: 0 });
  });

  it("prefers a clock the platform reports on the match", async () => {
    const source = createPlatformDataSource({
      rest: fakeRest({ getMatch: async () => ({ ...wire.matchResponse, clock: wire.clockResponse }) as never }),
      realtime: fakeRealtime().client,
      userId: wire.IDS.user,
    });

    expect((await source.getMatch(wire.IDS.match as never)).clock).toEqual(wire.clockResponse);
  });

  it("shows an in-play match without a reported clock as live with no minute", async () => {
    const source = createPlatformDataSource({ rest: fakeRest({}), realtime: fakeRealtime().client, userId: wire.IDS.user });
    const match = await source.getMatch(wire.IDS.match as never);

    expect(match.phase).toBe("LIVE");
    expect(match.clock).toBeUndefined();
  });

  it("submits a bet once with the client reference as the idempotency key", async () => {
    const placeBet = vi.fn(async () => wire.betResponse as never);
    const source = createPlatformDataSource({ rest: fakeRest({ placeBet }), realtime: fakeRealtime().client, userId: wire.IDS.user });
    const placement = await source.placeBet({ selections: [selection], stake: 50_000, clientReference: "ref-12345678" });

    expect(placeBet).toHaveBeenCalledWith(expect.objectContaining({ stake: 50_000, selections: [expect.objectContaining({ oddsVersion: 3 })] }), { idempotencyKey: "ref-12345678" });
    expect(placement).toMatchObject({ outcome: "ACCEPTED", clientReference: "ref-12345678", bet: { potentialPayout: 107_500 } });
  });

  it("returns a business refusal as a result and throws a transport failure", async () => {
    const refuse = async (): Promise<never> => {
      throw new BetNgApiError(422, wire.errorResponse.error);
    };
    const refused = createPlatformDataSource({ rest: fakeRest({ placeBet: refuse }), realtime: fakeRealtime().client, userId: wire.IDS.user });

    expect(await refused.placeBet({ selections: [selection], stake: 50_000, clientReference: "ref-12345678" })).toMatchObject({
      outcome: "REJECTED",
      reason: "STAKE_LIMITED",
      maxStake: 20_000,
    });

    const down = createPlatformDataSource({
      rest: fakeRest({
        placeBet: async () => {
          throw new BetNgApiError(0, { code: "UPSTREAM_UNAVAILABLE", message: "down", requestId: "r" }, { kind: "network" });
        },
      }),
      realtime: fakeRealtime().client,
      userId: wire.IDS.user,
    });

    await expect(down.placeBet({ selections: [selection], stake: 50_000, clientReference: "ref-12345678" })).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("reports a limited stake when the platform accepts less than was asked", async () => {
    const source = createPlatformDataSource({
      rest: fakeRest({ placeBet: async () => ({ ...wire.betResponse, stake: 20_000, potentialPayout: 43_000 }) as never }),
      realtime: fakeRealtime().client,
      userId: wire.IDS.user,
    });

    expect(await source.placeBet({ selections: [selection], stake: 50_000, clientReference: "ref-12345678" })).toMatchObject({ outcome: "LIMITED", bet: { stake: 20_000 } });
  });

  it("routes timeline frames to onEvent and lifecycle frames to onSignal", () => {
    const realtime = fakeRealtime();
    const source = createPlatformDataSource({ rest: fakeRest({}), realtime: realtime.client, userId: wire.IDS.user });
    const events: MatchEventView[] = [];
    const signals: MatchSignal[] = [];

    source.subscribeMatch(wire.IDS.match as never, { onEvent: (e) => events.push(e), onSignal: (s) => signals.push(s), onConnection: () => undefined });

    const channel = `match:${wire.IDS.match}`;

    for (const frame of wire.liveFrames) realtime.emit(channel, { type: frame.type as never, channel, sequence: frame.sequence, payload: frame });

    realtime.desync(channel);

    expect(realtime.channels).toEqual([channel]);
    expect(events.map((e) => e.kind)).toEqual(["KICK_OFF", "GOAL", "HALF_TIME", "FULL_TIME"]);
    expect(signals).toEqual(["BETTING_CLOSED", "SETTLEMENT_COMPLETED", "MATCH_UPDATED"]);
  });

  it("degrades to empty for reads the gateway does not serve yet", async () => {
    const source = createPlatformDataSource({ rest: fakeRest({}), realtime: fakeRealtime().client, userId: wire.IDS.user });

    expect(await source.getMatchLineups(wire.IDS.match as never)).toEqual({ matchId: wire.IDS.match, confirmed: false });
    expect((await source.getHeadToHead(wire.IDS.match as never)).meetings).toEqual([]);
    expect((await source.getPlatformConfig()).currency.code).toBe("NGN");
    expect(await source.search({ term: "a" })).toEqual({ term: "a", hits: [] });
  });

  it("pages transactions itself when the service answers an unpaged list", async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ ...wire.transactionResponse, id: `t${String(i)}` }));
    const source = createPlatformDataSource({ rest: fakeRest({ queryTransactions: async () => ({ items }) as never }), realtime: fakeRealtime().client, userId: wire.IDS.user });
    const page = await source.queryTransactions({ page: 2, pageSize: 10 });

    expect(page).toMatchObject({ page: 2, pageSize: 10, total: 25 });
    expect(page.items.map((t) => t.id)).toEqual(items.slice(10, 20).map((t) => t.id));
  });
});
