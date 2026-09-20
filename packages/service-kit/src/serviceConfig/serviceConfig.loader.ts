import {
  createConfiguration,
  createEnvironmentConfigSource,
} from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";
import type {
  LoadServiceConfigOptions,
  ServiceConfig,
} from "./serviceConfig.type.js";
import {
  configKey,
  readEnvironment,
  readPort,
  readTimeout,
} from "./serviceConfig.reader.js";
import { readEndpoints } from "./serviceConfig.endpoint.js";

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

  try {
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

    return Object.freeze({
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
      services: readEndpoints(manager, readTimeout(manager)),
    });
  } finally {
    await manager.dispose();
  }
}
