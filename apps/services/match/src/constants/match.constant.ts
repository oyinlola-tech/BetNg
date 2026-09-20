/**
 * The match service's CQRS type discriminators.
 *
 * A query and its handler must agree on one string. Naming them here means
 * the bus registration and the handler cannot drift apart without a
 * compile error.
 */

export const MATCH_QUERY = Object.freeze({
  LIST_LEAGUES: "match.listLeagues",
  LIST_TEAMS: "match.listTeams",
  LIST_FIXTURES: "match.listFixtures",
  LIST_MATCHES: "match.listMatches",
  GET_MATCH: "match.getMatch",
});

export type MatchQueryType = (typeof MATCH_QUERY)[keyof typeof MATCH_QUERY];
