/**
 * The match service's CQRS type discriminators.
 *
 * A query and its handler must agree on one string. Naming them here means
 * the bus registration and the handler cannot drift apart without a
 * compile error.
 */

export const MATCH_QUERY = Object.freeze({
  LIST_LEAGUES: "match.list-leagues",
  LIST_TEAMS: "match.list-teams",
  LIST_FIXTURES: "match.list-fixtures",
  LIST_MATCHES: "match.list-matches",
  GET_MATCH: "match.get-match",
});

export type MatchQueryType = (typeof MATCH_QUERY)[keyof typeof MATCH_QUERY];
