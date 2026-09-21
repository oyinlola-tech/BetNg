import type {
  MatchEventType,
  MatchLifecycle,
  MatchSide,
  MatchStatus,
} from "@betng/contracts";
import type { League, Prisma, Team } from "../generated/prisma/client.js";

export const MATCH_INCLUDE = {
  fixture: { include: { league: true, homeTeam: true, awayTeam: true } },
} satisfies Prisma.MatchInclude;

export type MatchRecord = Prisma.MatchGetPayload<{
  include: typeof MATCH_INCLUDE;
}>;

export type FixtureRecord = Prisma.FixtureGetPayload<{
  include: { match: true };
}>;

export type TeamRecord = Prisma.TeamGetPayload<{ include: { league: true } }>;

export type TransitionRecord = Prisma.MatchTransitionGetPayload<object>;

export type { League as LeagueRecord, Team as TeamRow };

export interface FixtureFilter {
  readonly leagueId?: string;
  readonly season?: number;
  readonly matchday?: number;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit: number;
}

export interface MatchFilter extends FixtureFilter {
  readonly status?: MatchStatus;
  readonly newestFirst?: boolean;
}

export interface NewLeague {
  readonly name: string;
  readonly code: string;
  readonly slug: string;
  readonly country: string;
  readonly sport: string;
  readonly status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  readonly staggerSeconds: number;
}

export type NewTeam = Omit<
  Prisma.TeamUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>;

export type TeamPatch = Pick<
  Prisma.TeamUncheckedUpdateInput,
  | "name"
  | "shortName"
  | "status"
  | "strength"
  | "attack"
  | "midfield"
  | "defence"
  | "goalkeeping"
  | "pace"
  | "finishing"
  | "form"
>;

export interface NewFixture {
  readonly leagueId: string;
  readonly season: number;
  readonly matchday: number;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly kickoffAt: Date;
  readonly bettingClosesAt: Date;
}

export interface CatalogueRepository {
  listLeagues(): Promise<readonly League[]>;
  findLeague(id: string): Promise<League | undefined>;
  countLeagues(): Promise<number>;
  createLeague(league: NewLeague): Promise<League>;
  listTeams(leagueId?: string): Promise<readonly TeamRecord[]>;
  findTeam(id: string): Promise<TeamRecord | undefined>;
  createTeam(team: NewTeam): Promise<TeamRecord>;
  updateTeam(
    id: string,
    patch: TeamPatch,
    afterUpdate: (before: TeamRecord, after: TeamRecord) => Promise<void>,
  ): Promise<TeamRecord | undefined>;
}

export interface RoundCursor {
  readonly season: number;
  readonly matchday: number;
  readonly kickoffAt: Date;
}

export interface MatchRepository {
  listFixtures(filter: FixtureFilter): Promise<readonly FixtureRecord[]>;
  listMatches(filter: MatchFilter): Promise<readonly MatchRecord[]>;
  findMatch(id: string): Promise<MatchRecord | undefined>;
  listTransitions(matchId: string): Promise<readonly TransitionRecord[]>;
  listCompleted(filter: {
    readonly leagueId?: string;
    readonly season?: number;
    readonly limit: number;
  }): Promise<readonly MatchRecord[]>;
  currentSeason(leagueId: string, now: Date): Promise<number>;
  /** The scheduler's newest round in a league; rounds an admin added by hand are not part of the rotation. */
  latestScheduledRound(leagueId: string): Promise<RoundCursor | undefined>;
  countUpcomingRounds(leagueId: string, now: Date): Promise<number>;
  createFixtures(
    fixtures: readonly NewFixture[],
    options: {
      readonly source: "SCHEDULER" | "ADMIN";
      readonly actor: string;
      readonly at: Date;
    },
  ): Promise<readonly string[]>;
}

export interface TransitionInput {
  readonly matchId: string;
  readonly from: MatchLifecycle;
  readonly path: readonly MatchLifecycle[];
  readonly actor: string;
  readonly reason?: string;
  readonly at: Date;
  readonly patch?: Prisma.MatchUncheckedUpdateManyInput;
}

export interface LifecycleRepository {
  listDue(query: {
    readonly states: readonly MatchLifecycle[];
    readonly now: Date;
    readonly kickoffBy?: Date;
    readonly bettingClosesBy?: Date;
    readonly bettingClosesAfter?: Date;
    readonly maxFailures?: number;
    readonly ignoreLease?: boolean;
    readonly limit: number;
  }): Promise<readonly MatchRecord[]>;
  /** Conditional on the match still being in `from`; `false` means another worker won and nothing was written. */
  transition(input: TransitionInput): Promise<boolean>;
  claim(
    matchId: string,
    state: MatchLifecycle,
    now: Date,
    until: Date,
  ): Promise<boolean>;
  recordFailure(
    matchId: string,
    state: MatchLifecycle,
    reason: string,
    nextAttemptAt: Date,
  ): Promise<void>;
  resetAttempts(
    matchId: string,
    state: MatchLifecycle,
    now: Date,
  ): Promise<boolean>;
  reveal(
    matchId: string,
    fromSequence: number,
    revealed: {
      readonly sequence: number;
      readonly homeScore: number;
      readonly awayScore: number;
    },
  ): Promise<boolean>;
  voidMatch(
    matchId: string,
    actor: string,
    reason: string,
    at: Date,
  ): Promise<MatchLifecycle | undefined>;
}

export interface SimulationEventRow {
  readonly id: string;
  readonly matchId: string;
  readonly sequence: number;
  readonly minute: number;
  readonly type: MatchEventType;
  readonly side: MatchSide | null;
  readonly player: string | null;
  readonly secondaryPlayer: string | null;
  readonly scoreHome: number;
  readonly scoreAway: number;
  readonly description: string;
}

export interface SimulationResultRow {
  readonly matchId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly stats: unknown;
}

export interface ScorerRow {
  readonly player: string;
  readonly teamId: string;
  readonly goals: number;
  readonly assists: number;
}

/** Read-only access to the simulation service's schema. A missing table reads as "nothing there yet". */
export interface SimulationReader {
  hasResult(matchId: string): Promise<boolean>;
  /** Only for a match at or past full time, or for figures that are scaled before they leave the service. */
  findResult(matchId: string): Promise<SimulationResultRow | undefined>;
  listEvents(
    matchId: string,
    range: {
      readonly after: number;
      readonly upTo?: number;
      readonly limit: number;
    },
  ): Promise<readonly SimulationEventRow[]>;
  countEventsAfter(matchId: string, sequence: number): Promise<number>;
  listScorers(
    leagueId: string,
    season: number,
    limit: number,
  ): Promise<readonly ScorerRow[]>;
  matchesWithResult(matchIds: readonly string[]): Promise<readonly string[]>;
}

export interface BettingReader {
  matchesWithBets(matchIds: readonly string[]): Promise<readonly string[]>;
}

export type Clock = () => Date;
