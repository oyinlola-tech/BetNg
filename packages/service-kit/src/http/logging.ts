/**
 * Access logging.
 *
 * One line when a request arrives, one when it completes, both carrying the
 * correlation id, so a slow or failing request can be found by id alone.
 * Health probes are logged at debug: a readiness check every few seconds
 * would otherwise bury everything else.
 */

import type { HttpMiddleware } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";
import { getRequestId } from "./requestId.js";

const PROBE_PATHS = new Set(["/health", "/ready"]);

export function createAccessLogMiddleware(logger: Logger): HttpMiddleware {
  return async (context, next) => {
    const { request } = context;
    const requestId = getRequestId(request);
    const isProbe = PROBE_PATHS.has(request.path);
    const startedAt = performance.now();

    const write = isProbe ? logger.debug : logger.info;

    write.call(logger, "Request received", {
      requestId,
      method: request.method,
      path: request.path,
    });

    // `finally` rather than a post-`next()` line: a handler that throws must
    // still produce a completion line, otherwise the failing requests are
    // exactly the ones missing from the log.
    try {
      const response = await next();

      write.call(logger, "Request completed", {
        requestId,
        method: request.method,
        path: request.path,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });

      return response;
    } catch (error) {
      write.call(logger, "Request failed before a response was produced", {
        requestId,
        method: request.method,
        path: request.path,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  };
}
