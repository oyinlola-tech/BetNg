/**
 * Builds the gateway's readiness probes.
 *
 * The gateway is ready when the services it forwards to are answering. A
 * probe actually calls each one's `/health`, so readiness reflects what is
 * reachable right now rather than what was configured.
 *
 * Redis is probed only when `REDIS_URL` is set, and is optional: the
 * gateway serves without a cache, so a cold Redis degrades it rather than
 * taking it out of rotation.
 */

import { redisProbe, serviceProbe } from "@betng/service-kit";
import type {
  DependencyProbe,
  RedisConnection,
  ServiceConfig,
} from "@betng/service-kit";
import type { UpstreamClients } from "../interfaces/index.js";

export interface ProbeLoaderConfig {
  readonly config: ServiceConfig;
  readonly clients: UpstreamClients;
  readonly redis?: RedisConnection;
}

export function loadProbes(
  options: ProbeLoaderConfig,
): readonly DependencyProbe[] {
  const probes: DependencyProbe[] = [
    serviceProbe(options.clients.match),
    serviceProbe(options.clients.betting),
    serviceProbe(options.clients.wallet),
    serviceProbe(options.clients.settlement),
    serviceProbe(options.clients.odds),
  ];

  if (options.redis !== undefined) {
    probes.push({ ...redisProbe(options.redis), optional: true });
  }

  return probes;
}
