// Identity and match are required; every other upstream only degrades the gateway.

import { redisProbe, serviceProbe } from "@betng/service-kit";
import type { DependencyProbe, RedisConnection } from "@betng/service-kit";
import type { UpstreamClients, UpstreamName } from "../interfaces/index.js";

const REQUIRED: readonly UpstreamName[] = ["identity", "match"];

export interface ProbeLoaderConfig {
  readonly clients: UpstreamClients;
  readonly redis?: RedisConnection;
}

export function loadProbes(options: ProbeLoaderConfig): readonly DependencyProbe[] {
  const probes: DependencyProbe[] = (
    Object.keys(options.clients) as UpstreamName[]
  ).map((name) =>
    serviceProbe(options.clients[name], { optional: !REQUIRED.includes(name) }),
  );

  if (options.redis !== undefined) {
    probes.push({ ...redisProbe(options.redis), optional: true });
  }

  return probes;
}
