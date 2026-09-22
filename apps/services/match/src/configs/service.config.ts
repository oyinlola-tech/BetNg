import process from "node:process";
import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";

export const SERVICE_NAME = "match" as const;

export const SERVICE_VERSION = "0.2.0";

export const DEFAULT_PORT = 3001;

export interface MatchTiming {
  readonly secondsPerMinute: number;
  readonly halfTimeSeconds: number;
  readonly bettingCloseLeadSeconds: number;
  readonly roundCycleSeconds: number;
  readonly leagueStaggerSeconds: number;
  readonly upcomingRounds: number;
}

export const DEFAULT_TIMING: MatchTiming = Object.freeze({
  secondsPerMinute: 2,
  halfTimeSeconds: 15,
  bettingCloseLeadSeconds: 10,
  roundCycleSeconds: 240,
  leagueStaggerSeconds: 60,
  upcomingRounds: 3,
});

export interface MatchConfig extends ServiceConfig {
  readonly timing: MatchTiming;
  readonly schedulerEnabled: boolean;
  /** Only the public half: the private key stays with identity. */
  readonly vapidPublicKey: string | undefined;
}

type Env = Readonly<Record<string, string | undefined>>;

function readNumber(
  env: Env,
  key: string,
  fallback: number,
  bounds: {
    readonly min: number;
    readonly max: number;
    readonly integer?: boolean;
  },
): number {
  const raw = env[key];

  if (raw === undefined || raw.trim() === "") return fallback;

  const value = Number(raw);
  const valid =
    Number.isFinite(value) &&
    value >= bounds.min &&
    value <= bounds.max &&
    (bounds.integer !== true || Number.isInteger(value));

  if (!valid) {
    throw new Error(
      `${key} must be ${bounds.integer === true ? "an integer" : "a number"} ` +
        `between ${String(bounds.min)} and ${String(bounds.max)}.`,
    );
  }

  return value;
}

export function readTiming(env: Env): MatchTiming {
  return Object.freeze({
    secondsPerMinute: readNumber(
      env,
      "MATCH_SECONDS_PER_MINUTE",
      DEFAULT_TIMING.secondsPerMinute,
      { min: 0.001, max: 60 },
    ),
    halfTimeSeconds: readNumber(
      env,
      "MATCH_HALF_TIME_SECONDS",
      DEFAULT_TIMING.halfTimeSeconds,
      { min: 0, max: 900 },
    ),
    bettingCloseLeadSeconds: readNumber(
      env,
      "BETTING_CLOSE_LEAD_SECONDS",
      DEFAULT_TIMING.bettingCloseLeadSeconds,
      { min: 0, max: 3600 },
    ),
    roundCycleSeconds: readNumber(
      env,
      "ROUND_CYCLE_SECONDS",
      DEFAULT_TIMING.roundCycleSeconds,
      { min: 1, max: 86_400 },
    ),
    leagueStaggerSeconds: readNumber(
      env,
      "LEAGUE_STAGGER_SECONDS",
      DEFAULT_TIMING.leagueStaggerSeconds,
      { min: 0, max: 86_400 },
    ),
    upcomingRounds: readNumber(
      env,
      "UPCOMING_ROUNDS",
      DEFAULT_TIMING.upcomingRounds,
      { min: 1, max: 20, integer: true },
    ),
  });
}

export function readVapidPublicKey(env: Env): string | undefined {
  const raw = env["VAPID_PUBLIC_KEY"]?.trim();

  if (raw === undefined || raw === "") return undefined;

  const decoded = /^[A-Za-z0-9_-]+$/u.test(raw) ? Buffer.from(raw, "base64url") : undefined;

  if (decoded?.length !== 65 || decoded[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY must be a base64url 65-byte uncompressed P-256 public key.");
  }

  return raw;
}

export async function loadMatchConfig(env?: Env): Promise<MatchConfig> {
  const source = env ?? process.env;

  const service = await loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "MATCH_DATABASE_URL",
    usesRedis: true,
    ...(env === undefined ? {} : { env }),
  });

  return Object.freeze({
    ...service,
    timing: readTiming(source),
    schedulerEnabled:
      (source["SCHEDULER_ENABLED"] ?? "true").toLowerCase() !== "false",
    vapidPublicKey: readVapidPublicKey(source),
  });
}
