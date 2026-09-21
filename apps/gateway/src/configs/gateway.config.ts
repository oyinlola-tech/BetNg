/**
 * Gateway-only settings, read once from the environment.
 */

export interface GatewaySettings {
  /** Browser origins allowed to call the API. Never `*`: the API carries bearer tokens. */
  readonly corsOrigins: readonly string[];
  /** How long a resolved session is reused before identity is asked again. Bounds how long a revoked session keeps working. */
  readonly actorCacheSeconds: number;
  readonly loginRateLimit: { readonly limit: number; readonly windowSeconds: number };
}

const DEFAULT_ORIGINS = [
  "http://localhost:4200",
  "http://localhost:4300",
  "http://localhost:4400",
  "http://localhost:4500",
  "http://localhost:8081",
];

function positiveInteger(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === "") return fallback;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${raw}".`);
  }

  return value;
}

export function loadGatewaySettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GatewaySettings {
  const origins = (env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");

  if (origins.includes("*")) {
    throw new Error("CORS_ORIGINS must list origins explicitly; '*' is refused.");
  }

  return Object.freeze({
    corsOrigins: origins.length > 0 ? origins : DEFAULT_ORIGINS,
    actorCacheSeconds: positiveInteger(env["GATEWAY_ACTOR_CACHE_SECONDS"], 10, "GATEWAY_ACTOR_CACHE_SECONDS"),
    loginRateLimit: {
      limit: positiveInteger(env["LOGIN_RATE_LIMIT"], 10, "LOGIN_RATE_LIMIT"),
      windowSeconds: positiveInteger(env["LOGIN_RATE_WINDOW_SECONDS"], 60, "LOGIN_RATE_WINDOW_SECONDS"),
    },
  });
}
