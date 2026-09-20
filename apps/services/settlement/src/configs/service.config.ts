/**
 * Settlement service configuration.
 *
 * The service reads completed match results from the match service and
 * resolves bets against them, so it is configured with both its own
 * database and the addresses of the peers it reads from.
 */

import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";

export const SERVICE_NAME = "settlement" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3004;

/**
 * Reads the settlement service configuration from the environment.
 *
 * @param env - Overrides `process.env`. Used by the tests.
 * @returns The resolved configuration.
 */
export async function loadSettlementConfig(
  env?: Readonly<Record<string, string | undefined>>,
): Promise<ServiceConfig> {
  return loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "SETTLEMENT_DATABASE_URL",
    ...(env === undefined ? {} : { env }),
  });
}
