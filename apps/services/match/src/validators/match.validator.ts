/**
 * Request validation for the match service.
 *
 * The schemas come from `@betng/contracts`, so what the service accepts and
 * what the contract documents cannot drift apart. This module only names
 * which schema guards which endpoint.
 */

import { listMatchesQuerySchema, listTeamsQuerySchema } from "@betng/contracts";

/** Guards the query string of `GET /api/v1/matches`. */
export const listMatchesQueryValidator = listMatchesQuerySchema;

/** Guards the query string of `GET /api/v1/teams`. */
export const listTeamsQueryValidator = listTeamsQuerySchema;
