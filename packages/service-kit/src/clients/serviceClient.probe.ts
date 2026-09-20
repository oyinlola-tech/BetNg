/**
 * Readiness probes over peer services.
 */

import type { DependencyProbe } from "../healthProbe/index.js";
import type { ServiceClient } from "./serviceClient.core.js";

/** How a peer's health affects this service's readiness. */
export interface ServiceProbeOptions {
  /**
   * Whether this service can still serve when the peer is down.
   *
   * An optional peer that is unreachable makes this service `degraded`; a
   * required one makes it `unavailable`.
   */
  readonly optional?: boolean;
}

/**
 * Builds a readiness probe that checks a peer service is answering.
 *
 * @param client - The peer's client.
 * @param options - Whether the peer is optional.
 * @returns The probe.
 */
export function serviceProbe(
  client: ServiceClient,
  options: ServiceProbeOptions = {},
): DependencyProbe {
  return {
    name: `${client.endpoint.name}-service`,
    check: async (signal) => client.health(signal),
    ...(options.optional === undefined ? {} : { optional: options.optional }),
  };
}
