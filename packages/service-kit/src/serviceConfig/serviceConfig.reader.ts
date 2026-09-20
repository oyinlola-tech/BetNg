/**
 * Typed reads over a loaded `@zudojs/config` manager.
 *
 * Each reader rejects a value it cannot use, so a misconfigured service
 * fails at startup rather than at the first request that needs the value.
 */

import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";
import type { Environment, ServiceName } from "./serviceConfig.type.js";
import { DEFAULT_SERVICE_TIMEOUT_MS } from "./serviceConfig.type.js";

/**
 * Maps an environment variable name to its configuration key.
 *
 * `createEnvironmentConfigSource` lowercases variable names, so `LOG_LEVEL`
 * arrives as the key `log_level`.
 */
export function configKey(variable: string): string {
  return variable.toLowerCase();
}

export function readEnvironment(manager: ConfigManager): Environment {
  const raw = manager.string(configKey("NODE_ENV")) ?? "development";

  if (raw === "development" || raw === "test" || raw === "production") {
    return raw;
  }

  throw new ConfigurationError(
    `NODE_ENV must be one of development, test or production, got "${raw}".`,
  );
}

/**
 * Reads the port this service listens on.
 *
 * A service-specific `<SERVICE>_PORT` wins, so one `.env` can drive every
 * service at once. `PORT` remains the override a container platform sets.
 */
export function readPort(
  manager: ConfigManager,
  serviceName: ServiceName,
  fallback: number,
): number {
  const raw =
    manager.string(configKey(`${serviceName.toUpperCase()}_PORT`)) ??
    manager.string(configKey("PORT"));

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError(
      `Port must be an integer between 1 and 65535, got "${raw}".`,
    );
  }

  return port;
}

export function readTimeout(manager: ConfigManager): number {
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
