import type { BetNgDataSource, MatchFilter } from "@betng/ui-core";
import { isConnectivityError, type CacheableKind, type OfflineCache } from "./offlineCache";

const FINISHED = new Set(["FINISHED", "SETTLED"]);

function matchKind(filter: MatchFilter | undefined): CacheableKind {
  const phases = filter?.phases ?? [];

  return phases.length > 0 && phases.every((phase) => FINISHED.has(phase)) ? "results" : "fixtures";
}

function filterKey(filter: MatchFilter | undefined): string {
  if (filter === undefined) return "all";

  return [filter.leagueId, filter.phases?.join("+"), filter.season, filter.matchday, filter.date, filter.teamId, filter.limit]
    .map((part) => (part === undefined ? "" : String(part)))
    .join(",");
}

/**
 * Public reads (fixtures, results, standings, leagues) fall back to the last
 * copy the platform served when the network is unreachable. Everything else,
 * including every financial read and command, passes straight through.
 */
export function withOfflineCache(source: BetNgDataSource, cache: OfflineCache): BetNgDataSource {
  const cached = async <T>(kind: CacheableKind, key: string, read: () => Promise<T>): Promise<T> => {
    try {
      const value = await read();

      cache.write(kind, key, value);

      return value;
    } catch (error) {
      const fallback = isConnectivityError(error) ? cache.read<T>(kind, key) : undefined;

      if (fallback === undefined) throw error;

      return fallback.value;
    }
  };

  return Object.assign(Object.create(source) as BetNgDataSource, {
    listLeagues: () => cached("fixtures", "leagues", () => source.listLeagues()),
    listMatches: (filter?: MatchFilter) => cached(matchKind(filter), `matches:${filterKey(filter)}`, () => source.listMatches(filter)),
    getStandings: (leagueId: Parameters<BetNgDataSource["getStandings"]>[0], season?: number) =>
      cached("standings", `${leagueId}:${String(season ?? "")}`, () => source.getStandings(leagueId, season)),
    listCompletedMatchdays: (leagueId: Parameters<BetNgDataSource["listCompletedMatchdays"]>[0], season?: number) =>
      cached("results", `matchdays:${leagueId}:${String(season ?? "")}`, () => source.listCompletedMatchdays(leagueId, season)),
  });
}
