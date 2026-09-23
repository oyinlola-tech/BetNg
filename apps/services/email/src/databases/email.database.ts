import { PrismaPg } from "@prisma/adapter-pg";
import {
  createServiceDatabase,
  databaseProbe,
  databaseSchema,
  poolOptions,
} from "@betng/service-kit";
import type { DependencyProbe, ServiceDatabase } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";

export interface EmailDatabase {
  readonly database: ServiceDatabase;
  readonly probe: DependencyProbe;
  readonly prisma: PrismaClient;
}

export function createEmailDatabase(databaseUrl: string): EmailDatabase {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(poolOptions(databaseUrl), { schema: databaseSchema(databaseUrl) }),
  });

  const database = createServiceDatabase(prisma);

  return { database, probe: databaseProbe(database), prisma };
}
