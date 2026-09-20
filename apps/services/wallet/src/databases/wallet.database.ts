/**
 * The wallet service's PostgreSQL connection.
 *
 * The service connects to `WALLET_DATABASE_URL` and to nothing else,
 * with a login that has rights to wallets and the append-only transaction ledger and no other service's tables. The
 * boundary is enforced by the database, not by convention: a query outside
 * it is refused.
 *
 * The ledger is the authority here: `Wallet.balance` is a projection of
 * the sum of its transactions, and the database refuses any update or
 * delete on that table. A balance can always be re-derived and audited.
 *
 * Prisma 7 takes a driver adapter rather than a URL, and `@zudojs/database`
 * wraps the resulting client to give every BetNG service the same connection
 * lifecycle, transaction handling and health check.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { createServiceDatabase, databaseProbe } from "@betng/service-kit";
import type { DependencyProbe, ServiceDatabase } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";

export interface WalletDatabase {
  readonly database: ServiceDatabase;
  readonly probe: DependencyProbe;
  readonly prisma: PrismaClient;
}

export function createWalletDatabase(databaseUrl: string): WalletDatabase {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const database = createServiceDatabase(prisma);

  return { database, probe: databaseProbe(database), prisma };
}
