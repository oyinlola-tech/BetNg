/**
 * The settlement service's PostgreSQL connection.
 *
 * The service logs in with a role that may write the `settlement` schema and read the others. Settlements
 * and ledger rows are append-only in the database itself (triggers reject UPDATE and DELETE), so the audit
 * trail for money paid out does not depend on this code behaving.
 *
 * Prisma 7 takes a driver adapter rather than a URL; the adapter needs the schema passed separately, which
 * `databaseSchema` reads from the URL's `?schema=` parameter.
 */

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
