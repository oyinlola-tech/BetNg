import { timingSafeEqual } from "node:crypto";
import type { HttpRequestContext } from "@zudojs/http";

export const INTERNAL_TOKEN_HEADER = "x-betng-internal-token";

/** Names the calling service; trusted only alongside a valid internal token. */
export const CALLER_HEADER = "x-betng-caller";

let serviceIdentity: string | undefined;

export function setServiceIdentity(name: string): void {
  serviceIdentity = name;
}

const MIN_TOKEN_LENGTH = 24;

/** The `.env.example` value: public, so refused in production. */
const DEVELOPMENT_PLACEHOLDER = "betng-local-development-internal-token";

type Env = Readonly<Record<string, string | undefined>>;

export function internalToken(env: Env = process.env): string | undefined {
  const token = env["INTERNAL_SERVICE_TOKEN"];

  return token === undefined || token === "" ? undefined : token;
}

/** Only an exact `development` or `test` may run without a token; unset, staging or a typo fails closed. */
export function allowsTokenlessInternalCalls(env: Env = process.env): boolean {
  const mode = env["NODE_ENV"];

  return mode === "development" || mode === "test";
}

export function assertInternalTokenConfigured(env: Env = process.env): void {
  const token = internalToken(env);

  if (token === undefined) {
    if (!allowsTokenlessInternalCalls(env)) {
      throw new Error(
        `INTERNAL_SERVICE_TOKEN must be set unless NODE_ENV is development or test (NODE_ENV is ${JSON.stringify(env["NODE_ENV"] ?? null)}).`,
      );
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

  return {
    ...(token === undefined ? {} : { [INTERNAL_TOKEN_HEADER]: token }),
    ...(serviceIdentity === undefined ? {} : { [CALLER_HEADER]: serviceIdentity }),
  };
}

export function isInternalRequest(request: HttpRequestContext, env: Env = process.env): boolean {
  const expected = internalToken(env);

  if (expected === undefined) return allowsTokenlessInternalCalls(env);

  const presented = Buffer.from(request.getHeader(INTERNAL_TOKEN_HEADER) ?? "");
  const wanted = Buffer.from(expected);

  return presented.length === wanted.length && timingSafeEqual(presented, wanted);
}
