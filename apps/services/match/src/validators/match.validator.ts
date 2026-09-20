/**
 * Request validation for the match service.
 *
 * The schemas come from `@betng/contracts`, so what the service accepts and
 * what the contract documents cannot drift apart. This module only names
 * which schema guards which endpoint, and annotates each one so the
 * service's declaration files do not depend on Zod's internal types.
 */

import { listMatchesQuerySchema, listTeamsQuerySchema } from "@betng/contracts";
import type { ListMatchesQuery, ListTeamsQuery } from "@betng/contracts";
import type { ValidationSchema } from "@zudojs/validation";

/** Guards the query string of `GET /api/v1/matches`. */
export const listMatchesQueryValidator: ValidationSchema<ListMatchesQuery> =
  listMatchesQuerySchema;

/** Guards the query string of `GET /api/v1/teams`. */
export const listTeamsQueryValidator: ValidationSchema<ListTeamsQuery> =
  listTeamsQuerySchema;
