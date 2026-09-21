// Errors are rendered inside this middleware so that a 401 still carries CORS headers and the browser can read it.

import { createResponseContext } from "@betng/service-kit";
import type { HttpMiddleware, ServiceErrorHandler } from "@betng/service-kit";

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "authorization, content-type, idempotency-key, x-request-id";
const EXPOSED_HEADERS = "x-request-id, retry-after";

export function createCorsMiddleware(
  origins: readonly string[],
  renderError: ServiceErrorHandler,
): HttpMiddleware {
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

    const response = await next().catch((error: unknown) =>
      renderError(error, context.request),
    );

    if (permitted) {
      response
        .setHeader("access-control-allow-origin", origin)
        .setHeader("access-control-expose-headers", EXPOSED_HEADERS)
        .setHeader("vary", "origin");
    }

    return response;
  };
}
