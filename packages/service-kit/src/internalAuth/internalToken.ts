// `/rpc` and the actor headers are honoured only with this token. Mandatory in production; unset elsewhere means no check.

import { timingSafeEqual } from "node:crypto";
import type { HttpRequestContext } from "@zudojs/http";

export const INTERNAL_TOKEN_HEADER = "x-betng-internal-token";

const MIN_TOKEN_LENGTH = 24;

/** The `.env.example` value: public, so refused in production. */
const DEVELOPMENT_PLACEHOLDER = "betng-local-development-internal-token";

export function internalToken(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  const token = env["INTERNAL_SERVICE_TOKEN"];

  return token === undefined || token === "" ? undefined : token;
}

export function assertInternalTokenConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const token = internalToken(env);

  if (token === undefined) {
    if (env["NODE_ENV"] === "production") {
      throw new Error("INTERNAL_SERVICE_TOKEN must be set in production.");
    }

    return;
  }

  if (env["NODE_ENV"] === "production" && token === DEVELOPMENT_PLACEHOLDER) {
    throw new Error("INTERNAL_SERVICE_TOKEN is still the development placeholder.");
  }

  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`INTERNAL_SERVICE_TOKEN must be at least ${String(MIN_TOKEN_LENGTH)} characters.`);
  }
}

export function internalHeaders(): Record<string, string> {
  const token = internalToken();

  return token === undefined ? {} : { [INTERNAL_TOKEN_HEADER]: token };
}

export function isInternalRequest(request: HttpRequestContext): boolean {
  const expected = internalToken();

  if (expected === undefined) return process.env["NODE_ENV"] !== "production";

  const presented = Buffer.from(request.getHeader(INTERNAL_TOKEN_HEADER) ?? "");
  const wanted = Buffer.from(expected);

  return presented.length === wanted.length && timingSafeEqual(presented, wanted);
}
