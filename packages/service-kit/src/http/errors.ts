/**
 * The BetNG error envelope.
 *
 * BetNG does not introduce an error hierarchy of its own. Handlers throw the
 * `HttpError` values `@zudojs/http` already provides — `notFound()`,
 * `badRequest()`, `conflict()` and friends — and this module renders them.
 * ZudoJS decides the status, the code and whether the message may be shown
 * (`expose`, which defaults to true for 4xx and false for 5xx); all that is
 * added here is the `{ error: { code, message, requestId } }` shape from
 * `@betng/contracts` and the correlation id.
 *
 * A thrown value that is not an `HttpError` is a bug, not a client problem:
 * it becomes a 500 whose message is a constant, so an internal detail cannot
 * escape in a response body.
 */

import {
  ErrorCodes,
  type ErrorDetail,
  type ErrorResponse,
} from "@betng/contracts";
import {
  createResponseContext,
  type HttpRequestContext,
  type HttpResponseContext,
} from "@zudojs/http";
import type { Logger } from "@zudojs/logger";
import type { ValidationIssue } from "@zudojs/validation";
import { getRequestId } from "./requestId.js";

/** Builds the envelope. Exported so tests can assert on it directly. */
export function buildErrorBody(options: {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly ErrorDetail[];
}): ErrorResponse {
  return {
    error: {
      code: options.code,
      message: options.message,
      requestId: options.requestId,
      ...(options.details === undefined ? {} : { details: options.details }),
    },
  };
}

/** Turns `@zudojs/validation` issues into the envelope's `details`. */
export function toErrorDetails(
  issues: readonly ValidationIssue[],
): readonly ErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Anything carrying an HTTP status. `HttpError` from `@zudojs/http` is the
 * intended source; the structural check also accepts an equivalent error
 * from a duplicated copy of the package.
 */
interface StatusCarrying {
  readonly statusCode: number;
  readonly code?: unknown;
  readonly message?: unknown;
  readonly expose?: unknown;
  readonly details?: unknown;
}

function asStatusCarrying(error: unknown): StatusCarrying | undefined {
  if (error === null || typeof error !== "object") return undefined;

  const candidate = error as { statusCode?: unknown };
  const status = candidate.statusCode;

  return typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
    ? (error as StatusCarrying)
    : undefined;
}

/**
 * Middleware wraps a handler failure before it reaches the error handler, so
 * the original error is reached through `cause`. The depth bound stops a
 * cyclic chain from looping.
 */
function unwrap(error: unknown, depth = 0): StatusCarrying | undefined {
  if (depth > 8 || error === null || typeof error !== "object") {
    return undefined;
  }

  const direct = asStatusCarrying(error);
  if (direct) return direct;

  return unwrap((error as { cause?: unknown }).cause, depth + 1);
}

function isErrorDetails(value: unknown): value is readonly ErrorDetail[] {
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

/**
 * Renders any thrown value as a BetNG error response.
 *
 * Installed as the HTTP server's `errorHandler`, so it is the single place a
 * failure becomes a response body.
 */
export function createErrorHandler(logger: Logger) {
  return (error: unknown, request: HttpRequestContext): HttpResponseContext => {
    const requestId = getRequestId(request);
    const status = unwrap(error);

    if (status === undefined) {
      // Unexpected: log the whole thing for us, tell the client nothing.
      logger.error("Unhandled error", {
        requestId,
        method: request.method,
        path: request.path,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return createResponseContext({ status: 500 }).json(
        buildErrorBody({
          code: ErrorCodes.INTERNAL_ERROR,
          message: "An unexpected error occurred.",
          requestId,
        }),
      );
    }

    const exposed = status.expose === true;
    const code =
      typeof status.code === "string" && status.code.length > 0
        ? status.code
        : ErrorCodes.INTERNAL_ERROR;
    const message =
      exposed && typeof status.message === "string" && status.message.length > 0
        ? status.message
        : "An unexpected error occurred.";

    const details =
      exposed && isErrorDetails(status.details) ? status.details : undefined;

    const body = buildErrorBody({
      code,
      message,
      requestId,
      ...(details === undefined ? {} : { details }),
    });

    // A 5xx is ours to fix, so it is logged at error level with the cause
    // attached; a 4xx is the client's and is only worth a warn.
    const log = status.statusCode >= 500 ? logger.error : logger.warn;
    log.call(logger, "Request failed", {
      requestId,
      method: request.method,
      path: request.path,
      status: status.statusCode,
      code,
      error: error instanceof Error ? error.message : String(error),
    });

    return createResponseContext({ status: status.statusCode }).json(body);
  };
}
