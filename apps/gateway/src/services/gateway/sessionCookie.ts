// Cookie sessions (GATEWAY_SESSION_COOKIE): the bearer lives in an HttpOnly cookie and every unsafe request echoes the readable
// CSRF cookie in `x-csrf-token` (double submit). Only responses to a listed browser origin get cookies; native clients keep bearers.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ErrorCodes } from "@betng/contracts";
import { forbidden } from "@betng/service-kit";
import type { HttpResponseContext, HttpRouterContext } from "@betng/service-kit";

export const SESSION_COOKIE = "betng_session";
export const CSRF_COOKIE = "betng_csrf";
export const CSRF_HEADER = "x-csrf-token";

/** Sent in the body in place of the bearer, so script never sees the credential; long enough for the session schemas. */
export const COOKIE_SESSION_PLACEHOLDER = "httponly-cookie-session";

const TOKEN = /^[A-Za-z0-9._~+/=-]{16,512}$/;
const CSRF_VALUE = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_COOKIES = 50;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface SessionCookiePolicy {
  readonly enabled: boolean;
  readonly domain: string | undefined;
  readonly origins: ReadonlySet<string>;
}

export const COOKIES_OFF: SessionCookiePolicy = Object.freeze({ enabled: false, domain: undefined, origins: new Set<string>() });

function readCookies(context: HttpRouterContext): Map<string, string> {
  const jar = new Map<string, string>();
  const header = context.request.getHeader("cookie");

  if (header === undefined) return jar;

  for (const part of header.split(";").slice(0, MAX_COOKIES)) {
    const at = part.indexOf("=");

    if (at <= 0) continue;

    const name = part.slice(0, at).trim();

    if (!jar.has(name)) jar.set(name, part.slice(at + 1).trim());
  }

  return jar;
}

export function cookieToken(policy: SessionCookiePolicy, context: HttpRouterContext): string | undefined {
  if (!policy.enabled) return undefined;

  const value = readCookies(context).get(SESSION_COOKIE);

  return value !== undefined && TOKEN.test(value) ? value : undefined;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Fixed-length digests keep the comparison constant-time whatever the presented length. */
export function assertCsrf(context: HttpRouterContext): void {
  if (SAFE_METHODS.has(context.request.method)) return;

  const expected = readCookies(context).get(CSRF_COOKIE);
  const presented = context.request.getHeader(CSRF_HEADER);
  const valid =
    expected !== undefined &&
    presented !== undefined &&
    CSRF_VALUE.test(expected) &&
    timingSafeEqual(digest(presented), digest(expected));

  if (!valid) {
    throw forbidden("This request was refused: its CSRF token is missing or does not match. Reload the page and try again.", {
      code: ErrorCodes.FORBIDDEN,
      expose: true,
    });
  }
}

/** Cookies go only to a browser page on a listed origin; a request without one (a native app, a script) keeps its bearer. */
export function cookiesApply(policy: SessionCookiePolicy, context: HttpRouterContext): boolean {
  const origin = context.request.getHeader("origin");

  return policy.enabled && origin !== undefined && policy.origins.has(origin);
}

function attributes(policy: SessionCookiePolicy, maxAgeSeconds: number, httpOnly: boolean): string {
  return [
    "Path=/",
    ...(policy.domain === undefined ? [] : [`Domain=${policy.domain}`]),
    `Max-Age=${String(maxAgeSeconds)}`,
    ...(httpOnly ? ["HttpOnly"] : []),
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function secondsUntil(expiresAt: unknown): number {
  const at = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;

  return Number.isFinite(at) ? Math.max(0, Math.floor((at - Date.now()) / 1000)) : 0;
}

export function issueSessionCookies(
  policy: SessionCookiePolicy,
  context: HttpRouterContext,
  response: HttpResponseContext,
  session: { readonly token: string; readonly expiresAt: unknown },
  rotateCsrf: boolean,
): void {
  const maxAge = secondsUntil(session.expiresAt);
  const current = readCookies(context).get(CSRF_COOKIE);
  const csrf = !rotateCsrf && current !== undefined && CSRF_VALUE.test(current)
    ? current
    : randomBytes(32).toString("base64url");

  response.header("set-cookie", [
    `${SESSION_COOKIE}=${session.token}; ${attributes(policy, maxAge, true)}`,
    `${CSRF_COOKIE}=${csrf}; ${attributes(policy, maxAge, false)}`,
  ]);
}

export function clearSessionCookies(policy: SessionCookiePolicy, response: HttpResponseContext): void {
  response.header("set-cookie", [
    `${SESSION_COOKIE}=; ${attributes(policy, 0, true)}`,
    `${CSRF_COOKIE}=; ${attributes(policy, 0, false)}`,
  ]);
}
