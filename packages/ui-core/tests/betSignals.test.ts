import { describe, expect, it } from "vitest";
import { BetNgApiError, type BetNgRestClient, type RealtimeClient, type RealtimeEvent } from "@betng/client-sdk";
import { createPlatformDataSource } from "../src/adapters/platformDataSource.js";
import type { BetSignal } from "../src/dataSource.type.js";

const USER = "3f0c9a52-7a51-4c61-9f0a-5a1c2b7d8e90";

function fakeRealtime(): { readonly client: RealtimeClient; readonly emit: (channel: string, event: Partial<RealtimeEvent>) => void; readonly open: () => readonly string[] } {
  const listeners = new Map<string, Set<(event: RealtimeEvent) => void>>();

  return {
    emit: (channel, event) => {
      for (const listener of listeners.get(channel) ?? []) listener({ channel, payload: undefined, ...event } as RealtimeEvent);
    },
    open: () => [...listeners.entries()].filter(([, set]) => set.size > 0).map(([channel]) => channel),
    client: {
      connect: () => undefined,
      close: () => undefined,
      subscribe: (channel, listener) => {
        const set = listeners.get(channel) ?? new Set();

        set.add(listener);
        listeners.set(channel, set);

        return () => set.delete(listener);
      },
      on: () => () => undefined,
      onDesync: () => () => undefined,
      status: () => "CONNECTED",
      onStatus: () => () => undefined,
      lastConnectedAt: () => undefined,
      replaceConnection: () => undefined,
    },
  };
}

function rest(over: Partial<BetNgRestClient> = {}): BetNgRestClient {
  const notServed = async (): Promise<never> => {
    throw new BetNgApiError(404, { code: "NOT_FOUND", message: "not served", requestId: "r" });
  };

  return new Proxy(over, { get: (target, key) => (target as Record<string | symbol, unknown>)[key] ?? notServed }) as unknown as BetNgRestClient;
}

describe("bet signals", () => {
  it("passes bet signals from the account and bets channels through as re-read hints, and nothing else", () => {
    const realtime = fakeRealtime();
    const source = createPlatformDataSource({ rest: rest(), realtime: realtime.client, userId: USER, accountChannel: true });
    const seen: BetSignal[] = [];
    const stop = source.subscribeBetSignals?.((signal) => seen.push(signal));

    expect(realtime.open()).toEqual([`user:${USER}`, `bets:${USER}`]);

    realtime.emit(`bets:${USER}`, { type: "BET_SETTLED", payload: { betId: "bet-7", status: "WON", payout: 999_999 } });
    realtime.emit(`user:${USER}`, { type: "BET_ACCEPTED", payload: { betId: "../../admin" } });
    realtime.emit(`user:${USER}`, { type: "WALLET_UPDATED" });
    realtime.emit(`user:${USER}`, { type: "BET_UPDATED", payload: null });

    expect(seen).toEqual([{ kind: "BET_SETTLED", betId: "bet-7" }, { kind: "BET_ACCEPTED" }, { kind: "BET_UPDATED" }]);

    stop?.();
    expect(realtime.open()).toEqual([]);
  });

  it("stays silent until the realtime endpoint authenticates account channels", () => {
    const realtime = fakeRealtime();
    const source = createPlatformDataSource({ rest: rest(), realtime: realtime.client, userId: USER });

    source.subscribeBetSignals?.(() => undefined);
    expect(realtime.open()).toEqual([]);
  });

  it("maps the platform's web push key from /config", async () => {
    const vapidPublicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const currency = { code: "NGN", symbol: "₦", minorUnits: 2, locale: "en-NG" };
    const withPush = createPlatformDataSource({ rest: rest({ getPublicConfig: async () => ({ currency, features: {}, webPush: { vapidPublicKey } }) }), realtime: fakeRealtime().client, userId: USER });
    const without = createPlatformDataSource({ rest: rest({ getPublicConfig: async () => ({ currency, features: {} }) }), realtime: fakeRealtime().client, userId: USER });

    expect((await withPush.getPlatformConfig()).webPush).toEqual({ vapidPublicKey });
    expect((await without.getPlatformConfig()).webPush).toBeUndefined();
  });
});
