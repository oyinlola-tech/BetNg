/**
 * The BetNG error handler.
 *
 * BetNG introduces no error hierarchy of its own. Handlers throw the
 * `HttpError` values `@zudojs/http` provides and the `DomainError`
 * subclasses in each service's `errors/` folder; both come from
 * `@zudojs/errors`, and both already carry the status, the machine-readable
 * code and the `expose` flag that decides whether the message may be shown.
 * All this module adds is the `{ error: { code, message, requestId } }`
 * shape and the correlation identifier.
 *
 * A thrown value carrying no status is a bug, not a client problem: it
 * becomes a 500 whose message is a constant, so an internal detail cannot
 * escape in a response body.
 */

import { createResponseContext } from "@zudojs/http";
import type { HttpRequestContext, HttpResponseContext } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";
import { getRequestId } from "../httpMiddleware/index.js";
import {
  buildErrorBody,
  FALLBACK_ERROR_CODE,
  OPAQUE_ERROR_MESSAGE,
} from "./errorEnvelope.builder.js";
import {
  isErrorDetails,
  unwrapStatusError,
} from "./errorEnvelope.resolver.js";

/** Renders any thrown value as a BetNG error response. */
export type ServiceErrorHandler = (
  error: unknown,
  request: HttpRequestContext,
) => HttpResponseContext;

/**
 * Creates the handler installed as the HTTP server's `errorHandler`.
 *
 * It is the single place a failure becomes a response body.
 *
 * @param logger - The logger failures are reported through.
 * @returns The error handler.
 */
export function createErrorHandler(logger: Logger): ServiceErrorHandler {
  return (error, request) => {
    const requestId = getRequestId(request);
    const status = unwrapStatusError(error);

    if (status === undefined) {
      logger.error("Unhandled error", {
        requestId,
        method: request.method,
        path: request.path,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return createResponseContext({ status: 500 }).json(
        buildErrorBody({
          code: FALLBACK_ERROR_CODE,
          message: OPAQUE_ERROR_MESSAGE,
          requestId,
        }),
      );
    }

    const exposed = status.expose === true;

    const details =
      exposed && isErrorDetails(status.details) ? status.details : undefined;

    const body = buildErrorBody({
      code:
        typeof status.code === "string" && status.code.length > 0
          ? status.code
          : FALLBACK_ERROR_CODE,
      message:
        exposed &&
        typeof status.message === "string" &&
        status.message.length > 0
          ? status.message
          : OPAQUE_ERROR_MESSAGE,
      requestId,
      ...(details === undefined ? {} : { details }),
    });

    const write = status.statusCode >= 500 ? logger.error : logger.warn;

    write.call(logger, "Request failed", {
      requestId,
      method: request.method,
      path: request.path,
      status: status.statusCode,
      code: body.error.code,
      error: error instanceof Error ? error.message : String(error),
    });

    return createResponseContext({ status: status.statusCode }).json(body);
  };
}
