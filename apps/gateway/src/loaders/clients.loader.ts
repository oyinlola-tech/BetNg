import { createServiceClient } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";
import type { UpstreamClients } from "../interfaces/index.js";

export function loadClients(config: ServiceConfig): UpstreamClients {
  return {
    match: createServiceClient(config.services.match),
    betting: createServiceClient(config.services.betting),
    wallet: createServiceClient(config.services.wallet),
    settlement: createServiceClient(config.services.settlement),
    simulation: createServiceClient(config.services.simulation),
    odds: createServiceClient(config.services.odds),
    risk: createServiceClient(config.services.risk),
    analytics: createServiceClient(config.services.analytics),
    identity: createServiceClient(config.services.identity),
    event: createServiceClient(config.services.event),
    payments: createServiceClient(config.services.payments),
    email: createServiceClient(config.services.email),
  };
}
