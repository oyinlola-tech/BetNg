/**
 * The Redis boundary.
 *
 * Redis is configured now because the platform will need it — caching, the
 * short-lived state of a match in play, and coordination between services.
 * None of that exists yet, so this module is exactly a connection and a
 * probe. Building an event bus or a distributed lock on top of it before
 * there is a caller would be guessing at requirements.
 */

import { createClient, type RedisClientType } from "redis";
import type { DependencyProbe } from "../health/probes.js";

export interface RedisConnection {
  readonly connect: () => Promise<void>;
  /** Issues `PING`, proving the connection works. */
  readonly ping: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly client: RedisClientType;
}

export function createRedisConnection(redisUrl: string): RedisConnection {
  const client: RedisClientType = createClient({
    url: redisUrl,
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  });

  // Without a listener a connection error is an unhandled 'error' event.
  client.on("error", () => {
    /* Surfaced by ping(); the readiness probe is what reports it. */
  });

  return {
    client,
    connect: async () => {
      if (!client.isOpen) await client.connect();
    },
    ping: async () => {
      if (!client.isOpen) await client.connect();
      await client.ping();
    },
    close: async () => {
      if (client.isOpen) await client.close();
    },
  };
}

/** A readiness probe for Redis. */
export function redisProbe(connection: RedisConnection): DependencyProbe {
  return {
    name: "redis",
    check: () => connection.ping(),
  };
}
