import type { HttpMiddleware } from "@betng/service-kit";

export interface SecurityHeaderOptions {
  readonly hsts: boolean;
}

const HSTS = "max-age=31536000; includeSubDomains";
const PERMISSIONS_POLICY =
  "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()";

export function createSecurityHeadersMiddleware(options: SecurityHeaderOptions): HttpMiddleware {
  return async (context, next) => {
    const response = await next();
    const anonymousRead =
      context.request.method === "GET" &&
      context.request.getHeader("authorization") === undefined &&
      context.request.getHeader("cookie") === undefined &&
      response.status >= 200 &&
      response.status < 300;

    response
      .setHeader("x-content-type-options", "nosniff")
      .setHeader("x-frame-options", "DENY")
      .setHeader("referrer-policy", "no-referrer")
      .setHeader("permissions-policy", PERMISSIONS_POLICY)
      .setHeader("cross-origin-opener-policy", "same-origin")
      .setHeader("cache-control", anonymousRead ? "public, no-cache" : "private, no-store")
      .setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");

    if (options.hsts) response.setHeader("strict-transport-security", HSTS);

    return response;
  };
}
