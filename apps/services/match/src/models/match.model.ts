/**
 * The fixed demonstration league the foundation serves.
 *
 * These are seed rows, not schema. They exist so the API, the gateway route
 * and the tests exercise a real request path before the match schema lands,
 * and so a developer can call the documented endpoints without first
 * discovering an identifier. They move into a database seed once
 * `infrastructure/migrations/match` carries the tables.
 */

import { asId } from "@betng/contracts";
import type { Fixture, League, Match, Team } from "@betng/contracts";

export const DEMO_IDS = Object.freeze({
  leagueId: "11111111-1111-4111-8111-111111111111",
  homeTeamId: "22222222-2222-4222-8222-222222222221",
  awayTeamId: "22222222-2222-4222-8222-222222222222",
  fixtureId: "33333333-3333-4333-8333-333333333333",
  matchId: "44444444-4444-4444-8444-444444444444",
});

const BETTING_WINDOW_MS = 60 * 60 * 1000;

const KICKOFF_LEAD_MS = 2 * 60 * 60 * 1000;

export function createDemoLeagues(createdAt: string): readonly League[] {
  return Object.freeze([
    {
      id: asId<"LeagueId">(DEMO_IDS.leagueId),
      name: "BetNG Virtual Premier League",
      code: "BVPL",
      country: "Nigeria",
      createdAt,
    },
  ]);
}

export function createDemoTeams(createdAt: string): readonly Team[] {
  const leagueId = asId<"LeagueId">(DEMO_IDS.leagueId);

  return Object.freeze([
    {
      id: asId<"TeamId">(DEMO_IDS.homeTeamId),
      leagueId,
      name: "Lagos Lions",
      shortName: "LAG",
      strength: 72,
      createdAt,
    },
    {
      id: asId<"TeamId">(DEMO_IDS.awayTeamId),
      leagueId,
      name: "Abuja Eagles",
      shortName: "ABJ",
      strength: 68,
      createdAt,
    },
  ]);
}

/**
 * Builds the demonstration fixture.
 *
 * Betting closes an hour before kick-off. That gap is what gives the risk
 * service a window to act while the result does not yet exist.
 */
export function createDemoFixtures(
  now: Date,
  createdAt: string,
): readonly Fixture[] {
  const kickoff = new Date(now.getTime() + KICKOFF_LEAD_MS);
  const bettingCloses = new Date(kickoff.getTime() - BETTING_WINDOW_MS);

  return Object.freeze([
    {
      id: asId<"FixtureId">(DEMO_IDS.fixtureId),
      leagueId: asId<"LeagueId">(DEMO_IDS.leagueId),
      matchday: 1,
      homeTeamId: asId<"TeamId">(DEMO_IDS.homeTeamId),
      awayTeamId: asId<"TeamId">(DEMO_IDS.awayTeamId),
      kickoffAt: kickoff.toISOString(),
      bettingClosesAt: bettingCloses.toISOString(),
      createdAt,
    },
  ]);
}

export function createDemoMatches(createdAt: string): readonly Match[] {
  return Object.freeze([
    {
      id: asId<"MatchId">(DEMO_IDS.matchId),
      fixtureId: asId<"FixtureId">(DEMO_IDS.fixtureId),
      status: "BETTING_OPEN",
      createdAt,
      updatedAt: createdAt,
    },
  ]);
}
