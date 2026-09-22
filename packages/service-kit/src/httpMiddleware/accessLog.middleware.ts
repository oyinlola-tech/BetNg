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
    const probe = PROBE_PATHS.has(request.path);
    const write = (message: string, meta: Record<string, string | number>): void => {
      if (probe) logger.debug(message, meta);
      else logger.info(message, meta);
    };
    const startedAt = performance.now();

    write("Request received", {
      requestId,
      method: request.method,
      path: request.path,
    });

    try {
      const response = await next();

      write("Request completed", {
        requestId,
        method: request.method,
        path: request.path,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });

      return response;
    } catch (error) {
      write("Request failed before a response was produced", {
        requestId,
        method: request.method,
        path: request.path,
        durationMs: Math.round(performance.now() - startedAt),
      });

      throw error;
    }
  };
}
