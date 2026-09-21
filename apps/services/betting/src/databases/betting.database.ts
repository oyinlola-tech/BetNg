/**
 * The betting service's PostgreSQL connection.
 *
 * The service connects with a login that may write only the `betting` schema
 * and read every other one. The boundary is enforced by the database, not by
 * convention: a write outside it is refused.
 *
 * Prisma 7 takes a driver adapter rather than a URL, and the adapter needs
 * the schema passed separately; `@zudojs/database` wraps the resulting client
 * to give every BetNG service the same connection lifecycle and health check.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import {
  createServiceDatabase,
  databaseProbe,
  databaseSchema,
} from "@betng/service-kit";
import type { DependencyProbe, ServiceDatabase } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";

export interface BettingDatabase {
  readonly database: ServiceDatabase;
  readonly probe: DependencyProbe;
  readonly prisma: PrismaClient;
}

export function createBettingDatabase(databaseUrl: string): BettingDatabase {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: databaseUrl },
      { schema: databaseSchema(databaseUrl) },
    ),
  });

  const database = createServiceDatabase(prisma);

  return { database, probe: databaseProbe(database), prisma };
}
