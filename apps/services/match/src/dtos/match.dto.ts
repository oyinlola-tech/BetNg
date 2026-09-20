/**
 * The response shapes the match endpoints return.
 *
 * A list endpoint answers with `{ items }` rather than a bare array, so a
 * later addition of pagination metadata is not a breaking change for every
 * client at once.
 */

import type { Fixture, League, Match, Team } from "@betng/contracts";

export interface LeagueListDto {
  readonly items: readonly League[];
}

export interface TeamListDto {
  readonly items: readonly Team[];
}

export interface FixtureListDto {
  readonly items: readonly Fixture[];
}

export interface MatchListDto {
  readonly items: readonly Match[];
}
