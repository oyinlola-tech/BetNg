/**
 * Match service configuration.
 *
 * The service owns its own PostgreSQL database and connects to no other, so
 * `MATCH_DATABASE_URL` is required: the service refuses to start without it
 * rather than discovering the problem on the first query.
 */

import { loadServiceConfig, type ServiceConfig } from "@betng/service-kit";

export const SERVICE_NAME = "match" as const;
export const SERVICE_VERSION = "0.1.0";
export const DEFAULT_PORT = 3001;

export function loadMatchConfig(
  env?: Readonly<Record<string, string | undefined>>,
): Promise<ServiceConfig> {
  return loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "MATCH_DATABASE_URL",
    ...(env === undefined ? {} : { env }),
  });
}
