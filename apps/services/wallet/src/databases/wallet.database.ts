/**
 * The wallet service's PostgreSQL connection.
 *
 * The service connects to `WALLET_DATABASE_URL` and to nothing else, so it
 * holds no credentials for a table it does not own. The ledger is the one
 * place in BetNG where that matters most: no other service may write it.
 */

import { createPostgresPool, postgresProbe } from "@betng/service-kit";
import type { DependencyProbe, PostgresPool } from "@betng/service-kit";

/** The wallet database connection and the probe that watches it. */
export interface WalletDatabase {
  readonly pool: PostgresPool;
  readonly probe: DependencyProbe;
}

/**
 * Opens the wallet service's database connection.
 *
 * @param databaseUrl - The value of `WALLET_DATABASE_URL`.
 * @returns The pool and its readiness probe.
 */
export function createWalletDatabase(databaseUrl: string): WalletDatabase {
  const pool = createPostgresPool(databaseUrl);

  return { pool, probe: postgresProbe(pool) };
}
