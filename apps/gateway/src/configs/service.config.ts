/**
 * Gateway configuration.
 *
 * The gateway owns no database: it holds no domain state of its own, only
 * the addresses of the services that do. `databaseUrlKey` is therefore
 * omitted, and `databaseUrl` stays `undefined`, so readiness reports no
 * database rather than a fictional one.
 *
 * Redis is enabled because the gateway is where response caching and
 * request throttling will eventually live.
 */

import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";

export const SERVICE_NAME = "gateway" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3000;

export async function loadGatewayConfig(
  env?: Readonly<Record<string, string | undefined>>,
): Promise<ServiceConfig> {
  return loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    usesRedis: true,
    ...(env === undefined ? {} : { env }),
  });
}
