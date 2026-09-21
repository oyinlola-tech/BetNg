import { asId, matchEventTypeSchema } from "@betng/contracts";
import type {
  AdminFixture,
  AdminTeam,
  BettingStatus,
  CompletedMatch,
  Fixture,
  League,
  Match,
  MatchEvent,
  MatchLifecycle,
  SettlementStatus,
  SimulationStatus,
  Team,
} from "@betng/contracts";
import type { AdminMatchDto, TeamDto } from "../dtos/index.js";
import type {
  FixtureRecord,
  LeagueRecord,
  MatchRecord,
  SimulationEventRow,
  TeamRecord,
  TeamRow,
  TransitionRecord,
} from "../interfaces/index.js";

export function toLeague(row: LeagueRecord): League {
  return {
    id: asId<"LeagueId">(row.id),
    name: row.name,
    code: row.code,
    slug: row.slug,
    sport: row.sport,
    status: row.status,
    country: row.country,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toTeam(row: TeamRow): TeamDto {
  return {
    id: asId<"TeamId">(row.id),
    leagueId: asId<"LeagueId">(row.leagueId),
    name: row.name,
    shortName: row.shortName,
    code: row.code,
    strength: row.strength,
    city: row.city,
    stadium: row.stadium,
    colors: { primary: row.colorPrimary, secondary: row.colorSecondary },
    createdAt: row.createdAt.toISOString(),
  } satisfies Team & { code: string };
}

export function toFixture(row: Omit<FixtureRecord, "match">): Fixture {
  return {
    id: asId<"FixtureId">(row.id),
    leagueId: asId<"LeagueId">(row.leagueId),
    season: row.season,
    matchday: row.matchday,
    homeTeamId: asId<"TeamId">(row.homeTeamId),
    awayTeamId: asId<"TeamId">(row.awayTeamId),
    kickoffAt: row.kickoffAt.toISOString(),
    bettingClosesAt: row.bettingClosesAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

type MatchColumns = Pick<
  MatchRecord,
  | "id"
  | "fixtureId"
  | "status"
  | "lifecycle"
  | "homeScore"
  | "awayScore"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
>;

export function toMatch(row: MatchColumns): Match {
  return {
    id: asId<"MatchId">(row.id),
    fixtureId: asId<"FixtureId">(row.fixtureId),
    status: row.status,
    ...(row.homeScore === null || row.awayScore === null
      ? {}
      : { score: { home: row.homeScore, away: row.awayScore } }),
    ...(row.completedAt === null
      ? {}
      : { completedAt: row.completedAt.toISOString() }),
    lifecycle: row.lifecycle,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMatchEvent(row: SimulationEventRow): MatchEvent | undefined {
  const type = matchEventTypeSchema.safeParse(row.type);

  if (!type.success) return undefined;

  return {
    id: asId<"MatchEventId">(row.id),
    matchId: asId<"MatchId">(row.matchId),
    type: type.data,
    minute: Math.min(120, Math.max(0, row.minute)),
    ...(row.side === null ? {} : { side: row.side }),
    ...(row.player === null ? {} : { player: row.player }),
    ...(row.secondaryPlayer === null
      ? {}
      : { secondaryPlayer: row.secondaryPlayer }),
    score: { home: row.scoreHome, away: row.scoreAway },
    description: row.description.slice(0, 240),
  };
}

export function toCompletedMatch(row: MatchRecord): CompletedMatch | undefined {
  if (
    row.status !== "COMPLETED" ||
    row.homeScore === null ||
    row.awayScore === null ||
    row.completedAt === null
  ) {
    return undefined;
  }

  return {
    matchId: asId<"MatchId">(row.id),
    fixtureId: asId<"FixtureId">(row.fixtureId),
    leagueId: asId<"LeagueId">(row.fixture.leagueId),
    season: row.fixture.season,
    matchday: row.fixture.matchday,
    homeTeamId: asId<"TeamId">(row.fixture.homeTeamId),
    awayTeamId: asId<"TeamId">(row.fixture.awayTeamId),
    kickoffAt: row.fixture.kickoffAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
    result: {
      homeGoals: row.homeScore,
      awayGoals: row.awayScore,
      winner:
        row.homeScore > row.awayScore
          ? "HOME"
          : row.homeScore < row.awayScore
            ? "AWAY"
            : "DRAW",
      winningGap: Math.abs(row.homeScore - row.awayScore),
    },
  };
}

export function toAdminTeam(row: TeamRecord): AdminTeam {
  return {
    id: asId<"TeamId">(row.id),
    leagueId: asId<"LeagueId">(row.leagueId),
    leagueName: row.league.name,
    name: row.name,
    shortName: row.shortName,
    code: row.code,
    status: row.status,
    colors: { primary: row.colorPrimary, secondary: row.colorSecondary },
    ratings: {
      attack: row.attack,
      midfield: row.midfield,
      defence: row.defence,
      goalkeeper: row.goalkeeping,
      pace: row.pace,
      finishing: row.finishing,
      form: row.form,
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}

const NOT_OPEN: readonly string[] = [
  "FIXTURE_CREATED",
  "MARKETS_CREATED",
  "ODDS_PUBLISHED",
];
const OPEN: readonly string[] = ["BETTING_OPEN", "BETTING_ACTIVE"];
const BEFORE_CLOSE: readonly string[] = [...NOT_OPEN, ...OPEN];
const BEFORE_FINISH: readonly string[] = [
  ...BEFORE_CLOSE,
  "BETTING_CLOSED",
  "SIMULATION_STARTED",
  "SIMULATION_FAILED",
  "RESULT_GENERATED",
  "EVENTS_PUBLISHED",
];

function bettingStatus(lifecycle: string): BettingStatus {
  if (NOT_OPEN.includes(lifecycle)) return "NOT_OPEN";

  return OPEN.includes(lifecycle) ? "OPEN" : "CLOSED";
}

function simulationStatus(row: MatchColumns): SimulationStatus {
  if (row.lifecycle === "VOIDED")
    return row.homeScore === null ? "QUEUED" : "COMPLETED";
  if (BEFORE_CLOSE.includes(row.lifecycle)) return "QUEUED";
  if (row.lifecycle === "BETTING_CLOSED") return "READY";
  if (row.lifecycle === "SIMULATION_STARTED") return "RUNNING";

  return row.lifecycle === "SIMULATION_FAILED" ? "FAILED" : "COMPLETED";
}

function settlementStatus(lifecycle: string): SettlementStatus {
  if (lifecycle === "VOIDED") return "VOIDED";
  if (BEFORE_FINISH.includes(lifecycle)) return "NOT_DUE";
  if (lifecycle === "SETTLEMENT_COMPLETED") return "COMPLETED";

  return lifecycle === "SETTLEMENT_FAILED" ? "FAILED" : "PENDING";
}

/** Result secrecy: `score` is the revealed running score the public sees, never the committed result. */
export function toAdminFixture(row: MatchRecord): AdminFixture {
  return {
    matchId: asId<"MatchId">(row.id),
    leagueId: asId<"LeagueId">(row.fixture.leagueId),
    leagueName: row.fixture.league.name,
    season: row.fixture.season,
    matchday: row.fixture.matchday,
    homeName: row.fixture.homeTeam.name,
    awayName: row.fixture.awayTeam.name,
    kickoffAt: row.fixture.kickoffAt.toISOString(),
    score: { home: row.homeScore ?? 0, away: row.awayScore ?? 0 },
    matchStatus: row.status,
    bettingStatus: bettingStatus(row.lifecycle),
    simulationStatus: simulationStatus(row),
    settlementStatus: settlementStatus(row.lifecycle),
  };
}

export function toAdminMatch(
  row: MatchRecord,
  transitions: readonly TransitionRecord[],
): AdminMatchDto {
  return {
    ...toAdminFixture(row),
    fixtureId: asId<"FixtureId">(row.fixtureId),
    homeTeamId: asId<"TeamId">(row.fixture.homeTeamId),
    awayTeamId: asId<"TeamId">(row.fixture.awayTeamId),
    lifecycle: row.lifecycle as MatchLifecycle,
    bettingClosesAt: row.fixture.bettingClosesAt.toISOString(),
    failureCount: row.failureCount,
    ...(row.failureReason === null ? {} : { failureReason: row.failureReason }),
    ...(row.nextAttemptAt === null
      ? {}
      : { nextAttemptAt: row.nextAttemptAt.toISOString() }),
    transitions: transitions.map((transition) => ({
      from: transition.fromState,
      to: transition.toState,
      at: transition.at.toISOString(),
      actor: transition.actor,
      ...(transition.reason === null ? {} : { reason: transition.reason }),
    })),
  };
}
