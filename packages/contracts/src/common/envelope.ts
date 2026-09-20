/**
 * The REST envelope every BetNG service speaks.
 *
 * Successful responses carry the resource as the body. Failures always carry
 * the {@link ErrorResponse} shape, so a client can branch on the presence of
 * an `error` key alone. Both TypeScript and Python services implement these
 * shapes; see `docs/api.md` for the language-independent description.
 */

import { z } from "@zudojs/validation";

/** The error body returned by every BetNG service for any 4xx or 5xx. */
export interface ErrorResponse {
  readonly error: {
    /** A stable, machine-readable code such as `VALIDATION_FAILED`. */
    readonly code: string;
    /** A human-readable explanation. Safe to show to a developer. */
    readonly message: string;
    /** The correlation id of the request that failed. */
    readonly requestId: string;
    /**
     * Field-level detail, present only for validation failures. Each entry
     * names the offending path within the request body.
     */
    readonly details?: readonly ErrorDetail[];
  };
}

/** One field-level problem within a rejected request. */
export interface ErrorDetail {
  /** Dotted path to the offending field, e.g. `selections.0.odds`. */
  readonly path: string;
  readonly message: string;
}

export const errorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.array(errorDetailSchema).optional(),
  }),
});

/** A page of results. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** Builds a page schema around an item schema. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    pageSize: z.int().min(1),
    total: z.int().min(0),
  });
}

/** Query parameters accepted by every list endpoint. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** The header carrying the correlation id between services. */
export const REQUEST_ID_HEADER = "x-request-id";

/** The API version prefix every public route sits behind. */
export const API_PREFIX = "/api/v1";
