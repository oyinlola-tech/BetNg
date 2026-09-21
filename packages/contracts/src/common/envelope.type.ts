import { z } from "@zudojs/validation";

export interface ErrorDetail {
  readonly path: string;
  readonly message: string;
}

export interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details?: readonly ErrorDetail[];
    /** Machine-readable context for a domain error, e.g. `{ maxStake }` on STAKE_LIMITED or `{ current }` on ODDS_CHANGED. */
    readonly data?: Readonly<Record<string, unknown>>;
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
    data: z.record(z.string(), z.unknown()).optional(),
  }),
});

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    pageSize: z.int().min(1),
    total: z.int().min(0),
  });
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const REQUEST_ID_HEADER = "x-request-id";

export const API_PREFIX = "/api/v1";
