import { PrismaPg } from "@prisma/adapter-pg";
import {
  createServiceDatabase,
  databaseProbe,
  databaseSchema,
} from "@betng/service-kit";
import type { DependencyProbe, ServiceDatabase } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";

export interface SettlementDatabase {
  readonly database: ServiceDatabase;
  readonly probe: DependencyProbe;
  readonly prisma: PrismaClient;
}

export function createSettlementDatabase(databaseUrl: string): SettlementDatabase {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: databaseUrl },
      { schema: databaseSchema(databaseUrl) },
    ),
  });

  const database = createServiceDatabase(prisma);

  return { database, probe: databaseProbe(database), prisma };
}
