import type { HttpRequestContext } from "@betng/service-kit";

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]{16,512})$/u;

/**
 * Reads the session token from `Authorization: Bearer <token>`.
 *
 * The auth routes identify the caller from this and nothing else. They do not
 * read `x-betng-*` actor headers, so a forged header cannot stand in for a token.
 */
export function readBearerToken(request: HttpRequestContext): string | undefined {
  const header = request.getHeader("authorization");

  return header === undefined ? undefined : BEARER.exec(header.trim())?.[1];
}
