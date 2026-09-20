/**
 * In-memory implementation of {@link MatchRepository}.
 *
 * This is deliberately not a database. It exists so the request path is
 * exercisable end to end before the match schema lands, and it is replaced
 * by a PostgreSQL implementation of the same interface. See
 * `docs/architecture.md` for the data-ownership rules and
 * `docs/development.md` for the migration workflow.
 */

import type { Fixture, League, Match, Team } from "@betng/contracts";
import type { MatchFilter, MatchRepository } from "../interfaces/index.js";
import {
  createDemoFixtures,
  createDemoLeagues,
  createDemoMatches,
  createDemoTeams,
} from "../models/index.js";

/**
 * Creates the in-memory match repository, pre-loaded with the
 * demonstration league.
 *
 * `now` is injected so tests are deterministic rather than dependent on the
 * wall clock.
 */
export function createInMemoryMatchRepository(
  now: () => Date = () => new Date(),
): MatchRepository {
  const createdAt = now().toISOString();

  const leagues: readonly League[] = createDemoLeagues(createdAt);
  const teams: readonly Team[] = createDemoTeams(createdAt);
  const fixtures: readonly Fixture[] = createDemoFixtures(now(), createdAt);
  const matches: readonly Match[] = createDemoMatches(createdAt);

  function matchesFilter(entry: Match, filter: MatchFilter): boolean {
    if (filter.status !== undefined && entry.status !== filter.status) {
      return false;
    }

    if (filter.leagueId === undefined) {
      return true;
    }

    const fixture = fixtures.find((candidate) => candidate.id === entry.fixtureId);

    return fixture?.leagueId === filter.leagueId;
  }

  return {
    listLeagues: async () => leagues,

    listTeams: async (leagueId) =>
      leagueId === undefined
        ? teams
        : teams.filter((team) => team.leagueId === leagueId),

    listFixtures: async () => fixtures,

    listMatches: async (filter) =>
      matches.filter((entry) => matchesFilter(entry, filter)),

    findMatch: async (id) => matches.find((entry) => entry.id === id),
  };
}
