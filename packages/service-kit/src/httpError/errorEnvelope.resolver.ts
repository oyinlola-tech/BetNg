/**
 * Extraction of the answerable failure from a thrown value.
 */

import type { ErrorDetail } from "@betng/contracts";

/**
 * Anything carrying an HTTP status.
 *
 * `HttpError` from `@zudojs/http` and `DomainError` from `@zudojs/errors`
 * both satisfy this; the structural check also accepts an equivalent error
 * from a duplicated copy of either package.
 */
export interface StatusCarrying {
  readonly statusCode: number;
  readonly code?: unknown;
  readonly message?: unknown;
  readonly expose?: unknown;
  readonly details?: unknown;
}

/** How far a `cause` chain is followed before the search gives up. */
const MAX_UNWRAP_DEPTH = 8;

function asStatusCarrying(error: unknown): StatusCarrying | undefined {
  if (error === null || typeof error !== "object") {
    return undefined;
  }

  const status = (error as { statusCode?: unknown }).statusCode;

  return typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
    ? (error as StatusCarrying)
    : undefined;
}

/**
 * Finds the error whose status answers the request.
 *
 * The middleware pipeline wraps a handler failure before it reaches the
 * error handler, so the original error is reached through `cause`. The
 * depth bound stops a cyclic chain from looping.
 *
 * @param error - The thrown value.
 * @param depth - The current recursion depth.
 * @returns The answerable error, or `undefined` when there is none.
 */
export function unwrapStatusError(
  error: unknown,
  depth = 0,
): StatusCarrying | undefined {
  if (depth > MAX_UNWRAP_DEPTH || error === null || typeof error !== "object") {
    return undefined;
  }

  return (
    asStatusCarrying(error) ??
    unwrapStatusError((error as { cause?: unknown }).cause, depth + 1)
  );
}

/**
 * Narrows a value to the envelope's `details`.
 *
 * @param value - The candidate carried by an error.
 * @returns Whether it is a list of error details.
 */
export function isErrorDetails(
  value: unknown,
): value is readonly ErrorDetail[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as ErrorDetail).path === "string" &&
        typeof (entry as ErrorDetail).message === "string",
    )
  );
}
