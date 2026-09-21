import { PrismaPg } from "@prisma/adapter-pg";
import { createServiceDatabase, databaseProbe, databaseSchema } from "@betng/service-kit";
import type { DependencyProbe, ServiceDatabase } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";

export interface MatchDatabase {
  readonly database: ServiceDatabase;
  readonly probe: DependencyProbe;
  readonly prisma: PrismaClient;
}

/** The match login writes only the `match` schema; every other schema is read-only to it. */
export function createMatchDatabase(databaseUrl: string): MatchDatabase {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }, { schema: databaseSchema(databaseUrl) }),
  });

  const database = createServiceDatabase(prisma);

  return { database, probe: databaseProbe(database), prisma };
}
