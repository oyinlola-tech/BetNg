import { BetNgApiError } from "./restError.js";

export interface ResponseSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

function malformed(): BetNgApiError {
  return new BetNgApiError(200, { code: "INVALID_RESPONSE", message: "The platform sent an answer that did not match its contract.", requestId: "" }, { kind: "parse" });
}

/** Rejects a response that does not match its contract instead of letting a malformed shape reach a screen. */
export function validated<T>(schema: ResponseSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) throw malformed();

  return result.data;
}

export function validatedList<T>(schema: ResponseSchema<T>, value: unknown): readonly T[] {
  const items = (value as { items?: unknown } | undefined)?.items;

  if (!Array.isArray(items)) throw malformed();

  return items.map((item) => validated(schema, item));
}

export interface PageShape<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function validatedPage<T>(schema: ResponseSchema<T>, value: unknown): PageShape<T> {
  const page = value as Partial<PageShape<unknown>> | undefined;

  if (typeof page?.page !== "number" || typeof page.pageSize !== "number" || typeof page.total !== "number") throw malformed();

  return { items: validatedList(schema, value), page: page.page, pageSize: page.pageSize, total: page.total };
}
