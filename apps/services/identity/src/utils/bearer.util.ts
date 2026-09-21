import type { HttpRequestContext } from "@betng/service-kit";

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]{16,512})$/u;

/** Auth routes identify the caller from this alone, never from `x-betng-*` headers. */
export function readBearerToken(request: HttpRequestContext): string | undefined {
  const header = request.getHeader("authorization");

  return header === undefined ? undefined : BEARER.exec(header.trim())?.[1];
}
