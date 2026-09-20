import { createServiceClient } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";
import type { UpstreamClients } from "../interfaces/index.js";

export function loadClients(config: ServiceConfig): UpstreamClients {
  return {
    match: createServiceClient(config.services.match),
    betting: createServiceClient(config.services.betting),
    wallet: createServiceClient(config.services.wallet),
    settlement: createServiceClient(config.services.settlement),
    odds: createServiceClient(config.services.odds),
  };
}
