/**
 * The real platform, through `@betng/client-sdk`. Endpoints the gateway does
 * not serve yet (events, stats, standings, scorers, notifications) degrade to
 * an empty value so the screen shows its empty state; see docs/frontend-api.md.
 */

import {
  BetNgApiError,
  type BetNgRestClient,
  type LiveClient,
  type LiveHandlers,
} from "@betng/client-sdk";
import type {
  Bet,
  Fixture,
  League,
  LeagueId,
  LiveEvent,
  Match,
  MatchEvent,
  MatchId,
  Notification,
  Team,
  TeamId,
} from "@betng/contracts";
import type {
  BetNgDataSource,
  LiveMatchHandlers,
  MatchFilter,
} from "../dataSource.type.js";
import { DataSourceError } from "../dataSource.type.js";
import { formatScore } from "../format.js";
import { derivePhase, isFinished } from "../phase.js";
import { computeStandings } from "../standings.js";
import type {
  BetLegView,
  BetView,
  ConnectionState,
  LeagueView,
  MarketKind,
  MarketView,
  MatchEventView,
  MatchSummary,
  MatchView,
  NotificationPreferences,
  NotificationView,
  StandingsView,
  TeamView,
  TopScorer,
  TransactionView,
  WalletView,
} from "../types/index.js";

/** Where a client keeps the few things the platform does not. */
export interface KeyValueStorage {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
}

export interface PlatformDataSourceOptions {
  readonly rest: BetNgRestClient;
  readonly openLive: (handlers: LiveHandlers) => LiveClient;
  readonly userId: string;
  /** Persists notification preferences and viewing history locally. */
  readonly storage?: KeyValueStorage;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  matchStarting: true,
  matchFinished: true,
  betSettled: true,
  goals: false,
};

const MARKET_NAMES: Readonly<Record<MarketKind, string>> = {
  MATCH_RESULT: "Match Result",
  DOUBLE_CHANCE: "Double Chance",
  OVER_UNDER: "Total Goals",
  BOTH_TEAMS_TO_SCORE: "Both Teams To Score",
  CORRECT_SCORE: "Correct Score",
  GOAL_SPREAD: "Goal Spread",
};

const MARKET_COLUMNS: Readonly<Record<MarketKind, number>> = {
  MATCH_RESULT: 3,
  DOUBLE_CHANCE: 3,
  OVER_UNDER: 2,
  BOTH_TEAMS_TO_SCORE: 2,
  CORRECT_SCORE: 3,
  GOAL_SPREAD: 2,
};

/** A deterministic badge colour for a team the platform sends none for. */
function fallbackColors(seed: string): TeamView["colors"] {
  let h = 0;

  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;

  const hue = Math.abs(h) % 360;

  return {
    primary: `hsl(${String(hue)} 45% 36%)`,
    secondary: `hsl(${String((hue + 40) % 360)} 40% 62%)`,
    onPrimary: "#FFFFFF",
  };
}

function toTeamView(team: Team): TeamView {
  return {
    id: team.id,
    leagueId: team.leagueId,
    name: team.name,
    shortName: team.shortName,
    code: team.shortName
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, "X"),
    city: team.city ?? "",
    stadium: team.stadium ?? "",
    colors:
      team.colors === undefined
        ? fallbackColors(team.id)
        : {
            primary: team.colors.primary,
            secondary: team.colors.secondary,
            onPrimary: "#FFFFFF",
          },
    strength: team.strength,
  };
}

function liveEventKind(type: LiveEvent["type"]): MatchEventView["kind"] {
  switch (type) {
    case "KICKOFF":
    case "MATCH_STARTED":
      return "KICK_OFF";
    case "MATCH_FINISHED":
      return "FULL_TIME";
    default:
      return type;
  }
}

function toLiveEventView(event: LiveEvent): MatchEventView {
  return {
    id: `${event.matchId}-${String(event.sequence)}`,
    matchId: event.matchId,
    sequence: event.sequence,
    kind: liveEventKind(event.type),
    minute: event.minute,
    ...(event.side === undefined ? {} : { side: event.side }),
    score: event.score,
    description: event.description,
    occurredAt: event.occurredAt,
  };
}

/** Translates the SDK's error into the one screens branch on. */
function translate(cause: unknown): DataSourceError {
  if (cause instanceof DataSourceError) return cause;

  if (cause instanceof BetNgApiError) {
    if (cause.status === 404 || cause.code === "NOT_FOUND") {
      return new DataSourceError("NOT_FOUND", cause.message);
    }
    if (cause.status === 0)
      return new DataSourceError("NETWORK", cause.message);
    if (cause.code === "VALIDATION_FAILED")
      return new DataSourceError("VALIDATION", cause.message);
    if (cause.code === "CONFLICT")
      return new DataSourceError("BETTING_CLOSED", cause.message);
    return new DataSourceError("SERVER", cause.message);
  }

  return new DataSourceError(
    "SERVER",
    cause instanceof Error ? cause.message : "Something went wrong.",
  );
}

/** Whether a failure means "the platform does not serve this yet". */
function notServed(cause: unknown): boolean {
  return (
    cause instanceof BetNgApiError &&
    (cause.status === 404 ||
      cause.status === 501 ||
      cause.code === "NOT_IMPLEMENTED")
  );
}

/** Runs an optional read; answers `fallback` when the endpoint is not served. */
async function optional<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (cause) {
    if (notServed(cause)) return fallback;
    throw translate(cause);
  }
}

async function required<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (cause) {
    throw translate(cause);
  }
}

export function createPlatformDataSource(
  options: PlatformDataSourceOptions,
): BetNgDataSource {
  const { rest, userId, storage } = options;

  /* ---- Reference data, cached for the session ------------------------ */

  let leaguesCache: Promise<readonly League[]> | undefined;
  let teamsCache: Promise<readonly Team[]> | undefined;
  let fixturesCache: Promise<readonly Fixture[]> | undefined;

  const leagues = (): Promise<readonly League[]> =>
    (leaguesCache ??= required(() => rest.listLeagues()));
  const teams = (): Promise<readonly Team[]> =>
    (teamsCache ??= required(() => rest.listTeams()));
  const fixtures = (): Promise<readonly Fixture[]> =>
    (fixturesCache ??= required(() => rest.listFixtures()));

  /** Fixtures are appended every matchday, so the cache is refreshed when a
   *  match refers to one it does not know. */
  async function fixtureFor(match: Match): Promise<Fixture> {
    let found = (await fixtures()).find((f) => f.id === match.fixtureId);

    if (found === undefined) {
      fixturesCache = undefined;
      found = (await fixtures()).find((f) => f.id === match.fixtureId);
    }

    if (found === undefined) {
      throw new DataSourceError("NOT_FOUND", "The match's fixture is unknown.");
    }

    return found;
  }

  async function toSummary(match: Match): Promise<MatchSummary> {
    const [allLeagues, allTeams, fixture] = await Promise.all([
      leagues(),
      teams(),
      fixtureFor(match),
    ]);
    const league = allLeagues.find((l) => l.id === fixture.leagueId);
    const home = allTeams.find((t) => t.id === fixture.homeTeamId);
    const away = allTeams.find((t) => t.id === fixture.awayTeamId);

    if (league === undefined || home === undefined || away === undefined) {
      throw new DataSourceError("NOT_FOUND", "The match's teams are unknown.");
    }

    const phase = derivePhase(match.status, fixture.kickoffAt, Date.now());

    return {
      id: match.id,
      fixtureId: match.fixtureId,
      leagueId: league.id,
      leagueName: league.name,
      leagueCode: league.code,
      season: fixture.season ?? 1,
      matchday: fixture.matchday,
      home: toTeamView(home),
      away: toTeamView(away),
      kickoffAt: fixture.kickoffAt,
      bettingClosesAt: fixture.bettingClosesAt,
      status: match.status,
      phase,
      score: match.score ?? { home: 0, away: 0 },
      openMarkets: phase === "BETTING_OPEN" ? 1 : 0,
    };
  }

  function toEventView(
    event: MatchEvent,
    sequence: number,
    running: { home: number; away: number },
  ): MatchEventView {
    const score = event.score ?? running;

    return {
      id: event.id,
      matchId: event.matchId,
      sequence,
      kind: event.type,
      minute: event.minute,
      ...(event.side === undefined ? {} : { side: event.side }),
      ...(event.player === undefined ? {} : { player: event.player }),
      ...(event.secondaryPlayer === undefined
        ? {}
        : { secondaryPlayer: event.secondaryPlayer }),
      score,
      description: event.description,
      occurredAt: "",
    };
  }

  async function toView(match: Match): Promise<MatchView> {
    const [summary, events, stats] = await Promise.all([
      toSummary(match),
      optional(
        () => rest.listMatchEvents(match.id),
        [] as readonly MatchEvent[],
      ),
      optional(() => rest.getMatchStats(match.id), undefined),
    ]);

    // The REST timeline may omit the running score; it is accumulated here
    // so a timeline row never has to add up goals itself.
    let running = { home: 0, away: 0 };
    const views = events.map((event, index) => {
      if (event.score !== undefined) {
        running = event.score;
      } else if (event.type === "GOAL") {
        running =
          event.side === "AWAY"
            ? { ...running, away: running.away + 1 }
            : { ...running, home: running.home + 1 };
      }

      return toEventView(event, index + 1, running);
    });

    return {
      ...summary,
      score: match.score ?? views.at(-1)?.score ?? summary.score,
      events: views,
      ...(stats === undefined
        ? {}
        : { stats: { home: stats.home, away: stats.away } }),
    };
  }

  const matchHandlers = new Map<string, Set<LiveMatchHandlers>>();
  const connectionListeners = new Set<(state: ConnectionState) => void>();
  let connection: ConnectionState = "CONNECTING";
  let live: LiveClient | undefined;

  function setConnection(state: ConnectionState): void {
    connection = state;
    for (const l of connectionListeners) l(state);
    for (const set of matchHandlers.values())
      for (const h of set) h.onConnection(state);
  }

  function ensureLive(): LiveClient {
    if (live !== undefined) return live;

    live = options.openLive({
      onEvent: (event) => {
        const set = matchHandlers.get(event.matchId);

        if (set === undefined) return;

        const view = toLiveEventView(event);

        for (const h of set) h.onEvent(view);
      },
      onOpen: () => {
        setConnection("CONNECTED");
      },
      onClose: (willReconnect) => {
        setConnection(willReconnect ? "RECONNECTING" : "OFFLINE");
      },
      // A gap surfaces to the controller as a sequence jump on the next
      // event, which triggers its re-read; nothing more is needed here.
      onDesync: () => undefined,
    });
    live.connect();

    return live;
  }

  /* ---- Local state the platform does not hold ------------------------ */

  const accountListeners = new Set<() => void>();
  const notifyAccount = (): void => {
    for (const l of accountListeners) l();
  };

  const PREFS_KEY = `betng.prefs.${userId}`;
  const VIEWED_KEY = `betng.viewed.${userId}`;

  function readJson<T>(key: string, fallback: T): T {
    try {
      const raw = storage?.get(key);

      return raw === null || raw === undefined
        ? fallback
        : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  let preferences = readJson<NotificationPreferences>(
    PREFS_KEY,
    DEFAULT_PREFERENCES,
  );
  let viewed = readJson<string[]>(VIEWED_KEY, []);

  /* ---- Bets ---------------------------------------------------------- */

  async function toBetView(bet: Bet): Promise<BetView> {
    const legs = await Promise.all(
      bet.selections.map(async (leg): Promise<BetLegView> => {
        let matchLabel = "Match";
        let leagueCode = "";
        let kickoffAt = bet.placedAt;
        let result: string | undefined;

        try {
          const summary = await toSummary(await rest.getMatch(leg.matchId));

          matchLabel = `${summary.home.name} v ${summary.away.name}`;
          leagueCode = summary.leagueCode;
          kickoffAt = summary.kickoffAt;
          if (isFinished(summary.phase))
            result = formatScore(summary.score.home, summary.score.away);
        } catch {
          /* A leg on a match the platform no longer serves still renders. */
        }

        const marketKind = (leg.marketType ?? "MATCH_RESULT") as MarketKind;

        return {
          selectionId: leg.selectionId,
          marketId: leg.marketId,
          matchId: leg.matchId,
          marketKind,
          marketName: leg.marketLabel ?? MARKET_NAMES[marketKind] ?? "Market",
          selectionLabel: leg.selectionLabel ?? leg.selectionId.slice(0, 8),
          odds: leg.odds,
          matchLabel,
          leagueCode,
          kickoffAt,
          outcome:
            leg.outcome ?? (bet.status === "PENDING" ? "PENDING" : bet.status),
          ...(result === undefined ? {} : { result }),
        };
      }),
    );

    return {
      id: bet.id,
      legs,
      stake: bet.stake,
      totalOdds: bet.totalOdds,
      potentialPayout: bet.potentialPayout,
      status: bet.status,
      placedAt: bet.placedAt,
      ...(bet.settledAt === undefined ? {} : { settledAt: bet.settledAt }),
      ...(bet.payout === undefined ? {} : { payout: bet.payout }),
    };
  }

  function toWalletView(w: {
    id: string;
    balance: number;
    reserved: number;
  }): WalletView {
    return {
      id: w.id as WalletView["id"],
      balance: w.balance,
      reserved: w.reserved,
      available: w.balance - w.reserved,
      currency: "NGN",
      simulated: true,
    };
  }

  function toNotificationView(n: Notification): NotificationView {
    return {
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      read: n.read,
      ...(n.matchId === undefined ? {} : { matchId: n.matchId }),
      ...(n.betId === undefined ? {} : { betId: n.betId }),
    };
  }

  async function leagueView(league: League): Promise<LeagueView> {
    const count = (await teams()).filter(
      (t) => t.leagueId === league.id,
    ).length;
    const leagueFixtures = (await fixtures()).filter(
      (f) => f.leagueId === league.id,
    );
    const latest = leagueFixtures.reduce<Fixture | undefined>(
      (best, f) =>
        best === undefined || f.kickoffAt > best.kickoffAt ? f : best,
      undefined,
    );

    return {
      id: league.id,
      name: league.name,
      code: league.code,
      slug: league.slug ?? league.code.toLowerCase(),
      sport: league.sport ?? "football",
      status: league.status ?? "ACTIVE",
      country: league.country,
      teamCount: count,
      matchdays: Math.max(0, (count - 1) * 2),
      currentSeason: latest?.season ?? 1,
      currentMatchday: latest?.matchday ?? 1,
      cycleSeconds: 0,
    };
  }

  return {
    listLeagues: async () => Promise.all((await leagues()).map(leagueView)),

    getLeague: async (leagueId) => {
      const found = (await leagues()).find((l) => l.id === leagueId);

      if (found === undefined)
        throw new DataSourceError("NOT_FOUND", "League not found.");

      return leagueView(found);
    },

    listTeams: async (leagueId?: LeagueId) =>
      (await teams())
        .filter((t) => leagueId === undefined || t.leagueId === leagueId)
        .map(toTeamView),

    getTeam: async (teamId: TeamId) => {
      const team = (await teams()).find((t) => t.id === teamId);

      if (team === undefined)
        throw new DataSourceError("NOT_FOUND", "Team not found.");

      return { ...toTeamView(team), manager: "", founded: 0, squad: [] };
    },

    getStandings: async (leagueId, season): Promise<StandingsView> => {
      const allTeams = (await teams())
        .filter((t) => t.leagueId === leagueId)
        .map(toTeamView);
      const served = await optional(
        () => rest.getStandings(leagueId, season),
        undefined,
      );

      if (served !== undefined) {
        const byId = new Map(allTeams.map((t) => [t.id, t]));

        return {
          leagueId,
          season: served.season,
          matchdaysPlayed: served.matchdaysPlayed,
          rows: served.rows.flatMap((row) => {
            const team = byId.get(row.teamId);

            return team === undefined ? [] : [{ ...row, team }];
          }),
        };
      }

      const completed = await required(() =>
        rest.listMatches({ leagueId, status: "COMPLETED" }),
      );
      const summaries = await Promise.all(completed.map(toSummary));
      const inSeason = summaries.filter(
        (m) => season === undefined || m.season === season,
      );

      return computeStandings(
        leagueId,
        season ?? inSeason[0]?.season ?? 1,
        allTeams,
        inSeason,
      );
    },

    getTopScorers: async (leagueId, season): Promise<readonly TopScorer[]> => {
      const served = await optional(
        () => rest.listTopScorers(leagueId, season),
        [],
      );
      const byId = new Map((await teams()).map((t) => [t.id, toTeamView(t)]));

      return served.flatMap((s) => {
        const team = byId.get(s.teamId);

        return team === undefined
          ? []
          : [{ player: s.player, team, goals: s.goals, assists: s.assists }];
      });
    },

    listMatches: async (filter: MatchFilter = {}) => {
      const matches = await required(() =>
        rest.listMatches(
          filter.leagueId === undefined ? {} : { leagueId: filter.leagueId },
        ),
      );
      const views = await Promise.all(matches.map(toSummary));
      const { phases, matchday, season, teamId, date } = filter;

      return views
        .filter((m) => phases === undefined || phases.includes(m.phase))
        .filter((m) => matchday === undefined || m.matchday === matchday)
        .filter((m) => season === undefined || m.season === season)
        .filter(
          (m) =>
            teamId === undefined ||
            m.home.id === teamId ||
            m.away.id === teamId,
        )
        .filter((m) => date === undefined || m.kickoffAt.slice(0, 10) === date)
        .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
        .slice(0, filter.limit ?? Number.POSITIVE_INFINITY);
    },

    getMatch: async (matchId: MatchId) =>
      toView(await required(() => rest.getMatch(matchId))),

    getMatchMarkets: async (matchId: MatchId) => {
      const odds = await required(() => rest.getMatchOdds(matchId));

      return {
        matchId,
        generatedAt: odds.generatedAt,
        markets: odds.markets.map((m): MarketView => ({
          id: m.id,
          matchId: m.matchId,
          kind: m.type,
          name: MARKET_NAMES[m.type],
          ...(m.line === undefined ? {} : { line: m.line }),
          status: m.status,
          columns: MARKET_COLUMNS[m.type],
          selections: m.selections.map((s) => ({
            id: s.id,
            marketId: s.marketId,
            code: s.code,
            label: s.label,
            shortLabel: s.label,
            odds: s.odds,
            probability: s.probability,
            trend: "STEADY",
          })),
        })),
      };
    },

    listCompletedMatchdays: async (leagueId, season) => {
      const matches = await required(() =>
        rest.listMatches({ leagueId, status: "COMPLETED" }),
      );
      const views = await Promise.all(matches.map(toSummary));

      return [
        ...new Set(
          views
            .filter((m) => season === undefined || m.season === season)
            .map((m) => m.matchday),
        ),
      ].sort((a, b) => b - a);
    },

    subscribeMatch: (matchId, handlers) => {
      const client = ensureLive();
      const set = matchHandlers.get(matchId) ?? new Set<LiveMatchHandlers>();

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

    getWallet: async () =>
      toWalletView(await required(() => rest.getWallet(userId))),

    listTransactions: async () =>
      (await required(() => rest.listTransactions(userId))).map(
        (t): TransactionView => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter,
          ...(t.reference === undefined ? {} : { reference: t.reference }),
          description:
            t.type === "DEPOSIT"
              ? "Simulated deposit"
              : t.type === "WITHDRAWAL"
                ? "Simulated withdrawal"
                : t.type === "BET_STAKE"
                  ? "Stake"
                  : t.type === "BET_PAYOUT"
                    ? "Payout"
                    : "Refund",
          createdAt: t.createdAt,
        }),
      ),

    deposit: async (amount) => {
      const { wallet } = await required(() => rest.deposit(userId, amount));

      notifyAccount();

      return toWalletView(wallet);
    },

    withdraw: async (amount) => {
      const { wallet } = await required(() => rest.withdraw(userId, amount));

      notifyAccount();

      return toWalletView(wallet);
    },

    placeBet: async (input) => {
      const bet = await required(() =>
        rest.placeBet({
          userId: userId as Bet["userId"],
          stake: input.stake,
          currency: "NGN",
          selections: input.selections.map((s) => ({
            matchId: s.matchId,
            marketId: s.marketId,
            selectionId: s.selectionId,
            odds: s.odds,
            marketType: s.marketKind,
            marketLabel: s.marketName,
            selectionLabel: s.selectionLabel,
          })),
        }),
      );

      notifyAccount();

      return {
        id: bet.id,
        legs: input.selections.map((s) => ({
          ...s,
          outcome: "PENDING" as const,
        })),
        stake: bet.stake,
        totalOdds: bet.totalOdds,
        potentialPayout: bet.potentialPayout,
        status: bet.status,
        placedAt: bet.placedAt,
      };
    },

    listBets: async () => {
      const bets = await required(() => rest.listBets({ userId }));
      const views = await Promise.all(bets.map(toBetView));

      return views.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
    },

    getBet: async (betId) =>
      toBetView(await required(() => rest.getBet(betId))),

    listNotifications: async () =>
      (
        await optional(
          () => rest.listNotifications(userId),
          [] as readonly Notification[],
        )
      )
        .map(toNotificationView)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    markNotificationsRead: async (ids) => {
      await optional(() => rest.markNotificationsRead(userId, ids), undefined);
      notifyAccount();
    },

    getNotificationPreferences: () => Promise.resolve(preferences),

    setNotificationPreferences: (next) => {
      preferences = next;
      storage?.set(PREFS_KEY, JSON.stringify(next));

      return Promise.resolve();
    },

    listViewedMatches: async () => {
      const results = await Promise.allSettled(
        viewed
          .slice(0, 10)
          .map(async (id) => toSummary(await rest.getMatch(id))),
      );

      return results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
    },

    recordView: (matchId) => {
      viewed = [matchId, ...viewed.filter((id) => id !== matchId)].slice(0, 50);
      storage?.set(VIEWED_KEY, JSON.stringify(viewed));
    },

    subscribeAccount: (listener) => {
      accountListeners.add(listener);

      return () => {
        accountListeners.delete(listener);
      };
    },
  };
}
