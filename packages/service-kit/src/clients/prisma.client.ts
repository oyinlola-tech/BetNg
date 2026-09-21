/**
 * Prisma 7 takes a driver adapter rather than a URL, so the URL goes to
 * `@prisma/adapter-pg` and the adapter to the client.
 */

import {
  checkDatabaseHealth,
  createDatabaseClient,
  type DatabaseClient,
  type PrismaClientLike,
} from "@zudojs/database";
import type { DependencyProbe } from "../healthProbe/index.js";

export interface ServiceDatabase {
  readonly client: DatabaseClient;
  readonly connect: () => Promise<void>;
  readonly close: () => Promise<void>;
}

export function createServiceDatabase(
  prisma: PrismaClientLike,
): ServiceDatabase {
  const client = createDatabaseClient({ prisma });

  return {
    client,
    connect: async () => {
      await client.connect();
    },
    close: async () => {
      await client.disconnect();
    },
  };
}

export function databaseProbe(database: ServiceDatabase): DependencyProbe {
  return {
    name: "postgres",
    check: async () => {
      const health = await checkDatabaseHealth(database.client);

      if (health.status !== "healthy") {
        throw new Error(
          `The database reported ${health.status}.` +
            (health.message === undefined ? "" : ` ${health.message}`),
        );
      }
    },
  };
}
