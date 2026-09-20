import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionStore, hasPermission, type SessionStorage } from "../src/session.js";

interface TestSession {
  readonly token: string;
  readonly expiresAt: string;
}

function memoryStorage(initial: Record<string, string> = {}): SessionStorage & { readonly data: Map<string, string> } {
  const data = new Map(Object.entries(initial));

  return {
    data,
    get: (key) => data.get(key),
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}

const at = (ms: number): string => new Date(ms).toISOString();

describe("createSessionStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts anonymous and carries no token", () => {
    const store = createSessionStore<TestSession>("k", memoryStorage());

    expect(store.snapshot()).toEqual({ status: "ANONYMOUS", session: undefined });
    expect(store.token()).toBeUndefined();
  });

  it("persists a session and restores it on the next start", () => {
    const storage = memoryStorage();
    const session = { token: "t".repeat(20), expiresAt: at(2_000_000) };

    createSessionStore<TestSession>("k", storage).set(session);

    const restored = createSessionStore<TestSession>("k", storage);

    expect(restored.snapshot().status).toBe("AUTHENTICATED");
    expect(restored.token()).toBe(session.token);
  });

  it("discards a stored session that has already run out", () => {
    const storage = memoryStorage({ k: JSON.stringify({ token: "t".repeat(20), expiresAt: at(500_000) }) });
    const store = createSessionStore<TestSession>("k", storage);

    expect(store.snapshot().status).toBe("ANONYMOUS");
    expect(storage.data.has("k")).toBe(false);
  });

  it("survives corrupt storage", () => {
    const store = createSessionStore<TestSession>("k", memoryStorage({ k: "{not json" }));

    expect(store.snapshot().status).toBe("ANONYMOUS");
  });

  it("expires on its own at expiresAt, keeps the identity for the re-login prompt, and drops the token", () => {
    const storage = memoryStorage();
    const store = createSessionStore<TestSession>("k", storage);
    const listener = vi.fn();

    store.subscribe(listener);
    store.set({ token: "t".repeat(20), expiresAt: at(1_060_000) });
    vi.advanceTimersByTime(60_001);

    expect(store.snapshot().status).toBe("EXPIRED");
    expect(store.snapshot().session?.token).toBeDefined();
    expect(store.token()).toBeUndefined();
    expect(storage.data.has("k")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("returns a stable snapshot between changes, as useSyncExternalStore requires", () => {
    const store = createSessionStore<TestSession>("k");

    expect(store.snapshot()).toBe(store.snapshot());
  });

  it("clear signs out and expire is a no-op when signed out", () => {
    const store = createSessionStore<TestSession>("k", memoryStorage());

    store.set({ token: "t".repeat(20), expiresAt: at(2_000_000) });
    store.clear();
    store.expire();

    expect(store.snapshot()).toEqual({ status: "ANONYMOUS", session: undefined });
  });

  it("stops notifying after unsubscribe", () => {
    const store = createSessionStore<TestSession>("k");
    const listener = vi.fn();

    store.subscribe(listener)();
    store.set({ token: "t".repeat(20), expiresAt: at(2_000_000) });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("hasPermission", () => {
  it("denies when the platform sent no permissions", () => {
    expect(hasPermission(undefined, "tickets:sell")).toBe(false);
  });

  it("allows only what is listed", () => {
    expect(hasPermission(["tickets:sell"], "tickets:sell")).toBe(true);
    expect(hasPermission(["tickets:sell"], "tickets:payout")).toBe(false);
  });
});
