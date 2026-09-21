import {
  listMatchesQuerySchema,
  listTeamsQuerySchema,
  matchAdminActionRequestSchema,
  searchQuerySchema,
  updateTeamRequestSchema,
} from "@betng/contracts";
import type {
  ListMatchesQuery,
  ListTeamsQuery,
  MatchAdminActionRequest,
  UpdateTeamRequest,
} from "@betng/contracts";
import { validate } from "@zudojs/validation";
import type { ValidationSchema, z } from "@zudojs/validation";
import {
  adminFixturesQuerySchema,
  createFixtureRequestSchema,
  createLeagueRequestSchema,
  createTeamRequestSchema,
  listFixturesQuerySchema,
  listResultsQuerySchema,
  seasonQuerySchema,
  uuidParamSchema,
} from "../dtos/index.js";
import type {
  AdminFixturesQuery,
  CreateFixtureRequest,
  CreateLeagueRequest,
  CreateTeamRequest,
  ListFixturesQuery,
  ListResultsQuery,
  SeasonQuery,
} from "../dtos/index.js";

export const listMatchesQueryValidator: ValidationSchema<ListMatchesQuery> =
  listMatchesQuerySchema;

export const listTeamsQueryValidator: ValidationSchema<ListTeamsQuery> =
  listTeamsQuerySchema;

export const listFixturesQueryValidator: ValidationSchema<ListFixturesQuery> =
  listFixturesQuerySchema;

export const listResultsQueryValidator: ValidationSchema<ListResultsQuery> =
  listResultsQuerySchema;

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchQueryValidator: ValidationSchema<SearchQuery> =
  searchQuerySchema;

export const seasonQueryValidator: ValidationSchema<SeasonQuery> =
  seasonQuerySchema;

export const adminFixturesQueryValidator: ValidationSchema<AdminFixturesQuery> =
  adminFixturesQuerySchema;

export const createLeagueValidator: ValidationSchema<CreateLeagueRequest> =
  createLeagueRequestSchema;

export const createTeamValidator: ValidationSchema<CreateTeamRequest> =
  createTeamRequestSchema;

export const createFixtureValidator: ValidationSchema<CreateFixtureRequest> =
  createFixtureRequestSchema;

export const updateTeamValidator: ValidationSchema<UpdateTeamRequest> =
  updateTeamRequestSchema
    .extend({
      ratings: updateTeamRequestSchema.shape.ratings
        .unwrap()
        .strict()
        .optional(),
    })
    .strict();

export const matchActionValidator: ValidationSchema<MatchAdminActionRequest> =
  matchAdminActionRequestSchema.strict();

/** A path id that is not a UUID cannot name a row, so it is answered like any other unknown id. */
export function isUuid(value: string): boolean {
  return validate(uuidParamSchema, value).success;
}
