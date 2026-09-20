/**
 * The gateway's upstream contract.
 *
 * The gateway reaches every domain service through the same public REST
 * API a client would use. There is no private back channel, so nothing the
 * gateway can do is something a client could not do directly — which keeps
 * the services' own validation and authorisation meaningful.
 */

import type { ServiceClient } from "@betng/service-kit";

/** One client per service the gateway forwards to. */
export interface UpstreamClients {
  readonly match: ServiceClient;
  readonly betting: ServiceClient;
  readonly wallet: ServiceClient;
  readonly settlement: ServiceClient;
  readonly odds: ServiceClient;
}

/** The upstream services the gateway can forward to. */
export type UpstreamName = keyof UpstreamClients;
