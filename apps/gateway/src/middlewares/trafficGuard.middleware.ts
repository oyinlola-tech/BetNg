import { ErrorCodes } from "@betng/contracts";
import { canonicalIp, forbidden } from "@betng/service-kit";
import type { HttpMiddleware, ServiceErrorHandler } from "@betng/service-kit";
import type { IpBlocklist, RateLimiter, RateLimitRule } from "../interfaces/index.js";

const UNLIMITED_PATHS = new Set(["/health", "/ready", "/metrics"]);

// Runs before CORS so a blocked address gets nothing but the refusal, preflights included.
export function createIpBlockMiddleware(blocklist: IpBlocklist, renderError: ServiceErrorHandler): HttpMiddleware {
  return async (context, next) => {
    const address = context.request.remoteAddress ?? "unknown";

    if (await blocklist.isBlocked(address)) {
      return renderError(
        forbidden("Access denied.", { code: ErrorCodes.FORBIDDEN, expose: true }),
        context.request,
      );
    }

    return next();
  };
}

// Fails open: a Redis outage must not take every read down. Money routes carry their own fail-closed limits.
export function createGlobalRateLimitMiddleware(limiter: RateLimiter, rule: RateLimitRule): HttpMiddleware {
  return async (context, next) => {
    if (!UNLIMITED_PATHS.has(context.request.path)) {
      await limiter.hit(`global:ip:${canonicalIp(context.request.remoteAddress ?? "unknown")}`, rule);
    }

    return next();
  };
}
