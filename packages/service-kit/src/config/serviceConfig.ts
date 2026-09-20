/**
 * Service configuration, loaded through `@zudojs/config`.
 *
 * Every value a BetNG service needs comes from the environment and is read
 * exactly once, at startup, into a frozen object. Application code reads that
 * object — it never touches `process.env` directly and never hard-codes a
 * host or port, so the same build runs unchanged in docker-compose and on a
 * developer's machine.
 */

import {
  createConfiguration,
  createEnvironmentConfigSource,
  type ConfigManager,
} from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";

/** The services a BetNG deployment is made of. */
export const SERVICE_NAMES = [
  "gateway",
  "match",
  "betting",
  "wallet",
  "settlement",
  "simulation",
  "odds",
  "risk",
] as const;

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
   * The environment variable holding this service's database URL, e.g.
   * `MATCH_DATABASE_URL`. Omit for a service that owns no database — the
   * gateway, for instance — and `databaseUrl` stays `undefined`.
   */
  readonly databaseUrlKey?: string;
  /** Whether this service uses Redis. Reads `REDIS_URL` when true. */
  readonly usesRedis?: boolean;
  /** Overrides `process.env`. Used by the tests. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** The default port each service listens on, matching `.env.example`. */
const DEFAULT_PORTS: Readonly<Record<ServiceName, number>> = Object.freeze({
  gateway: 3000,
  match: 3001,
  betting: 3002,
  wallet: 3003,
  settlement: 3004,
  simulation: 3005,
  odds: 3006,
  risk: 3007,
});

const DEFAULT_SERVICE_TIMEOUT_MS = 5000;

/**
 * `createEnvironmentConfigSource` lowercases variable names, so `LOG_LEVEL`
 * arrives as the key `log_level`.
 */
function configKey(variable: string): string {
  return variable.toLowerCase();
}

function readEnvironment(manager: ConfigManager): Environment {
  const raw = manager.string(configKey("NODE_ENV")) ?? "development";
  if (raw === "development" || raw === "test" || raw === "production") {
    return raw;
  }
  throw new ConfigurationError(
    `NODE_ENV must be one of development, test or production, got "${raw}".`,
  );
}

function readPort(
  manager: ConfigManager,
  serviceName: ServiceName,
  fallback: number,
): number {
  // A service-specific port wins, so one `.env` can drive every service.
  // `PORT` remains the override a container platform sets.
  const raw =
    manager.string(configKey(`${serviceName.toUpperCase()}_PORT`)) ??
    manager.string(configKey("PORT"));

  if (raw === undefined || raw.trim() === "") return fallback;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError(
      `Port must be an integer between 1 and 65535, got "${raw}".`,
    );
  }
  return port;
}

function readTimeout(manager: ConfigManager): number {
  const raw = manager.string(configKey("SERVICE_TIMEOUT_MS"));
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_SERVICE_TIMEOUT_MS;
  }

  const timeout = Number(raw);
  if (!Number.isInteger(timeout) || timeout < 1) {
    throw new ConfigurationError(
      `SERVICE_TIMEOUT_MS must be a positive integer, got "${raw}".`,
    );
  }
  return timeout;
}

function readEndpoints(
  manager: ConfigManager,
  timeoutMs: number,
): Readonly<Record<ServiceName, ServiceEndpoint>> {
  const entries = SERVICE_NAMES.map((name): [ServiceName, ServiceEndpoint] => {
    const url =
      manager.string(configKey(`${name.toUpperCase()}_SERVICE_URL`)) ??
      `http://localhost:${DEFAULT_PORTS[name]}`;

    // A malformed URL here surfaces as a startup failure rather than as a
    // confusing fetch error on the first request that needs the peer.
    try {
      new URL(url);
    } catch {
      throw new ConfigurationError(
        `${name.toUpperCase()}_SERVICE_URL is not a valid URL: "${url}".`,
      );
    }

    return [name, Object.freeze({ name, url, timeoutMs })];
  });

  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Record<ServiceName, ServiceEndpoint>
  >;
}

/**
 * Reads this service's configuration from the environment.
 *
 * Throws {@link ConfigurationError} on a value that cannot be used, so a
 * misconfigured service fails at startup instead of at the first request.
 */
export async function loadServiceConfig(
  options: LoadServiceConfigOptions,
): Promise<ServiceConfig> {
  const manager = createConfiguration({
    name: `${options.serviceName}-config`,
    sources: [
      createEnvironmentConfigSource(
        options.env === undefined ? {} : { env: options.env },
      ),
    ],
  });

  await manager.load();

  const timeoutMs = readTimeout(manager);

  const databaseUrl =
    options.databaseUrlKey === undefined
      ? undefined
      : manager.string(configKey(options.databaseUrlKey));

  if (options.databaseUrlKey !== undefined && databaseUrl === undefined) {
    throw new ConfigurationError(
      `${options.databaseUrlKey} is required by the ${options.serviceName} ` +
        `service but is not set. See .env.example.`,
    );
  }

  const config: ServiceConfig = Object.freeze({
    serviceName: options.serviceName,
    version: options.version,
    environment: readEnvironment(manager),
    host: manager.string(configKey("HOST")) ?? "0.0.0.0",
    port: readPort(manager, options.serviceName, options.defaultPort),
    logLevel: manager.string(configKey("LOG_LEVEL")) ?? "info",
    databaseUrl,
    redisUrl:
      options.usesRedis === true
        ? manager.string(configKey("REDIS_URL"))
        : undefined,
    services: readEndpoints(manager, timeoutMs),
  });

  await manager.dispose();

  return config;
}

export { DEFAULT_PORTS };
