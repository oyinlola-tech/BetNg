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

/** A service's connection to its own database. */
export interface ServiceDatabase {
  /** The ZudoJS client: transactions, raw queries, lifecycle. */
  readonly client: DatabaseClient;
  /** Opens the connection. Safe to call more than once. */
  readonly connect: () => Promise<void>;
  /** Closes the connection and releases the pool. */
  readonly close: () => Promise<void>;
}

/**
 * Wraps a service's Prisma client in the ZudoJS database client.
 *
 * The Prisma client is constructed by the service, because it is generated
 * from that service's own schema and its type is specific to it. Everything
 * after construction is shared.
 *
 * @param prisma - The service's generated Prisma client, already built with
 *   its driver adapter.
 * @returns The connection, with connect and close.
 */
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
 *
 * @param database - The connection to watch.
 * @returns The probe.
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
