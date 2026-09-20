/**
 * Access logging.
 *
 * One line when a request arrives and one when it completes, both carrying
 * the correlation identifier, so a slow or failing request can be found by
 * identifier alone. Health probes are logged at debug: a readiness check
 * every few seconds would otherwise bury everything else.
 */

import type { HttpMiddleware } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";
import { getRequestId } from "./requestId.middleware.js";

const PROBE_PATHS = new Set(["/health", "/ready"]);

/**
 * Logs the start and end of every request.
 *
 * A request that throws still produces a completion line, because the
 * failing requests are exactly the ones that must not be missing from the
 * log.
 */
export function createAccessLogMiddleware(logger: Logger): HttpMiddleware {
  return async (context, next) => {
    const { request } = context;
    const requestId = getRequestId(request);
    const write = PROBE_PATHS.has(request.path) ? logger.debug : logger.info;
    const startedAt = performance.now();

    write.call(logger, "Request received", {
      requestId,
      method: request.method,
      path: request.path,
    });

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
