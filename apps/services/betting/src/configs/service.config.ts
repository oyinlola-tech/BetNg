/**
 * Betting service configuration.
 */

import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";

export const SERVICE_NAME = "betting" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3002;

/**
 * Reads the betting service configuration from the environment.
 *
 * @param env - Overrides `process.env`. Used by the tests.
 * @returns The resolved configuration.
 */
export async function loadBettingConfig(
  env?: Readonly<Record<string, string | undefined>>,
): Promise<ServiceConfig> {
  return loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "BETTING_DATABASE_URL",
    ...(env === undefined ? {} : { env }),
  });
}
