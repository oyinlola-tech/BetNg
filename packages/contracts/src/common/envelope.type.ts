/**
 * The REST envelope every BetNG service speaks.
 *
 * A successful response carries the resource as its body. A failure always
 * carries {@link ErrorResponse}, so a client can branch on the presence of an
 * `error` key alone. The TypeScript and Python services implement the same
 * shapes; `docs/api.md` describes them without reference to a language.
 */

import { z } from "@zudojs/validation";

/** One field-level problem within a rejected request. */
export interface ErrorDetail {
  /** Dotted path to the offending field, such as `selections.0.odds`. */
  readonly path: string;
  readonly message: string;
}

/** The error body returned by every BetNG service for any 4xx or 5xx. */
export interface ErrorResponse {
  readonly error: {
    /** A stable, machine-readable code such as `VALIDATION_FAILED`. */
    readonly code: string;
    /** A human-readable explanation, safe to show to a developer. */
    readonly message: string;
    /** The correlation identifier of the request that failed. */
    readonly requestId: string;
    /** Field-level detail, present only for a validation failure. */
    readonly details?: readonly ErrorDetail[];
  };
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

/**
 * Builds a page schema around an item schema.
 *
 * @param item - The schema describing one entry of the page.
 * @returns A schema for a page of those entries.
 */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    pageSize: z.int().min(1),
    total: z.int().min(0),
  });
}

/** The query parameters every list endpoint accepts. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** The header that carries the correlation identifier between services. */
export const REQUEST_ID_HEADER = "x-request-id";

/** The API version prefix every public route sits behind. */
export const API_PREFIX = "/api/v1";
