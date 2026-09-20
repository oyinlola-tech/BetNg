/**
 * The gateway's upstream contract.
 *
 * The gateway reaches every domain service through the same public REST
 * API a client would use. There is no private back channel, so nothing the
 * gateway can do is something a client could not do directly — which keeps
 * the services' own validation and authorisation meaningful.
 */

import type { ServiceClient } from "@betng/service-kit";

export interface UpstreamClients {
  readonly match: ServiceClient;
  readonly betting: ServiceClient;
  readonly wallet: ServiceClient;
  readonly settlement: ServiceClient;
  readonly odds: ServiceClient;
}

export type UpstreamName = keyof UpstreamClients;
