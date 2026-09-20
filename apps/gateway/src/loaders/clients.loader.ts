/**
 * Builds a client for every service the gateway forwards to.
 *
 * Each client is built from the configured endpoint, so the gateway learns
 * where its peers live from the environment and never from a literal.
 */

import { createServiceClient } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";
import type { UpstreamClients } from "../interfaces/index.js";

/**
 * Creates the upstream clients.
 *
 * @param config - The gateway's configuration, carrying every endpoint.
 * @returns One client per upstream service.
 */
export function loadClients(config: ServiceConfig): UpstreamClients {
  return {
    match: createServiceClient(config.services.match),
    betting: createServiceClient(config.services.betting),
    wallet: createServiceClient(config.services.wallet),
    settlement: createServiceClient(config.services.settlement),
    odds: createServiceClient(config.services.odds),
  };
}
