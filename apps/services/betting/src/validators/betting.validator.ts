import { listBetsQuerySchema, placeBetRequestSchema } from "@betng/contracts";
import type { ListBetsQuery, PlaceBetRequest } from "@betng/contracts";
import type { ValidationSchema } from "@zudojs/validation";

export const placeBetValidator: ValidationSchema<PlaceBetRequest> =
  placeBetRequestSchema;

export const listBetsQueryValidator: ValidationSchema<ListBetsQuery> =
  listBetsQuerySchema;
