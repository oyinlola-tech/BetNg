import { describe, expect, it, vi } from "vitest";
import type { MatchId } from "@betng/contracts";
import type { MatchMarketsView } from "@betng/ui-core";
import { createMarketsBatch } from "../../src/lib/marketsBatch";

const id = (value: string): MatchId => value as MatchId;
const markets = (matchId: string): MatchMarketsView => ({ matchId: id(matchId), markets: [], generatedAt: "2026-09-27T10:00:00.000Z" });

describe("markets batch", () => {
  it("answers every row asked for in the same moment from one read", async () => {
    const read = vi.fn(async (ids: readonly MatchId[]) => ids.map((matchId) => markets(matchId)));
    const batch = createMarketsBatch(read, 5);
    const answers = await Promise.all([batch.load(id("a")), batch.load(id("b")), batch.load(id("a"))]);

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith([id("a"), id("b")]);
    expect(answers.map((answer) => answer.matchId)).toEqual(["a", "b", "a"]);
  });

  it("answers a match the platform has no odds for with no markets", async () => {
    const batch = createMarketsBatch(async () => [markets("a")], 5);

    await expect(batch.load(id("missing"))).resolves.toMatchObject({ matchId: "missing", markets: [] });
  });

  it("never names more matches in one read than the platform accepts", async () => {
    const read = vi.fn(async (ids: readonly MatchId[]) => ids.map((matchId) => markets(matchId)));
    const batch = createMarketsBatch(read, 5);

    await Promise.all(Array.from({ length: 130 }, (_, index) => batch.load(id(`m-${String(index)}`))));

    expect(read.mock.calls.map(([ids]) => ids.length)).toEqual([60, 60, 10]);
  });

  it("fails the rows of a read that failed, and reads again the next time", async () => {
    const read = vi.fn<(ids: readonly MatchId[]) => Promise<readonly MatchMarketsView[]>>();

    read.mockRejectedValueOnce(new Error("platform is down"));
    read.mockResolvedValueOnce([markets("a")]);

    const batch = createMarketsBatch(read, 5);

    await expect(batch.load(id("a"))).rejects.toThrow("platform is down");
    await expect(batch.load(id("a"))).resolves.toMatchObject({ matchId: "a" });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
