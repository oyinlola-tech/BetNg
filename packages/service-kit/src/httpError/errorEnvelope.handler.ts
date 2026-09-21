/**
 * Handlers throw `HttpError` or a `DomainError`; both already carry the
 * status, the code and the `expose` flag. A thrown value with no status
 * becomes a 500 with a constant message, so no internal detail escapes.
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

export type ServiceErrorHandler = (
  error: unknown,
  request: HttpRequestContext,
) => HttpResponseContext;

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

    // A plain-object `details` travels as `error.data`.
    const data =
      exposed &&
      details === undefined &&
      typeof status.details === "object" &&
      status.details !== null &&
      !Array.isArray(status.details)
        ? (status.details as Readonly<Record<string, unknown>>)
        : undefined;

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
      ...(data === undefined ? {} : { data }),
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

    const response = createResponseContext({ status: status.statusCode });

    for (const [name, value] of Object.entries(status.headers ?? {})) {
      response.setHeader(name, value);
    }

    return response.json(body);
  };
}
