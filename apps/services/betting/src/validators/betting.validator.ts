/**
 * Request validation for the betting service.
 *
 * The schemas come from `@betng/contracts`, so what the service accepts and
 * what the contract documents cannot drift apart.
 */

import { listBetsQuerySchema, placeBetRequestSchema } from "@betng/contracts";
import type { ListBetsQuery, PlaceBetRequest } from "@betng/contracts";
import type { ValidationSchema } from "@zudojs/validation";

/** Guards the body of `POST /api/v1/bets`. */
export const placeBetValidator: ValidationSchema<PlaceBetRequest> =
  placeBetRequestSchema;

/** Guards the query string of `GET /api/v1/bets`. */
export const listBetsQueryValidator: ValidationSchema<ListBetsQuery> =
  listBetsQuerySchema;
