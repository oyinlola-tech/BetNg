import { describe, expect, it } from "vitest";
import { canRunFinancialCommand, createOfflineCache, isCacheableKind } from "../../src/platform/offlineCache";

function memory() {
  const map = new Map<string, string>();

  return { map, store: { get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => void map.set(k, v), remove: (k: string) => void map.delete(k) } };
}

describe("offline cache", () => {
  it("caches only public read kinds", () => {
    expect(isCacheableKind("fixtures")).toBe(true);
    expect(isCacheableKind("wallet")).toBe(false);
    expect(isCacheableKind("bets")).toBe(false);

    const { store, map } = memory();
    const cache = createOfflineCache(store);

    cache.write("wallet" as never, "k", { balance: 1 });
    expect(map.size).toBe(0);
  });

  it("reads back fresh entries and drops stale ones", () => {
    let now = 1_000;
    const { store } = memory();
    const cache = createOfflineCache(store, () => now);

    cache.write("standings", "L1", [1, 2]);
    expect(cache.read("standings", "L1")?.value).toEqual([1, 2]);
    now += 25 * 60 * 60 * 1000;
    expect(cache.read("standings", "L1")).toBeUndefined();
  });

  it("bounds the number of entries", () => {
    const { store, map } = memory();
    const cache = createOfflineCache(store);

    for (let i = 0; i < 60; i++) cache.write("fixtures", `k${String(i)}`, i);
    expect(map.size).toBeLessThanOrEqual(41);
    expect(cache.read("fixtures", "k0")).toBeUndefined();
    expect(cache.read("fixtures", "k59")?.value).toBe(59);
  });

  it("refuses financial commands without connectivity", () => {
    expect(canRunFinancialCommand("OFFLINE")).toBe(false);
    expect(canRunFinancialCommand("FAILED")).toBe(false);
    expect(canRunFinancialCommand("CONNECTED")).toBe(true);
  });
});
