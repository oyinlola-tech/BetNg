/**
 * The shape of a BetNG service's configuration.
 *
 * Every value a service needs is read once, at startup, into a frozen
 * object. Application code reads that object; it never touches
 * `process.env` directly and never hard-codes a host or port, so the same
 * build runs unchanged in docker-compose and on a developer's machine.
 */

/** The services a BetNG deployment is made of. */
export const SERVICE_NAMES = Object.freeze([
  "gateway",
  "match",
  "betting",
  "wallet",
  "settlement",
  "simulation",
  "odds",
  "risk",
] as const);

export type ServiceName = (typeof SERVICE_NAMES)[number];

export type Environment = "development" | "test" | "production";

/** Where another BetNG service can be reached. */
export interface ServiceEndpoint {
  readonly name: ServiceName;
  readonly url: string;
  /** How long to wait for a response before giving up, in milliseconds. */
  readonly timeoutMs: number;
}

export interface ServiceConfig {
  readonly serviceName: ServiceName;
  readonly version: string;
  readonly environment: Environment;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  /** Present only for a service that owns a database. */
  readonly databaseUrl: string | undefined;
  /** Present only when Redis is configured for this service. */
  readonly redisUrl: string | undefined;
  /** Every peer service, keyed by name. Always fully populated. */
  readonly services: Readonly<Record<ServiceName, ServiceEndpoint>>;
}

export interface LoadServiceConfigOptions {
  readonly serviceName: ServiceName;
  readonly version: string;
  /** The port used when neither `<SERVICE>_PORT` nor `PORT` is set. */
  readonly defaultPort: number;
  /**
   * The environment variable holding this service's database URL, such as
   * `MATCH_DATABASE_URL`. Omit for a service that owns no database and
   * `databaseUrl` stays `undefined`.
   */
  readonly databaseUrlKey?: string;
  /** Whether this service uses Redis. Reads `REDIS_URL` when true. */
  readonly usesRedis?: boolean;
  /** Overrides `process.env`. Used by the tests. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** The port each service listens on by default, matching `.env.example`. */
export const DEFAULT_PORTS: Readonly<Record<ServiceName, number>> =
  Object.freeze({
    gateway: 3000,
    match: 3001,
    betting: 3002,
    wallet: 3003,
    settlement: 3004,
    simulation: 3005,
    odds: 3006,
    risk: 3007,
  });

/** How long a service waits on a peer when `SERVICE_TIMEOUT_MS` is unset. */
export const DEFAULT_SERVICE_TIMEOUT_MS = 5000;
