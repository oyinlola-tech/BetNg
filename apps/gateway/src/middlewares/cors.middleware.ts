/**
 * CORS for the browser clients.
 *
 * Only configured origins are echoed back; anything else gets no CORS headers, so the browser blocks it. The
 * API authenticates with a bearer header, not cookies, so credentials mode stays off.
 */

import { createResponseContext } from "@betng/service-kit";
import type { HttpMiddleware } from "@betng/service-kit";

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "authorization, content-type, idempotency-key, x-request-id";
const EXPOSED_HEADERS = "x-request-id, retry-after";

export function createCorsMiddleware(origins: readonly string[]): HttpMiddleware {
  const allowed = new Set(origins);

  return async (context, next) => {
    const origin = context.request.getHeader("origin");
    const permitted = origin !== undefined && allowed.has(origin);

    if (context.request.method === "OPTIONS") {
      const preflight = createResponseContext({ status: 204 });

      if (permitted) {
        preflight
          .setHeader("access-control-allow-origin", origin)
          .setHeader("access-control-allow-methods", ALLOWED_METHODS)
          .setHeader("access-control-allow-headers", ALLOWED_HEADERS)
          .setHeader("access-control-max-age", "600")
          .setHeader("vary", "origin");
      }

      return preflight;
    }

    const response = await next();

    if (permitted) {
      response
        .setHeader("access-control-allow-origin", origin)
        .setHeader("access-control-expose-headers", EXPOSED_HEADERS)
        .setHeader("vary", "origin");
    }

    return response;
  };
}
