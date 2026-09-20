/**
 * Match data access.
 *
 * {@link MatchRepository} is the boundary the rest of the service is written
 * against. The foundation ships {@link InMemoryMatchRepository}, which holds
 * a small fixed league so the API, the gateway route and the tests all
 * exercise a real request path end to end.
 *
 * It is not a database. The PostgreSQL implementation lands with the match
 * schema in the next phase and will satisfy this same interface; nothing
 * above this file changes when it does. See `docs/architecture.md` for the
 * data-ownership rules and `docs/development.md` for the migration workflow.
 */

import type { match as matchContracts } from "@betng/contracts";

type League = matchContracts.League;
type Team = matchContracts.Team;
type Fixture = matchContracts.Fixture;
type Match = matchContracts.Match;
type MatchStatus = matchContracts.MatchStatus;

export interface MatchQuery {
  readonly leagueId?: string;
  readonly status?: MatchStatus;
}

export interface MatchRepository {
  listLeagues(): Promise<readonly League[]>;
  listTeams(leagueId?: string): Promise<readonly Team[]>;
  listFixtures(): Promise<readonly Fixture[]>;
  listMatches(query: MatchQuery): Promise<readonly Match[]>;
  findMatch(id: string): Promise<Match | undefined>;
  findFixture(id: string): Promise<Fixture | undefined>;
}

/** Fixed ids, so a developer can hit the demo routes without a lookup. */
const LEAGUE_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_HOME_ID = "22222222-2222-4222-8222-222222222221";
const TEAM_AWAY_ID = "22222222-2222-4222-8222-222222222222";
const FIXTURE_ID = "33333333-3333-4333-8333-333333333333";
const MATCH_ID = "44444444-4444-4444-8444-444444444444";

export function createInMemoryMatchRepository(
  now: () => Date = () => new Date(),
): MatchRepository {
  const createdAt = now().toISOString();

  const leagues = [
    {
      id: LEAGUE_ID,
      name: "BetNG Virtual Premier League",
      code: "BVPL",
      country: "Nigeria",
      createdAt,
    },
  ] as unknown as League[];

  const teams = [
    {
      id: TEAM_HOME_ID,
      leagueId: LEAGUE_ID,
      name: "Lagos Lions",
      shortName: "LAG",
      strength: 72,
      createdAt,
    },
    {
      id: TEAM_AWAY_ID,
      leagueId: LEAGUE_ID,
      name: "Abuja Eagles",
      shortName: "ABJ",
      strength: 68,
      createdAt,
    },
  ] as unknown as Team[];

  // Betting closes one hour before kick-off. The gap is what gives the risk
  // service a window to act while the result does not yet exist.
  const kickoff = new Date(now().getTime() + 2 * 60 * 60 * 1000);
  const bettingCloses = new Date(kickoff.getTime() - 60 * 60 * 1000);

  const fixtures = [
    {
      id: FIXTURE_ID,
      leagueId: LEAGUE_ID,
      matchday: 1,
      homeTeamId: TEAM_HOME_ID,
      awayTeamId: TEAM_AWAY_ID,
      kickoffAt: kickoff.toISOString(),
      bettingClosesAt: bettingCloses.toISOString(),
      createdAt,
    },
  ] as unknown as Fixture[];

  const matches = [
    {
      id: MATCH_ID,
      fixtureId: FIXTURE_ID,
      status: "BETTING_OPEN",
      createdAt,
      updatedAt: createdAt,
    },
  ] as unknown as Match[];

  return {
    listLeagues: () => Promise.resolve(leagues),
    listTeams: (leagueId) =>
      Promise.resolve(
        leagueId === undefined
          ? teams
          : teams.filter((team) => team.leagueId === leagueId),
      ),
    listFixtures: () => Promise.resolve(fixtures),
    listMatches: (query) =>
      Promise.resolve(
        matches.filter((entry) => {
          if (query.status !== undefined && entry.status !== query.status) {
            return false;
          }
          if (query.leagueId !== undefined) {
            const fixture = fixtures.find((f) => f.id === entry.fixtureId);
            if (fixture?.leagueId !== query.leagueId) return false;
          }
          return true;
        }),
      ),
    findMatch: (id) => Promise.resolve(matches.find((entry) => entry.id === id)),
    findFixture: (id) =>
      Promise.resolve(fixtures.find((entry) => entry.id === id)),
  };
}

export const DEMO_IDS = Object.freeze({
  leagueId: LEAGUE_ID,
  homeTeamId: TEAM_HOME_ID,
  awayTeamId: TEAM_AWAY_ID,
  fixtureId: FIXTURE_ID,
  matchId: MATCH_ID,
});
