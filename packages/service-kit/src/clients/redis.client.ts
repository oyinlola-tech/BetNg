import { createClient } from "redis";
import type { RedisClientType } from "redis";
import type { DependencyProbe } from "../healthProbe/index.js";

export interface RedisConnection {
  readonly connect: () => Promise<void>;
  readonly ping: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly client: RedisClientType;
}

export function createRedisConnection(redisUrl: string): RedisConnection {
  const client: RedisClientType = createClient({
    url: redisUrl,
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  });

  client.on("error", () => {
    /* Surfaced by ping(); the readiness probe is what reports it. Without a
     * listener Node treats this as an unhandled 'error' event and exits. */
  });

  return {
    client,
    connect: async () => {
      if (!client.isOpen) {
        await client.connect();
      }
    },
    ping: async () => {
      if (!client.isOpen) {
        await client.connect();
      }

      await client.ping();
    },
    close: async () => {
      if (client.isOpen) {
        await client.close();
      }
    },
  };
}

export function redisProbe(connection: RedisConnection): DependencyProbe {
  return { name: "redis", check: async () => connection.ping() };
}
