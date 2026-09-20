/**
 * The betting service's PostgreSQL connection.
 *
 * The service connects to `BETTING_DATABASE_URL` and to nothing else, so it
 * holds no credentials for a table it does not own.
 */

import { createPostgresPool, postgresProbe } from "@betng/service-kit";
import type { DependencyProbe, PostgresPool } from "@betng/service-kit";

/** The betting database connection and the probe that watches it. */
export interface BettingDatabase {
  readonly pool: PostgresPool;
  readonly probe: DependencyProbe;
}

/**
 * Opens the betting service's database connection.
 *
 * @param databaseUrl - The value of `BETTING_DATABASE_URL`.
 * @returns The pool and its readiness probe.
 */
export function createBettingDatabase(databaseUrl: string): BettingDatabase {
  const pool = createPostgresPool(databaseUrl);

  return { pool, probe: postgresProbe(pool) };
}
