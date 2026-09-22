import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveMatchController, LiveMatchSnapshot } from "@betng/ui-core";

vi.mock("../../src/services/dataSource", () => ({ dataSource: {} }));

const { createReads } = await import("../../src/lib/reads");
const { createLiveRegistry } = await import("../../src/lib/liveRegistry");
const { offsetsOf, scrollToKeep, windowRange } = await import("../../src/lib/virtual");
const { createFakePlatform, league } = await import("../fakes/platform");

afterEach(() => {
  vi.useRealTimers();
});

describe("TV read layer", () => {
  it("sends one request for identical reads in flight", async () => {
    const { state, source } = createFakePlatform();
    const reads = createReads(() => source);

    await Promise.all([reads.listMatches({ phases: ["LIVE"] }), reads.listMatches({ phases: ["LIVE"] }), reads.listMatches({ phases: ["LIVE"] })]);
    expect(state.calls.filter((c) => c.startsWith("listMatches"))).toHaveLength(1);

    await reads.listMatches({ phases: ["LIVE"] });
    expect(state.calls.filter((c) => c.startsWith("listMatches"))).toHaveLength(2);
  });

  it("keeps leagues for the TTL and asks again after it", async () => {
    const { state, source } = createFakePlatform();
    let now = 0;
    const reads = createReads(() => source, { now: () => now, ttlMs: 1000 });

    state.leagues = [league("l1", "Alpha")];
    await reads.listLeagues();
    now = 999;
    await reads.listLeagues();
    expect(state.calls.filter((c) => c === "listLeagues")).toHaveLength(1);
    now = 1000;
    await reads.listLeagues();
    expect(state.calls.filter((c) => c === "listLeagues")).toHaveLength(2);
  });

  it("does not cache a failure", async () => {
    let fail = true;
    const source = { listLeagues: vi.fn(async () => (fail ? Promise.reject(new Error("down")) : [])) };
    const reads = createReads(() => source as never);

    await expect(reads.listLeagues()).rejects.toThrow("down");
    fail = false;
    await expect(reads.listLeagues()).resolves.toEqual([]);
    expect(source.listLeagues).toHaveBeenCalledTimes(2);
  });
});

describe("TV live registry", () => {
  it("shares one watcher per match and stops it after the last release", () => {
    vi.useFakeTimers();

    const stop = vi.fn();
    const watch = vi.fn(
      (): LiveMatchController => ({ getSnapshot: () => ({}) as LiveMatchSnapshot, subscribe: () => () => undefined, stop, resync: () => undefined }),
    );
    const registry = createLiveRegistry(() => ({}) as never, { watch: watch, lingerMs: 1000 });
    const a = registry.acquire("m1");
    const b = registry.acquire("m1");

    expect(watch).toHaveBeenCalledTimes(1);
    expect(a.controller).toBe(b.controller);

    a.release();
    b.release();
    vi.advanceTimersByTime(500);
    const c = registry.acquire("m1");

    vi.advanceTimersByTime(2000);
    expect(stop).not.toHaveBeenCalled();
    expect(watch).toHaveBeenCalledTimes(1);

    c.release();
    vi.advanceTimersByTime(1000);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(registry.size()).toBe(0);
  });
});

describe("TV virtual list", () => {
  it("renders only the rows that intersect the viewport", () => {
    const heights = Array.from({ length: 1000 }, () => 40);
    const w = windowRange(heights, 4000, 400, 2);

    expect(w.start).toBe(98);
    expect(w.end).toBe(112);
    expect(w.total).toBe(40_000);
  });

  it("keeps an anchored row in view", () => {
    const heights = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40];
    const { offsets, total } = offsetsOf(heights);

    expect(scrollToKeep(offsets, heights, 0, 120, total)).toBe(0);
    expect(scrollToKeep(offsets, heights, 9, 120, total)).toBe(280);
  });
});
