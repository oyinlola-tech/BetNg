export const SERVICE_NAMES = Object.freeze([
  "gateway",
  "match",
  "betting",
  "wallet",
  "settlement",
  "simulation",
  "odds",
  "risk",
  "event",
  "analytics",
  "identity",
  "payments",
  "email",
] as const);

export type ServiceName = (typeof SERVICE_NAMES)[number];

export type Environment = "development" | "test" | "production";

export interface ServiceEndpoint {
  readonly name: ServiceName;
  readonly url: string;
  readonly timeoutMs: number;
}

export interface ServiceConfig {
  readonly serviceName: ServiceName;
  readonly version: string;
  readonly environment: Environment;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  readonly databaseUrl: string | undefined;
  readonly redisUrl: string | undefined;
  readonly services: Readonly<Record<ServiceName, ServiceEndpoint>>;
}

export interface LoadServiceConfigOptions {
  readonly serviceName: ServiceName;
  readonly version: string;
  readonly defaultPort: number;
  readonly databaseUrlKey?: string;
  readonly usesRedis?: boolean;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

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
    event: 3008,
    analytics: 3009,
    identity: 3010,
    payments: 3011,
    email: 3012,
  });

export const DEFAULT_SERVICE_TIMEOUT_MS = 5000;
