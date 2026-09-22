/**
 * Handlers throw `HttpError` or a `DomainError`; both already carry the
 * status, the code and the `expose` flag. A thrown value with no status
 * becomes a 500 with a constant message, so no internal detail escapes.
 */

import { REQUEST_ID_HEADER } from "@betng/contracts";
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

export interface ErrorHandlerOptions {
  /** Stack traces reach the log only when true; defaults to development and test. */
  readonly logStacks?: boolean;
}

const MAX_LOGGED_MESSAGE = 500;

export function describeError(error: unknown, logStacks: boolean): Record<string, string> {
  if (!(error instanceof Error)) {
    return { error: String(error).slice(0, MAX_LOGGED_MESSAGE) };
  }

  return {
    errorName: error.name,
    error: error.message.slice(0, MAX_LOGGED_MESSAGE),
    ...(logStacks && error.stack !== undefined ? { stack: error.stack } : {}),
  };
}

export function stacksAllowed(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const environment = env["NODE_ENV"];

  return environment === "development" || environment === "test";
}

export function createErrorHandler(
  logger: Logger,
  options: ErrorHandlerOptions = {},
): ServiceErrorHandler {
  const logStacks = options.logStacks ?? stacksAllowed();

  return (error, request) => {
    const requestId = getRequestId(request);
    const status = unwrapStatusError(error);

    if (status === undefined) {
      logger.error("Unhandled error", {
        requestId,
        method: request.method,
        path: request.path,
        ...describeError(error, logStacks),
      });

      return createResponseContext({ status: 500 }).setHeader(REQUEST_ID_HEADER, requestId).json(
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

    const failure = {
      requestId,
      method: request.method,
      path: request.path,
      status: status.statusCode,
      code: body.error.code,
      ...describeError(error, logStacks && status.statusCode >= 500),
    };

    if (status.statusCode >= 500) logger.error("Request failed", failure);
    else logger.warn("Request failed", failure);

    const response = createResponseContext({ status: status.statusCode }).setHeader(REQUEST_ID_HEADER, requestId);

    for (const [name, value] of Object.entries(status.headers ?? {})) {
      response.setHeader(name, value);
    }

    return response.json(body);
  };
}
