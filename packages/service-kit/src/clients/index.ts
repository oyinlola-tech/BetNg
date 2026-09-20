/**
 * @betng/service-kit/clients
 *
 * The boundaries a BetNG service reaches the outside world through.
 */

export { createServiceDatabase, databaseProbe } from "./prisma.client.js";
export type { ServiceDatabase } from "./prisma.client.js";

export { createRedisConnection, redisProbe } from "./redis.client.js";
export type { RedisConnection } from "./redis.client.js";

export { createServiceClient } from "./serviceClient.core.js";
export type {
  ServiceClient,
  ServiceRequest,
  ServiceResponse,
} from "./serviceClient.core.js";

export { serviceProbe } from "./serviceClient.probe.js";
export type { ServiceProbeOptions } from "./serviceClient.probe.js";
