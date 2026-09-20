/**
 * The betting service's PostgreSQL connection.
 *
 * The service connects to `BETTING_DATABASE_URL` and to nothing else,
 * with a login that has rights to bets and their selections and no other service's tables. The
 * boundary is enforced by the database, not by convention: a query outside
 * it is refused.
 * *
 * Prisma 7 takes a driver adapter rather than a URL, and `@zudojs/database`
 * wraps the resulting client to give every BetNG service the same connection
 * lifecycle, transaction handling and health check.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { createServiceDatabase, databaseProbe } from "@betng/service-kit";
import type { DependencyProbe, ServiceDatabase } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";

export interface BettingDatabase {
  readonly database: ServiceDatabase;
  readonly probe: DependencyProbe;
  readonly prisma: PrismaClient;
}

export function createBettingDatabase(databaseUrl: string): BettingDatabase {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const database = createServiceDatabase(prisma);

  return { database, probe: databaseProbe(database), prisma };
}
