/**
 * The identity service's PostgreSQL connection.
 *
 * The service connects with `IDENTITY_DATABASE_URL`, a login that may write
 * the `identity` schema and only read the others. Customers, admin users,
 * cashiers and their sessions live here; their wallets and bets do not.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { createServiceDatabase, databaseProbe, databaseSchema } from "@betng/service-kit";
import type { DependencyProbe, ServiceDatabase } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";

export interface IdentityDatabase {
  readonly database: ServiceDatabase;
  readonly probe: DependencyProbe;
  readonly prisma: PrismaClient;
}

export function createIdentityDatabase(databaseUrl: string): IdentityDatabase {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: databaseUrl },
      { schema: databaseSchema(databaseUrl) },
    ),
  });

  const database = createServiceDatabase(prisma);

  return { database, probe: databaseProbe(database), prisma };
}
