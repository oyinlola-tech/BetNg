import { createIpMatcher } from "@betng/service-kit";
import type { RateLimitRule } from "../interfaces/index.js";

export interface GatewayRateLimits {
  readonly global: RateLimitRule;
  readonly credential: RateLimitRule;
  readonly bets: RateLimitRule;
  readonly deposits: RateLimitRule;
  readonly withdrawals: RateLimitRule;
  readonly statements: RateLimitRule;
  readonly kycUploads: RateLimitRule;
  readonly verification: RateLimitRule;
  readonly exports: RateLimitRule;
  readonly webhooks: RateLimitRule;
  readonly health: RateLimitRule;
}

export interface SessionCookieSettings {
  readonly enabled: boolean;
  /** Parent domain shared by the apps and the API (e.g. `betng.ng`), so the apps can read the CSRF cookie. */
  readonly domain: string | undefined;
}

export interface GatewaySettings {
  readonly corsOrigins: readonly string[];
  readonly sessionCookie: SessionCookieSettings;
  readonly actorCacheSeconds: number;
  readonly rateLimits: GatewayRateLimits;
  readonly maxBodyBytes: number;
  readonly webhookMaxBodyBytes: number;
  readonly trustProxy: boolean | number | readonly string[];
  readonly hsts: boolean;
  readonly ipBlocklist: readonly string[];
  /** Namespace for rate-limit counters and the dynamic blocklist; the actor cache key is fixed by agreement. */
  readonly redisPrefix: string;
}

const DEFAULT_ORIGINS = [
  "http://localhost:4200",
  "http://localhost:4300",
  "http://localhost:4400",
  "http://localhost:4500",
  "http://localhost:8081",
  "http://127.0.0.1:4200",
  "http://127.0.0.1:4300",
  "http://127.0.0.1:4400",
  "http://127.0.0.1:4500",
  "http://127.0.0.1:8081",
];

const DEFAULT_LIMITS: GatewayRateLimits = {
  global: { limit: 300, windowSeconds: 60 },
  credential: { limit: 10, windowSeconds: 60 },
  bets: { limit: 30, windowSeconds: 60 },
  deposits: { limit: 10, windowSeconds: 300 },
  withdrawals: { limit: 5, windowSeconds: 600 },
  statements: { limit: 5, windowSeconds: 3600 },
  kycUploads: { limit: 10, windowSeconds: 3600 },
  verification: { limit: 5, windowSeconds: 600 },
  exports: { limit: 3, windowSeconds: 3600 },
  webhooks: { limit: 600, windowSeconds: 60 },
  health: { limit: 30, windowSeconds: 60 },
};

const LIMIT_ENV: Readonly<Record<keyof GatewayRateLimits, string>> = {
  global: "GATEWAY_RATE_GLOBAL",
  credential: "GATEWAY_RATE_CREDENTIAL",
  bets: "GATEWAY_RATE_BETS",
  deposits: "GATEWAY_RATE_DEPOSITS",
  withdrawals: "GATEWAY_RATE_WITHDRAWALS",
  statements: "GATEWAY_RATE_STATEMENTS",
  kycUploads: "GATEWAY_RATE_KYC_UPLOADS",
  verification: "GATEWAY_RATE_VERIFICATION",
  exports: "GATEWAY_RATE_EXPORTS",
  webhooks: "GATEWAY_RATE_WEBHOOKS",
  health: "GATEWAY_RATE_HEALTH",
};

const MAX_ACTOR_CACHE_SECONDS = 10;
const HARD_BODY_CAP = 1024 * 1024;
const RULE = /^(\d{1,6})\/(\d{1,6})$/;
const PREFIX = /^[a-z0-9:_-]{1,40}$/;
const COOKIE_DOMAIN = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

type Env = Readonly<Record<string, string | undefined>>;

function integer(raw: string | undefined, fallback: number, name: string, min: number, max: number): number {
  if (raw === undefined || raw === "") return fallback;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${String(min)} and ${String(max)}, got "${raw}".`);
  }

  return value;
}

function rule(raw: string | undefined, fallback: RateLimitRule, name: string): RateLimitRule {
  if (raw === undefined || raw === "") return fallback;

  const match = RULE.exec(raw.trim());
  const windowSeconds = Number(match?.[2]);

  if (match === null || windowSeconds === 0) {
    throw new Error(`${name} must be "<limit>/<windowSeconds>" (0 disables the limit), got "${raw}".`);
  }

  return { limit: Number(match[1]), windowSeconds };
}

function list(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function trustProxy(raw: string | undefined): GatewaySettings["trustProxy"] {
  const value = (raw ?? "").trim();

  if (value === "" || value === "false") return false;
  if (/^\d{1,2}$/.test(value)) return Number(value);

  const entries = list(value);

  if (entries.some((entry) => entry === "*" || entry.toLowerCase() === "all")) {
    throw new Error("GATEWAY_TRUST_PROXY must name the proxy hops or addresses; trusting every peer is refused.");
  }

  return entries;
}

function flag(raw: string | undefined, fallback: boolean, name: string): boolean {
  if (raw === undefined || raw === "") return fallback;
  if (raw === "on" || raw === "true") return true;
  if (raw === "off" || raw === "false") return false;

  throw new Error(`${name} must be on or off, got "${raw}".`);
}

function corsOrigins(raw: string | undefined, production: boolean): readonly string[] {
  const origins = list(raw);

  if (origins.includes("*")) {
    throw new Error("CORS_ORIGINS must list origins explicitly; '*' is refused.");
  }

  if (!production) return origins.length > 0 ? origins : DEFAULT_ORIGINS;

  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS must list the production https origins; the local defaults are refused in production.");
  }

  for (const origin of origins) {
    let url: URL;

    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS entry "${origin}" is not an origin.`);
    }

    const host = url.hostname.toLowerCase();

    if (url.protocol !== "https:" || url.origin !== origin) {
      throw new Error(`CORS_ORIGINS entry "${origin}" must be an https origin (scheme, host and optional port only).`);
    }

    if (LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost") || host.startsWith("127.")) {
      throw new Error(`CORS_ORIGINS entry "${origin}" is a local origin and is refused in production.`);
    }
  }

  return origins;
}

function sessionCookie(env: Env): SessionCookieSettings {
  const enabled = flag(env["GATEWAY_SESSION_COOKIE"], false, "GATEWAY_SESSION_COOKIE");
  const rawDomain = (env["GATEWAY_SESSION_COOKIE_DOMAIN"] ?? "").trim().toLowerCase().replace(/^\./, "");

  if (rawDomain !== "" && !COOKIE_DOMAIN.test(rawDomain)) {
    throw new Error(`GATEWAY_SESSION_COOKIE_DOMAIN must be a registrable domain name, got "${rawDomain}".`);
  }

  return Object.freeze({ enabled, domain: rawDomain === "" ? undefined : rawDomain });
}

export function loadGatewaySettings(env: Env = process.env): GatewaySettings {
  const production = env["NODE_ENV"] === "production";
  const origins = corsOrigins(env["CORS_ORIGINS"], production);

  const legacyLogin = env["LOGIN_RATE_LIMIT"] === undefined && env["LOGIN_RATE_WINDOW_SECONDS"] === undefined
    ? DEFAULT_LIMITS.credential
    : {
        limit: integer(env["LOGIN_RATE_LIMIT"], DEFAULT_LIMITS.credential.limit, "LOGIN_RATE_LIMIT", 0, 100_000),
        windowSeconds: integer(env["LOGIN_RATE_WINDOW_SECONDS"], DEFAULT_LIMITS.credential.windowSeconds, "LOGIN_RATE_WINDOW_SECONDS", 1, 86_400),
      };

  // Local stacks share one loopback address across every app and script, so the global default is looser off production.
  const defaults: GatewayRateLimits = {
    ...DEFAULT_LIMITS,
    credential: legacyLogin,
    ...(production ? {} : { global: { limit: 3000, windowSeconds: 60 } }),
  };

  const rateLimits = Object.fromEntries(
    (Object.keys(DEFAULT_LIMITS) as (keyof GatewayRateLimits)[]).map((key) => [
      key,
      rule(env[LIMIT_ENV[key]], defaults[key], LIMIT_ENV[key]),
    ]),
  ) as unknown as GatewayRateLimits;

  const maxBodyBytes = integer(env["GATEWAY_MAX_BODY_BYTES"], 64 * 1024, "GATEWAY_MAX_BODY_BYTES", 1024, HARD_BODY_CAP);
  const webhookMaxBodyBytes = integer(env["GATEWAY_WEBHOOK_MAX_BODY_BYTES"], 32 * 1024, "GATEWAY_WEBHOOK_MAX_BODY_BYTES", 1024, HARD_BODY_CAP);
  const ipBlocklist = list(env["GATEWAY_IP_BLOCKLIST"]);

  createIpMatcher(ipBlocklist);

  const redisPrefix = env["GATEWAY_REDIS_PREFIX"] ?? "gateway";

  if (!PREFIX.test(redisPrefix)) {
    throw new Error(`GATEWAY_REDIS_PREFIX must match ${PREFIX.source}.`);
  }

  return Object.freeze({
    corsOrigins: origins,
    sessionCookie: sessionCookie(env),
    actorCacheSeconds: integer(env["GATEWAY_ACTOR_CACHE_SECONDS"], 5, "GATEWAY_ACTOR_CACHE_SECONDS", 0, MAX_ACTOR_CACHE_SECONDS),
    rateLimits: Object.freeze(rateLimits),
    maxBodyBytes,
    webhookMaxBodyBytes,
    trustProxy: trustProxy(env["GATEWAY_TRUST_PROXY"]),
    hsts: flag(env["GATEWAY_HSTS"], production, "GATEWAY_HSTS"),
    ipBlocklist,
    redisPrefix,
  });
}

export const GATEWAY_HARD_BODY_CAP = HARD_BODY_CAP;

export { DEFAULT_LIMITS };
