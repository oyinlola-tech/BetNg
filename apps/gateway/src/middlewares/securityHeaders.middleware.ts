/**
 * Response headers for a JSON API: no sniffing, no framing, no caching of personal data by intermediaries.
 */

import type { HttpMiddleware } from "@betng/service-kit";

export function createSecurityHeadersMiddleware(): HttpMiddleware {
  return async (_context, next) => {
    const response = await next();

    return response
      .setHeader("x-content-type-options", "nosniff")
      .setHeader("x-frame-options", "DENY")
      .setHeader("referrer-policy", "no-referrer")
      .setHeader("cache-control", "no-store")
      .setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  };
}
