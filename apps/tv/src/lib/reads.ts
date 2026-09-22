import type { LeagueId, MatchId } from "@betng/contracts";
import type { BetNgDataSource, HeadToHeadView, LeagueView, MatchFilter, MatchMarketsView, MatchSummary, MatchView, StandingsView, TeamView, TopScorer } from "@betng/ui-core";
import { dataSource } from "../services/dataSource";

export const STATIC_TTL_MS = 5 * 60_000;

export interface Reads {
  readonly listLeagues: () => Promise<readonly LeagueView[]>;
  readonly listTeams: (leagueId?: LeagueId) => Promise<readonly TeamView[]>;
  readonly listMatches: (filter?: MatchFilter) => Promise<readonly MatchSummary[]>;
  readonly getMatch: (matchId: MatchId) => Promise<MatchView>;
  readonly getMatchMarkets: (matchId: MatchId) => Promise<MatchMarketsView>;
  readonly getStandings: (leagueId: LeagueId) => Promise<StandingsView>;
  readonly getTopScorers: (leagueId: LeagueId) => Promise<readonly TopScorer[]>;
  readonly getHeadToHead: (matchId: MatchId) => Promise<HeadToHeadView>;
  readonly clear: () => void;
}

/* One request per identical read in flight; leagues, teams and head-to-head are kept for a while, everything else is always asked again. */
export function createReads(source: () => BetNgDataSource, options: { readonly now?: () => number; readonly ttlMs?: number } = {}): Reads {
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? STATIC_TTL_MS;
  const inflight = new Map<string, Promise<unknown>>();
  const cache = new Map<string, { readonly at: number; readonly value: unknown }>();

  function read<T>(key: string, run: () => Promise<T>, cached = false): Promise<T> {
    if (cached) {
      const hit = cache.get(key);

      if (hit !== undefined && now() - hit.at < ttl) return Promise.resolve(hit.value as T);
    }

    const pending = inflight.get(key);

    if (pending !== undefined) return pending as Promise<T>;

    const promise = run().then(
      (value) => {
        inflight.delete(key);
        if (cached) cache.set(key, { at: now(), value });

        return value;
      },
      (cause: unknown) => {
        inflight.delete(key);
        throw cause;
      },
    );

    inflight.set(key, promise);

    return promise;
  }

  return {
    listLeagues: () => read("leagues", () => source().listLeagues(), true),
    listTeams: (leagueId) => read(`teams:${leagueId ?? ""}`, () => source().listTeams(leagueId), true),
    listMatches: (filter = {}) => read(`matches:${JSON.stringify(filter)}`, () => source().listMatches(filter)),
    getMatch: (matchId) => read(`match:${matchId}`, () => source().getMatch(matchId)),
    getMatchMarkets: (matchId) => read(`markets:${matchId}`, () => source().getMatchMarkets(matchId)),
    getStandings: (leagueId) => read(`standings:${leagueId}`, () => source().getStandings(leagueId)),
    getTopScorers: (leagueId) => read(`scorers:${leagueId}`, () => source().getTopScorers(leagueId)),
    getHeadToHead: (matchId) => read(`h2h:${matchId}`, () => source().getHeadToHead(matchId), true),
    clear: () => {
      inflight.clear();
      cache.clear();
    },
  };
}

export const reads = createReads(() => dataSource);
