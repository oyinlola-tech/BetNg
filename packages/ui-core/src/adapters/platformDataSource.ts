import {
  BetNgApiError,
  accountChannel,
  type BetNgRestClient,
  type ConnectionStatus,
  type MatchWindowQuery,
  type RealtimeClient,
  type RealtimeEvent,
} from "@betng/client-sdk";
import { matchChannel } from "@betng/contracts/runtime";
import type {
  Bet,
  Fixture,
  League,
  LeagueId,
  LiveEvent,
  Match,
  MatchClock,
  MatchEvent,
  MatchId,
  Notification,
  Team,
  TeamId,
  Transaction,
} from "@betng/contracts";
import type {
  BetNgDataSource,
  LiveMatchHandlers,
  MatchFilter,
  MatchSignal,
} from "../dataSource.type.js";
import { DataSourceError } from "../dataSource.type.js";
import { translateApiError } from "./errors.js";
import { formatScore } from "../format.js";
import { localDayRange } from "../datetime.js";
import { currentCurrency } from "../money.js";
import { isFinished, resolvePhase } from "../phase.js";
import { computeStandings } from "../standings.js";
import type {
  BetLegView,
  BetPlacementView,
  BetRejectionReason,
  BetView,
  ClockPeriod,
  ConnectionState,
  HeadToHeadView,
  MarketGroupKey,
  MatchClockView,
  MatchLineupsView,
  MatchPhase,
  PlatformConfigView,
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

export interface KeyValueStorage {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
}

export interface PlatformDataSourceOptions {
  readonly rest: BetNgRestClient;
  readonly realtime: RealtimeClient;
  /** True once the realtime endpoint authenticates connections and serves `user:{id}`. Until then account data is re-read on a timer. */
  readonly accountChannel?: boolean;
  readonly accountRefreshMs?: number;
  /** A fixed demo user, or a getter reading the signed-in customer; `undefined` means signed out. */
  readonly userId: string | (() => string | undefined);
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

const MAX_WINDOW = 500;

/** The platform status a phase is read under. Several phases share one; the phase filter is applied again after the read. */
const STATUS_FOR_PHASE: Readonly<Partial<Record<MatchPhase, string>>> = {
  SCHEDULED: "SCHEDULED",
  BETTING_OPEN: "BETTING_OPEN",
  BETTING_CLOSED: "BETTING_CLOSED",
  LIVE: "IN_PLAY",
  HALFTIME: "IN_PLAY",
  FINISHED: "COMPLETED",
  SETTLED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

const MARKET_GROUPS: Readonly<Record<MarketKind, MarketGroupKey>> = {
  MATCH_RESULT: "MAIN",
  DOUBLE_CHANCE: "MAIN",
  OVER_UNDER: "GOALS",
  BOTH_TEAMS_TO_SCORE: "GOALS",
  CORRECT_SCORE: "SCORE",
  GOAL_SPREAD: "HANDICAP",
};

const MARKET_COLUMNS: Readonly<Record<MarketKind, number>> = {
  MATCH_RESULT: 3,
  DOUBLE_CHANCE: 3,
  OVER_UNDER: 2,
  BOTH_TEAMS_TO_SCORE: 2,
  CORRECT_SCORE: 3,
  GOAL_SPREAD: 2,
};

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

const TIMELINE_KINDS: Readonly<Partial<Record<LiveEvent["type"], MatchEventView["kind"]>>> = {
  KICKOFF: "KICK_OFF",
  GOAL: "GOAL",
  YELLOW_CARD: "YELLOW_CARD",
  RED_CARD: "RED_CARD",
  CORNER: "CORNER",
  SUBSTITUTION: "SUBSTITUTION",
  HALF_TIME: "HALF_TIME",
  SECOND_HALF: "SECOND_HALF",
  MATCH_FINISHED: "FULL_TIME",
};

const SIGNALS: Readonly<Partial<Record<string, MatchSignal>>> = {
  MATCH_STARTED: "MATCH_UPDATED",
  MATCH_UPDATED: "MATCH_UPDATED",
  BETTING_OPENED: "BETTING_OPENED",
  BETTING_CLOSED: "BETTING_CLOSED",
  ODDS_UPDATED: "ODDS_UPDATED",
  MARKET_UPDATED: "MARKET_UPDATED",
  SIMULATION_STARTED: "SIMULATION_STARTED",
  SETTLEMENT_STARTED: "SETTLEMENT_STARTED",
  SETTLEMENT_COMPLETED: "SETTLEMENT_COMPLETED",
};

function toLiveEventView(event: LiveEvent): MatchEventView | undefined {
  const kind = TIMELINE_KINDS[event.type];
  const wire = event as LiveEvent & { readonly clock?: MatchClock | undefined };

  if (kind === undefined) return undefined;

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
    ...(wire.clock === undefined ? {} : { clock: wire.clock }),
  };
}

type MatchWire = Match & {
  readonly clock?: MatchClock | undefined;
  readonly statusReason?: string | undefined;
};

/** The clock from the platform's own events, for a match payload that does not carry one. */
function clockFromEvents(
  events: readonly MatchEventView[],
  asOf: string,
): MatchClockView | undefined {
  const last = events.at(-1);

  if (last === undefined) return undefined;

  let period: ClockPeriod = "FIRST_HALF";

  for (const event of events) {
    if (event.kind === "HALF_TIME") period = "HALF_TIME";
    else if (event.kind === "SECOND_HALF") period = "SECOND_HALF";
    else if (event.kind === "FULL_TIME") period = "FULL_TIME";
  }

  return {
    period,
    minute: last.minute,
    asOf: last.occurredAt === "" ? asOf : last.occurredAt,
  };
}

const REFUSALS: Readonly<Partial<Record<string, BetRejectionReason>>> = {
  MARKET_CLOSED: "MARKET_CLOSED",
  ODDS_CHANGED: "ODDS_CHANGED",
  STAKE_LIMITED: "STAKE_LIMITED",
  RISK_REJECTED: "RISK_REJECTED",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  INVALID_BET: "INVALID_BET",
};

/** A business refusal of a bet, as a placement result. Anything else stays an error. */
function toRefusal(
  cause: unknown,
  clientReference: string,
): BetPlacementView | undefined {
  if (!(cause instanceof BetNgApiError)) return undefined;

  const reason = REFUSALS[cause.code];

  if (reason === undefined) return undefined;

  const maxStake = cause.data["maxStake"];
  const rejected = cause.data["selectionIds"];

  return {
    outcome: "REJECTED",
    clientReference,
    reason,
    message: cause.message,
    ...(typeof maxStake === "number" ? { maxStake } : {}),
    ...(Array.isArray(rejected)
      ? { rejectedSelectionIds: rejected as BetPlacementView["rejectedSelectionIds"] & {} }
      : {}),
  };
}

function translate(cause: unknown): DataSourceError {
  if (cause instanceof BetNgApiError && cause.code === "CONFLICT") return new DataSourceError("BETTING_CLOSED", cause.message);

  return translateApiError(cause);
}

function notServed(cause: unknown): boolean {
  return (
    cause instanceof BetNgApiError &&
    (cause.status === 404 ||
      cause.status === 501 ||
      cause.code === "NOT_IMPLEMENTED")
  );
}

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
  const { rest, storage } = options;

  const uid = (): string => {
    const id = typeof options.userId === "function" ? options.userId() : options.userId;

    if (id === undefined) throw new DataSourceError("UNAUTHENTICATED", "Sign in to continue.");

    return id;
  };

  let leaguesCache: Promise<readonly League[]> | undefined;
  let teamsCache: Promise<readonly Team[]> | undefined;
  let minuteLengthMs: number | undefined;

  /** A clock without its own pace takes the platform's configured one. */
  const paced = (clock: MatchClock): MatchClockView =>
    clock.minuteLengthMs !== undefined || minuteLengthMs === undefined
      ? clock
      : { ...clock, minuteLengthMs };

  const fixtureIndex = new Map<string, Fixture>();
  let fixtureLoad: Promise<void> | undefined;
  let fixtureMissAt = 0;

  const leagues = (): Promise<readonly League[]> =>
    (leaguesCache ??= required(() => rest.listLeagues()));
  const teams = (): Promise<readonly Team[]> =>
    (teamsCache ??= required(() => rest.listTeams()));

  /** The platform windows its lists, so fixtures are indexed as they are seen rather than read once. */
  async function loadFixtures(query: MatchWindowQuery): Promise<void> {
    for (const f of await required(() => rest.listFixtures(query))) {
      fixtureIndex.set(f.id, f);
    }
  }

  const fixtures = async (): Promise<readonly Fixture[]> => {
    await (fixtureLoad ??= loadFixtures({ limit: MAX_WINDOW }));

    return [...fixtureIndex.values()];
  };

  async function fixtureFor(match: Match): Promise<Fixture> {
    if (!fixtureIndex.has(match.fixtureId)) await fixtures();

    if (!fixtureIndex.has(match.fixtureId) && Date.now() - fixtureMissAt > 5_000) {
      fixtureMissAt = Date.now();
      fixtureLoad = loadFixtures({ limit: MAX_WINDOW });
      await fixtureLoad;
    }

    const found = fixtureIndex.get(match.fixtureId);

    if (found === undefined) {
      throw new DataSourceError("NOT_FOUND", "The match's fixture is unknown.");
    }

    return found;
  }

  async function toSummary(match: MatchWire): Promise<MatchSummary> {
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

    const phase = resolvePhase(match.status, {
      lifecycle: match.lifecycle,
      period: match.clock?.period,
    });

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
      ...(match.clock === undefined ? {} : { clock: paced(match.clock) }),
      ...(match.lifecycle === undefined ? {} : { lifecycle: match.lifecycle }),
      ...(match.statusReason === undefined
        ? {}
        : { statusReason: match.statusReason }),
      score: match.score ?? { home: 0, away: 0 },
      openMarkets: phase === "BETTING_OPEN" ? 1 : 0,
      updatedAt: match.updatedAt,
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

  async function toView(match: MatchWire): Promise<MatchView> {
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

    const clock =
      summary.clock ??
      (match.status === "IN_PLAY"
        ? clockFromEvents(views, match.updatedAt)
        : undefined);

    return {
      ...summary,
      ...(clock === undefined
        ? {}
        : {
            clock,
            phase: resolvePhase(match.status, {
              lifecycle: match.lifecycle,
              period: clock.period,
            }),
          }),
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
  let started = false;

  const CONNECTION: Readonly<Record<ConnectionStatus, ConnectionState>> = {
    CONNECTING: "CONNECTING",
    CONNECTED: "CONNECTED",
    RECONNECTING: "RECONNECTING",
    DISCONNECTED: "OFFLINE",
    FAILED: "FAILED",
  };

  function setConnection(state: ConnectionState): void {
    connection = state;
    for (const l of connectionListeners) l(state);
    for (const set of matchHandlers.values())
      for (const h of set) h.onConnection(state);
  }

  function ensureLive(): RealtimeClient {
    if (started) return options.realtime;

    started = true;
    options.realtime.onStatus((status) => {
      setConnection(CONNECTION[status]);
    });
    options.realtime.onDesync((channel) => {
      for (const [matchId, set] of matchHandlers) {
        if (matchChannel(matchId) !== channel) continue;
        for (const h of set) h.onSignal?.("MATCH_UPDATED");
      }
    });
    options.realtime.connect();

    return options.realtime;
  }

  function deliver(matchId: string, event: RealtimeEvent): void {
    const set = matchHandlers.get(matchId);

    if (set === undefined) return;

    const view = toLiveEventView(event.payload as LiveEvent);
    const signal = SIGNALS[event.type];

    for (const h of set) {
      if (view !== undefined) h.onEvent(view);
      else if (signal !== undefined) h.onSignal?.(signal);
    }
  }

  const accountListeners = new Set<() => void>();
  const notifyAccount = (): void => {
    for (const l of accountListeners) l();
  };

  const PREFS_KEY = "betng.prefs";
  const VIEWED_KEY = "betng.viewed";

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
      currency: currentCurrency().code,
      simulated: true,
    };
  }

  const TRANSACTION_LABELS: Readonly<Record<Transaction["type"], string>> = {
    DEPOSIT: "Deposit",
    WITHDRAWAL: "Withdrawal",
    BET_STAKE: "Bet stake",
    BET_PAYOUT: "Payout",
    BET_REFUND: "Refund",
  };

  /** A type the contract does not list yet still reads as words rather than an empty cell. */
  const transactionLabel = (type: string): string =>
    TRANSACTION_LABELS[type as Transaction["type"]] ??
    type.charAt(0) + type.slice(1).toLowerCase().replaceAll("_", " ");

  function toTransactionView(t: Transaction): TransactionView {
    const wire = t as Transaction & {
      readonly status?: TransactionView["status"];
      readonly description?: string;
      readonly betId?: string;
    };

    return {
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      ...(t.reference === undefined ? {} : { reference: t.reference }),
      description: wire.description ?? transactionLabel(t.type),
      createdAt: t.createdAt,
      currency: t.currency,
      ...(wire.status === undefined ? {} : { status: wire.status }),
      ...(wire.betId === undefined ? {} : { betId: wire.betId }),
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
      const { phases, matchday, season, teamId, date } = filter;
      const window: MatchWindowQuery = {
        ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
        ...(season === undefined ? {} : { season }),
        ...(matchday === undefined ? {} : { matchday }),
        ...(date === undefined ? {} : localDayRange(date)),
        limit: MAX_WINDOW,
      };
      const statuses =
        phases === undefined
          ? [undefined]
          : [
              ...new Set(
                phases.flatMap((phase) => STATUS_FOR_PHASE[phase] ?? []),
              ),
            ];

      const [pages] = await Promise.all([
        Promise.all(
          statuses.map((status) =>
            required(() =>
              rest.listMatches(status === undefined ? window : { ...window, status }),
            ),
          ),
        ),
        loadFixtures(window),
      ]);
      const latestFirst = phases?.every(isFinished) === true;
      const unique = new Map(pages.flat().map((m) => [m.id, m]));
      const settled = await Promise.allSettled(
        [...unique.values()].map(toSummary),
      );
      // A row whose fixture lies outside the fixture window is left out rather than failing the list.
      const views = settled.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );

      return views
        .filter((m) => phases === undefined || phases.includes(m.phase))
        .filter(
          (m) =>
            teamId === undefined ||
            m.home.id === teamId ||
            m.away.id === teamId,
        )
        .sort((a, b) =>
          latestFirst
            ? b.kickoffAt.localeCompare(a.kickoffAt)
            : a.kickoffAt.localeCompare(b.kickoffAt),
        )
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
          group: MARKET_GROUPS[m.type],
          updatedAt: m.updatedAt,
          ...(m.oddsVersion === undefined
            ? {}
            : { oddsVersion: m.oddsVersion }),
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

    getMatchLineups: async (matchId): Promise<MatchLineupsView> =>
      optional(() => rest.getMatchLineups(matchId), {
        matchId,
        confirmed: false,
      }) as Promise<MatchLineupsView>,

    getHeadToHead: async (matchId): Promise<HeadToHeadView> => {
      const empty = { matchId, played: 0, homeWins: 0, draws: 0, awayWins: 0, meetings: [] };
      const wire = await optional(() => rest.getHeadToHead(matchId), empty);
      const [allLeagues, allTeams] = await Promise.all([leagues(), teams()]);
      const meetings = wire.meetings.flatMap((m) => {
        const home = allTeams.find((t) => t.id === m.homeTeamId);
        const away = allTeams.find((t) => t.id === m.awayTeamId);

        if (home === undefined || away === undefined) return [];

        return [
          {
            matchId: m.matchId,
            kickoffAt: m.kickoffAt,
            leagueCode: allLeagues.find((l) => l.id === m.leagueId)?.code ?? "",
            home: toTeamView(home),
            away: toTeamView(away),
            score: m.score,
          },
        ];
      });

      return { ...wire, matchId, meetings };
    },

    search: async (query) => {
      const term = query.term.trim();

      if (term.length < 2) return { term, hits: [] };

      const wire = await required(() =>
        rest.search({
          q: term,
          ...(query.kinds === undefined ? {} : { kinds: query.kinds }),
          ...(query.limit === undefined ? {} : { limit: query.limit }),
        }),
      ).catch((cause: unknown) => {
        if (cause instanceof DataSourceError && cause.code === "NOT_FOUND") {
          throw new DataSourceError(
            "NOT_IMPLEMENTED",
            "Search is not available yet.",
            cause.detail,
          );
        }

        throw cause;
      });

      return {
        term: wire.term,
        hits: wire.hits.map((hit) => ({
          kind: hit.kind,
          id: hit.id,
          title: hit.title,
          ...(hit.subtitle === undefined ? {} : { subtitle: hit.subtitle }),
          ...(hit.matchId === undefined ? {} : { matchId: hit.matchId }),
          ...(hit.leagueId === undefined ? {} : { leagueId: hit.leagueId }),
          ...(hit.teamId === undefined ? {} : { teamId: hit.teamId }),
        })),
      };
    },

    getPlatformConfig: async (): Promise<PlatformConfigView> => {
      const wire = await optional(() => rest.getPublicConfig(), undefined);

      if (wire === undefined) return { currency: currentCurrency(), features: {} };

      const seconds = (wire as { timing?: { secondsPerMinute?: unknown } }).timing?.secondsPerMinute;

      if (typeof seconds === "number" && seconds > 0) minuteLengthMs = seconds * 1000;

      return {
        currency: wire.currency,
        features: wire.features,
        ...(wire.stakeLimits === undefined ? {} : { stakeLimits: wire.stakeLimits }),
        ...(wire.competitionTimezone === undefined
          ? {}
          : { competitionTimezone: wire.competitionTimezone }),
        ...(wire.maintenance === undefined ? {} : { maintenance: wire.maintenance }),
      };
    },

    subscribeMatch: (matchId, handlers) => {
      const client = ensureLive();
      const set = matchHandlers.get(matchId) ?? new Set<LiveMatchHandlers>();

      set.add(handlers);
      matchHandlers.set(matchId, set);

      const release = client.subscribe(matchChannel(matchId), (event) => {
        deliver(matchId, event);
      });

      handlers.onConnection(connection);

      return {
        unsubscribe: () => {
          set.delete(handlers);
          if (set.size === 0) matchHandlers.delete(matchId);
          release();
        },
      };
    },

    subscribeConnection: (listener) => {
      // A screen that shows connection status must see the real one, not a connection that was never opened.
      ensureLive();
      connectionListeners.add(listener);

      return () => {
        connectionListeners.delete(listener);
      };
    },

    getConnectionState: () => connection,

    getWallet: async () =>
      toWalletView(await required(() => rest.getWallet(uid()))),

    listTransactions: async () =>
      (await required(() => rest.listTransactions(uid()))).map(
        toTransactionView,
      ),

    queryTransactions: async (query) => {
      const page = await required(() =>
        rest.queryTransactions(uid(), {
          ...query,
          ...(query.types === undefined ? {} : { types: query.types }),
        }),
      );

      // A service that does not page yet answers `{ items }`; the page is cut here so the screen still works.
      if (typeof page.total !== "number") {
        const all = page.items.map(toTransactionView);
        const size = query.pageSize ?? 20;
        const index = query.page ?? 1;

        return {
          items: all.slice((index - 1) * size, index * size),
          page: index,
          pageSize: size,
          total: all.length,
        };
      }

      return { ...page, items: page.items.map(toTransactionView) };
    },

    deposit: async (amount) => {
      const { wallet } = await required(() => rest.deposit(uid(), amount));

      notifyAccount();

      return toWalletView(wallet);
    },

    withdraw: async (amount) => {
      const { wallet } = await required(() => rest.withdraw(uid(), amount));

      notifyAccount();

      return toWalletView(wallet);
    },

    placeBet: async (input): Promise<BetPlacementView> => {
      let bet: Bet;

      try {
        bet = await rest.placeBet(
          {
            userId: uid() as Bet["userId"],
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
              ...(s.oddsVersion === undefined
                ? {}
                : { oddsVersion: s.oddsVersion }),
            })),
          },
          { idempotencyKey: input.clientReference },
        );
      } catch (cause) {
        const refusal = toRefusal(cause, input.clientReference);

        if (refusal !== undefined) return refusal;

        throw translate(cause);
      }

      notifyAccount();

      const limited = bet.stake < input.stake;

      return {
        outcome: limited ? "LIMITED" : "ACCEPTED",
        clientReference: input.clientReference,
        ...(limited ? { reason: "STAKE_LIMITED" as const } : {}),
        bet: {
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
          currency: bet.currency,
        },
      };
    },

    listBets: async () => {
      const bets = await required(() => rest.listBets({ userId: uid() }));
      const views = await Promise.all(bets.map(toBetView));

      return views.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
    },

    getBet: async (betId) =>
      toBetView(await required(() => rest.getBet(betId))),

    listNotifications: async () =>
      (
        await optional(
          () => rest.listNotifications(uid()),
          [] as readonly Notification[],
        )
      )
        .map(toNotificationView)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    markNotificationsRead: async (ids) => {
      await optional(() => rest.markNotificationsRead(uid(), ids), undefined);
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

      const id =
        typeof options.userId === "function"
          ? options.userId()
          : options.userId;
      let release: (() => void) | undefined;

      if (id !== undefined && options.accountChannel === true) {
        release = ensureLive().subscribe(accountChannel(id), notifyAccount);
      } else if (id !== undefined) {
        const timer = setInterval(listener, options.accountRefreshMs ?? 20_000);

        release = () => {
          clearInterval(timer);
        };
      }

      return () => {
        accountListeners.delete(listener);
        release?.();
      };
    },
  };
}
