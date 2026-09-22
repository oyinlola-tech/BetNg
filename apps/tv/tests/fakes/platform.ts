import type { LeagueId, MatchId, TeamId } from "@betng/contracts";
import type {
  BetNgDataSource,
  LeagueView,
  LiveMatchHandlers,
  MarketView,
  MatchEventKind,
  MatchEventView,
  MatchFilter,
  MatchMarketsView,
  MatchView,
  Score,
  StandingRow,
  StandingsView,
  TeamView,
} from "@betng/ui-core";

export function team(id: string, code: string, leagueId = "league-1"): TeamView {
  return {
    id: id as TeamId,
    leagueId: leagueId as LeagueId,
    name: `${code} Town`,
    shortName: code,
    code,
    city: "City",
    stadium: "Ground",
    colors: { primary: "#123456", secondary: "#abcdef", onPrimary: "#ffffff" },
    strength: 50,
  };
}

let sequence = 0;

export function event(kind: MatchEventKind, minute: number, score: Score, overrides: Partial<MatchEventView> = {}): MatchEventView {
  sequence += 1;

  return {
    id: `e${String(sequence)}`,
    matchId: "m" as MatchId,
    sequence,
    kind,
    minute,
    side: "HOME",
    score,
    description: kind.toLowerCase(),
    occurredAt: "",
    ...overrides,
  };
}

export function match(id: string, overrides: Partial<MatchView> = {}): MatchView {
  const events = (overrides.events ?? []).map((e, i) => ({ ...e, matchId: id as MatchId, sequence: e.sequence === 0 ? i + 1 : e.sequence }));

  return {
    id: id as MatchId,
    fixtureId: `f-${id}` as MatchView["fixtureId"],
    leagueId: "league-1" as LeagueId,
    leagueName: "Test League",
    leagueCode: "TL",
    season: 1,
    matchday: 3,
    home: team(`${id}-h`, "HOM"),
    away: team(`${id}-a`, "AWY"),
    kickoffAt: "2026-09-22T12:00:00.000Z",
    bettingClosesAt: "2026-09-22T11:59:00.000Z",
    status: "IN_PLAY",
    phase: "LIVE",
    score: { home: 0, away: 0 },
    openMarkets: 0,
    ...overrides,
    events,
  };
}

export function league(id: string, name: string): LeagueView {
  return { id: id as LeagueId, name, code: name.slice(0, 3).toUpperCase(), slug: name.toLowerCase(), sport: "football", status: "ACTIVE", country: "NG", teamCount: 4, matchdays: 6, currentSeason: 1, currentMatchday: 1, cycleSeconds: 0 };
}

export function resultMarket(matchId: string, odds: readonly [number, number, number], generatedAt = "2026-09-22T10:00:00.000Z"): MatchMarketsView {
  const marketId = `mk-${matchId}` as MarketView["id"];
  const codes = ["HOME", "DRAW", "AWAY"] as const;

  return {
    matchId: matchId as MatchId,
    generatedAt,
    markets: [
      {
        id: marketId,
        matchId: matchId as MatchId,
        kind: "MATCH_RESULT",
        name: "Match result",
        status: "OPEN",
        columns: 3,
        selections: codes.map((code, i) => ({
          id: `${matchId}-${code}` as MarketView["selections"][number]["id"],
          marketId,
          code,
          label: code,
          shortLabel: code,
          odds: odds[i] as number,
          probability: 0,
          trend: "STEADY" as const,
        })),
      },
    ],
  };
}

export function standings(leagueId: string, teams: readonly TeamView[]): StandingsView {
  return {
    leagueId: leagueId as LeagueId,
    season: 1,
    matchdaysPlayed: 2,
    rows: teams.map((t, i): StandingRow => ({ position: i + 1, team: t, played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 3, form: ["W", "L"] })),
  };
}

export interface FakePlatform {
  matches: MatchView[];
  leagues: LeagueView[];
  teams: TeamView[];
  markets: Map<string, MatchMarketsView>;
  handlers: Map<string, LiveMatchHandlers>;
  calls: string[];
}

export function createFakePlatform(): { readonly state: FakePlatform; readonly source: BetNgDataSource } {
  const state: FakePlatform = { matches: [], leagues: [], teams: [], markets: new Map(), handlers: new Map(), calls: [] };
  const summary = ({ events: _e, stats: _s, ...rest }: MatchView): Omit<MatchView, "events" | "stats"> => rest;

  const source = {
    listLeagues: async () => {
      state.calls.push("listLeagues");

      return state.leagues;
    },
    listTeams: async () => state.teams,
    listMatches: async (filter: MatchFilter = {}) => {
      state.calls.push(`listMatches:${JSON.stringify(filter)}`);

      return state.matches.filter((m) => filter.phases === undefined || filter.phases.includes(m.phase)).slice(0, filter.limit ?? Infinity).map(summary);
    },
    getMatch: async (id: MatchId) => {
      state.calls.push(`getMatch:${id}`);
      const found = state.matches.find((m) => m.id === id);

      if (found === undefined) throw new Error("not found");

      return found;
    },
    getMatchMarkets: async (id: MatchId) => {
      const found = state.markets.get(id);

      if (found === undefined) throw new Error("no markets");

      return found;
    },
    getStandings: async () => {
      throw new Error("not served");
    },
    getTopScorers: async () => [],
    getHeadToHead: async (id: MatchId) => ({ matchId: id, played: 0, homeWins: 0, draws: 0, awayWins: 0, meetings: [] }),
    subscribeMatch: (id: MatchId, handlers: LiveMatchHandlers) => {
      state.calls.push(`subscribe:${id}`);
      state.handlers.set(id, handlers);
      handlers.onConnection("CONNECTED");

      return {
        unsubscribe: () => {
          state.handlers.delete(id);
        },
      };
    },
    subscribeConnection: () => () => undefined,
    getConnectionState: () => "CONNECTED" as const,
    recordView: () => undefined,
  };

  return { state, source: source as unknown as BetNgDataSource };
}

export function stubLayout(): () => void {
  const original = HTMLElement.prototype.getBoundingClientRect;
  const scroll = HTMLElement.prototype.scrollIntoView;

  HTMLElement.prototype.getBoundingClientRect = function rect(): DOMRect {
    return new DOMRect(10, 10, 120, 40);
  };
  HTMLElement.prototype.scrollIntoView = function noop(): void {
    return undefined;
  };

  return () => {
    HTMLElement.prototype.getBoundingClientRect = original;
    HTMLElement.prototype.scrollIntoView = scroll;
  };
}

export function reduceMotion(on: boolean): () => void {
  const original = window.matchMedia;

  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: on && query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;

  return () => {
    window.matchMedia = original;
  };
}
