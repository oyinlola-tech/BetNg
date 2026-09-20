/**
 * The match service's data-access contract.
 *
 * Handlers are written against this interface, never against a concrete
 * store. The foundation ships an in-memory implementation; the PostgreSQL
 * one lands with the match schema and satisfies the same interface, so
 * nothing above this file changes when it does.
 */

import type {
  Fixture,
  League,
  Match,
  MatchStatus,
  Team,
} from "@betng/contracts";

export interface MatchFilter {
  readonly leagueId?: string;
  readonly status?: MatchStatus;
}

export interface MatchRepository {
  listLeagues(): Promise<readonly League[]>;
  listTeams(leagueId?: string): Promise<readonly Team[]>;
  listFixtures(): Promise<readonly Fixture[]>;
  listMatches(filter: MatchFilter): Promise<readonly Match[]>;
  findMatch(id: string): Promise<Match | undefined>;
}
