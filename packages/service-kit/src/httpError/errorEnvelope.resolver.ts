import {
  HttpMiddlewareError,
  HttpMiddlewarePipelineError,
} from "@zudojs/errors";
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

const MAX_UNWRAP_DEPTH = 8;

/**
 * Whether an error is one of the framework's own pipeline wrappers.
 *
 * The middleware pipeline wraps every handler failure in
 * `HttpMiddlewareError`, and then in `HttpMiddlewarePipelineError`. Both
 * report status 500, so taking the outermost status would answer every
 * `notFound()` and every validation failure with a 500. These two are
 * looked through; nothing else is, because an application that throws a 502
 * wrapping an upstream 401 means the 502.
 */
function isPipelineWrapper(error: object): boolean {
  return (
    error instanceof HttpMiddlewareError ||
    error instanceof HttpMiddlewarePipelineError
  );
}

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

function collectNested(error: object): readonly unknown[] {
  const candidate = error as { errors?: unknown; cause?: unknown };
  const nested: unknown[] = [];

  if (Array.isArray(candidate.errors)) {
    nested.push(...candidate.errors);
  }

  if (candidate.cause !== undefined) {
    nested.push(candidate.cause);
  }

  return nested;
}

export function unwrapStatusError(
  error: unknown,
  depth = 0,
  seen: Set<unknown> = new Set(),
): StatusCarrying | undefined {
  if (depth > MAX_UNWRAP_DEPTH || error === null || typeof error !== "object") {
    return undefined;
  }

  if (seen.has(error)) {
    return undefined;
  }

  seen.add(error);

  if (!isPipelineWrapper(error)) {
    return asStatusCarrying(error);
  }

  for (const inner of collectNested(error)) {
    const found = unwrapStatusError(inner, depth + 1, seen);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

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
