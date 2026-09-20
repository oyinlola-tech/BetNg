/**
 * The real platform, through `@betng/client-sdk`.
 *
 * This is where the frontend's view models meet the backend's contracts.
 * The gateway serves matches, fixtures, teams and leagues separately; this
 * adapter joins them. Where the platform does not yet serve something the
 * UI is built for — statistics, standings by season, notifications — the
 * adapter derives what it can from results and answers honestly with an
 * empty value for the rest, so a screen shows its empty state rather than
 * a crash. Each such gap is marked `PLATFORM GAP` for the backend phase.
 */

import type { BetNgRestClient, LiveClient, LiveHandlers } from "@betng/client-sdk";
import type {
  Fixture,
  League,
  LeagueId,
  LiveEvent,
  Match,
  MatchId,
  Team,
  TeamId,
} from "@betng/contracts";
import type {
  BetNgDataSource,
  LiveMatchHandlers,
  MatchFilter,
} from "../dataSource.type.js";
import { DataSourceError } from "../dataSource.type.js";
import { derivePhase } from "../phase.js";
import { computeStandings } from "../standings.js";
import type {
  ConnectionState,
  LeagueView,
  MatchEventView,
  MatchSummary,
  MatchView,
  NotificationPreferences,
  TeamView,
} from "../types/index.js";

export interface PlatformDataSourceOptions {
  readonly rest: BetNgRestClient;
  readonly openLive: (handlers: LiveHandlers) => LiveClient;
  readonly userId: string;
}

/** A deterministic badge colour for a team the platform has no colours for. */
function fallbackColors(seed: string): TeamView["colors"] {
  let hash = 0;

  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;

  const hue = Math.abs(hash) % 360;

  return {
    primary: `hsl(${String(hue)} 45% 38%)`,
    secondary: `hsl(${String((hue + 40) % 360)} 40% 60%)`,
    onPrimary: "#FFFFFF",
  };
}

function toTeamView(team: Team): TeamView {
  return {
    id: team.id,
    leagueId: team.leagueId,
    name: team.name,
    shortName: team.shortName,
    code: team.shortName.slice(0, 3).toUpperCase(),
    // PLATFORM GAP: the match service does not yet carry city or stadium.
    city: "",
    stadium: "",
    colors: fallbackColors(team.id),
    strength: team.strength,
  };
}

function toLiveEventView(event: LiveEvent): MatchEventView {
  const kind: MatchEventView["kind"] =
    event.type === "KICKOFF" || event.type === "MATCH_STARTED"
      ? "KICK_OFF"
      : event.type === "MATCH_FINISHED"
        ? "FULL_TIME"
        : event.type;

  return {
    id: `${event.matchId}-${String(event.sequence)}`,
    matchId: event.matchId,
    sequence: event.sequence,
    kind,
    minute: event.minute,
    ...(event.side === undefined ? {} : { side: event.side }),
    score: event.score,
    description: event.description,
    occurredAt: event.occurredAt,
  };
}

/**
 * Creates the data source that talks to the platform.
 */
export function createPlatformDataSource(options: PlatformDataSourceOptions): BetNgDataSource {
  const { rest, userId } = options;

  /* Reference data is read once and cached for the session: leagues and
     teams change between seasons, not between page views. */
  let leaguesCache: Promise<readonly League[]> | undefined;
  let teamsCache: Promise<readonly Team[]> | undefined;
  let fixturesCache: Promise<readonly Fixture[]> | undefined;

  const leagues = (): Promise<readonly League[]> => (leaguesCache ??= rest.listLeagues());
  const teams = (): Promise<readonly Team[]> => (teamsCache ??= rest.listTeams());
  const fixtures = (): Promise<readonly Fixture[]> => (fixturesCache ??= rest.listFixtures());

  async function compose(match: Match): Promise<MatchView> {
    const [allLeagues, allTeams, allFixtures] = await Promise.all([leagues(), teams(), fixtures()]);
    const fixture = allFixtures.find((f) => f.id === match.fixtureId);

    if (fixture === undefined) {
      throw new DataSourceError("NOT_FOUND", "The match's fixture is unknown.");
    }

    const league = allLeagues.find((l) => l.id === fixture.leagueId);
    const home = allTeams.find((t) => t.id === fixture.homeTeamId);
    const away = allTeams.find((t) => t.id === fixture.awayTeamId);

    if (league === undefined || home === undefined || away === undefined) {
      throw new DataSourceError("NOT_FOUND", "The match's teams are unknown.");
    }

    return {
      id: match.id,
      fixtureId: match.fixtureId,
      leagueId: league.id,
      leagueName: league.name,
      leagueCode: league.code,
      // PLATFORM GAP: fixtures do not yet carry a season number.
      season: 1,
      matchday: fixture.matchday,
      home: toTeamView(home),
      away: toTeamView(away),
      kickoffAt: fixture.kickoffAt,
      bettingClosesAt: fixture.bettingClosesAt,
      status: match.status,
      phase: derivePhase(match.status, fixture.kickoffAt, Date.now()),
      score: match.score ?? { home: 0, away: 0 },
      // PLATFORM GAP: the match service does not yet serve the timeline over REST.
      events: [],
      openMarkets: 0,
    };
  }

  /* ---- Live: one socket, fanned out to subscribers ------------------- */

  const matchHandlers = new Map<string, Set<LiveMatchHandlers>>();
  const connectionListeners = new Set<(state: ConnectionState) => void>();
  let connection: ConnectionState = "CONNECTING";
  let live: LiveClient | undefined;

  function setConnection(state: ConnectionState): void {
    connection = state;
    for (const l of connectionListeners) l(state);
    for (const set of matchHandlers.values()) for (const h of set) h.onConnection(state);
  }

  function ensureLive(): LiveClient {
    if (live !== undefined) return live;

    live = options.openLive({
      onEvent: (event) => {
        const view = toLiveEventView(event);
        const set = matchHandlers.get(event.matchId);

        if (set !== undefined) for (const h of set) h.onEvent(view);
      },
      onOpen: () => {
        setConnection("CONNECTED");
      },
      onClose: (willReconnect) => {
        setConnection(willReconnect ? "RECONNECTING" : "OFFLINE");
      },
      // The SDK reports a gap; the controller re-reads on the next event's
      // sequence jump, so nothing extra is needed here.
      onDesync: () => undefined,
    });
    live.connect();

    return live;
  }

  const notImplemented = <T>(value: T): Promise<T> => Promise.resolve(value);

  return {
    listLeagues: async () => {
      const all = await leagues();

      return all.map(
        (l): LeagueView => ({
          id: l.id,
          name: l.name,
          code: l.code,
          country: l.country,
          teamCount: 0,
          matchdays: 0,
          currentSeason: 1,
          currentMatchday: 1,
          cycleSeconds: 0,
        }),
      );
    },
    getLeague: async (leagueId) => {
      const found = (await leagues()).find((l) => l.id === leagueId);

      if (found === undefined) throw new DataSourceError("NOT_FOUND", "League not found.");

      const count = (await teams()).filter((t) => t.leagueId === leagueId).length;

      return {
        id: found.id,
        name: found.name,
        code: found.code,
        country: found.country,
        teamCount: count,
        matchdays: Math.max(0, (count - 1) * 2),
        currentSeason: 1,
        currentMatchday: 1,
        cycleSeconds: 0,
      };
    },
    listTeams: async (leagueId?: LeagueId) =>
      (await teams())
        .filter((t) => leagueId === undefined || t.leagueId === leagueId)
        .map(toTeamView),
    getTeam: async (teamId: TeamId) => {
      const team = (await teams()).find((t) => t.id === teamId);

      if (team === undefined) throw new DataSourceError("NOT_FOUND", "Team not found.");

      return { ...toTeamView(team), manager: "", founded: 0, squad: [] };
    },
    getStandings: async (leagueId, season = 1) => {
      const [leagueTeams, matches] = await Promise.all([
        rest.listTeams(leagueId),
        rest.listMatches({ leagueId, status: "COMPLETED" }),
      ]);
      const summaries = await Promise.all(matches.map(compose));

      return computeStandings(leagueId, season, leagueTeams.map(toTeamView), summaries);
    },
    // PLATFORM GAP: scorer data needs the timeline over REST.
    getTopScorers: () => notImplemented([]),
    listMatches: async (filter: MatchFilter = {}) => {
      const matches = await rest.listMatches(
        filter.leagueId === undefined ? {} : { leagueId: filter.leagueId },
      );
      const views = await Promise.all(matches.map(compose));
      const phases = filter.phases;

      return views
        .filter((m) => phases === undefined || phases.includes(m.phase))
        .filter((m) => filter.matchday === undefined || m.matchday === filter.matchday)
        .filter((m) => filter.teamId === undefined || m.home.id === filter.teamId || m.away.id === filter.teamId)
        .slice(0, filter.limit ?? Number.POSITIVE_INFINITY)
        .map((m): MatchSummary => {
          const { events: _events, stats: _stats, ...summary } = m;

          return summary;
        });
    },
    getMatch: async (matchId: MatchId) => compose(await rest.getMatch(matchId)),
    getMatchMarkets: async (matchId: MatchId) => {
      const odds = await rest.getMatchOdds(matchId);

      return {
        matchId,
        generatedAt: odds.generatedAt,
        markets: odds.markets.map((m) => ({
          id: m.id,
          matchId: m.matchId,
          kind: m.type,
          name:
            m.type === "MATCH_RESULT"
              ? "Match Result"
              : m.type === "OVER_UNDER"
                ? "Total Goals"
                : "Both Teams To Score",
          status: m.status,
          columns: m.type === "MATCH_RESULT" ? 3 : 2,
          selections: m.selections.map((s) => ({
            id: s.id,
            marketId: s.marketId,
            code: s.code,
            label: s.label,
            shortLabel: s.label,
            odds: s.odds,
            probability: s.probability,
            trend: "STEADY" as const,
          })),
        })),
      };
    },
    listCompletedMatchdays: async (leagueId) => {
      const matches = await rest.listMatches({ leagueId, status: "COMPLETED" });
      const views = await Promise.all(matches.map(compose));

      return [...new Set(views.map((m) => m.matchday))].sort((a, b) => b - a);
    },
    subscribeMatch: (matchId, handlers) => {
      const client = ensureLive();
      const set = matchHandlers.get(matchId) ?? new Set();

      set.add(handlers);
      matchHandlers.set(matchId, set);
      client.subscribe(matchId);
      handlers.onConnection(connection);

      return {
        unsubscribe: () => {
          set.delete(handlers);
          if (set.size === 0) {
            matchHandlers.delete(matchId);
            client.unsubscribe(matchId);
          }
        },
      };
    },
    subscribeConnection: (listener) => {
      connectionListeners.add(listener);
      return () => {
        connectionListeners.delete(listener);
      };
    },
    getConnectionState: () => connection,
    getWallet: async () => {
      const w = await rest.getWallet(userId);

      return {
        id: w.id,
        balance: w.balance,
        reserved: w.reserved,
        available: w.balance - w.reserved,
        currency: "NGN",
        simulated: true,
      };
    },
    listTransactions: async () =>
      (await rest.listTransactions(userId)).map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        ...(t.reference === undefined ? {} : { reference: t.reference }),
        description: t.type.replace("_", " ").toLowerCase(),
        createdAt: t.createdAt,
      })),
    deposit: async (amount) => {
      const { wallet: w } = await rest.deposit(userId, amount);

      return { id: w.id, balance: w.balance, reserved: w.reserved, available: w.balance - w.reserved, currency: "NGN", simulated: true };
    },
    withdraw: async (amount) => {
      const { wallet: w } = await rest.withdraw(userId, amount);

      return { id: w.id, balance: w.balance, reserved: w.reserved, available: w.balance - w.reserved, currency: "NGN", simulated: true };
    },
    placeBet: async (input) => {
      const bet = await rest.placeBet({
        userId: userId as never,
        stake: input.stake,
        currency: "NGN",
        selections: input.selections.map((s) => ({
          matchId: s.matchId,
          marketId: s.marketId,
          selectionId: s.selectionId,
          odds: s.odds,
        })),
      });

      return {
        id: bet.id,
        legs: input.selections.map((s) => ({ ...s, outcome: "PENDING" as const })),
        stake: bet.stake,
        totalOdds: bet.totalOdds,
        potentialPayout: bet.potentialPayout,
        status: bet.status,
        placedAt: bet.placedAt,
        ...(bet.settledAt === undefined ? {} : { settledAt: bet.settledAt }),
      };
    },
    // PLATFORM GAP: a bet's legs need market and selection labels joined
    // server-side before history can render them.
    listBets: () => notImplemented([]),
    getBet: () => Promise.reject(new DataSourceError("NOT_FOUND", "Bet not found.")),
    listNotifications: () => notImplemented([]),
    markNotificationsRead: () => Promise.resolve(),
    getNotificationPreferences: () =>
      notImplemented<NotificationPreferences>({
        matchStarting: true,
        matchFinished: true,
        betSettled: true,
        goals: false,
      }),
    setNotificationPreferences: () => Promise.resolve(),
    listViewedMatches: () => notImplemented([]),
    recordView: () => undefined,
    subscribeAccount: () => () => undefined,
  };
}
