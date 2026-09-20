import type { DependencyProbe } from "../healthProbe/index.js";
import type { ServiceClient } from "./serviceClient.core.js";

export interface ServiceProbeOptions {
  readonly optional?: boolean;
}

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
