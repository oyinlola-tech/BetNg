/**
 * The PostgreSQL boundary, built on `@zudojs/database`.
 *
 * `@zudojs/database` wraps a Prisma client and adds what a service needs
 * around it: connection lifecycle, transaction management, typed error
 * normalisation and a health check. BetNG uses it rather than talking to
 * Prisma directly, so connection and health behaviour is identical in every
 * service.
 *
 * A service connects to its own database with its own login and holds no
 * credentials for another's. That is what makes the ownership boundary in
 * `docs/architecture.md` enforceable rather than a convention: the database
 * refuses the query, not a code review.
 *
 * Prisma 7 no longer accepts a connection URL on the client, so the URL is
 * given to a driver adapter — `@prisma/adapter-pg` — and the adapter to the
 * client. The service still learns where its database is from exactly one
 * environment variable.
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

/**
 * Builds a readiness probe for a service's own database.
 *
 * `checkDatabaseHealth` issues a real query rather than inspecting a flag,
 * so a connection that has silently gone away is reported as unavailable
 * instead of healthy.
 */
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
