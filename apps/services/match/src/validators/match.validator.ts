/**
 * Request validation for the match service.
 *
 * Every query string, path id and body is checked against a schema before a handler sees it. This module names
 * which schema guards which endpoint and annotates each one, so the service's declaration files do not depend on
 * Zod's internal types. Bodies are strict: an unknown field is a rejected request, not an ignored one.
 */

import {
  listMatchesQuerySchema,
  listTeamsQuerySchema,
  matchAdminActionRequestSchema,
  updateTeamRequestSchema,
} from "@betng/contracts";
import type { ListMatchesQuery, ListTeamsQuery, MatchAdminActionRequest, UpdateTeamRequest } from "@betng/contracts";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
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

export const listMatchesQueryValidator: ValidationSchema<ListMatchesQuery> = listMatchesQuerySchema;

export const listTeamsQueryValidator: ValidationSchema<ListTeamsQuery> = listTeamsQuerySchema;

export const listFixturesQueryValidator: ValidationSchema<ListFixturesQuery> = listFixturesQuerySchema;

export const listResultsQueryValidator: ValidationSchema<ListResultsQuery> = listResultsQuerySchema;

export const seasonQueryValidator: ValidationSchema<SeasonQuery> = seasonQuerySchema;

export const adminFixturesQueryValidator: ValidationSchema<AdminFixturesQuery> = adminFixturesQuerySchema;

export const createLeagueValidator: ValidationSchema<CreateLeagueRequest> = createLeagueRequestSchema;

export const createTeamValidator: ValidationSchema<CreateTeamRequest> = createTeamRequestSchema;

export const createFixtureValidator: ValidationSchema<CreateFixtureRequest> = createFixtureRequestSchema;

export const updateTeamValidator: ValidationSchema<UpdateTeamRequest> = updateTeamRequestSchema
  .extend({ ratings: updateTeamRequestSchema.shape.ratings.unwrap().strict().optional() })
  .strict();

export const matchActionValidator: ValidationSchema<MatchAdminActionRequest> = matchAdminActionRequestSchema.strict();

/** A path id that is not a UUID cannot name a row, so it is answered like any other unknown id. */
export function isUuid(value: string): boolean {
  return validate(uuidParamSchema, value).success;
}
