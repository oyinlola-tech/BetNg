/**
 * The settlement service's PostgreSQL connection.
 *
 * The service connects to `SETTLEMENT_DATABASE_URL` and to nothing else. It
 * owns settlement records; it reads match results and bets through those
 * services' APIs rather than their tables.
 */

import { createPostgresPool, postgresProbe } from "@betng/service-kit";
import type { DependencyProbe, PostgresPool } from "@betng/service-kit";

/** The settlement database connection and the probe that watches it. */
export interface SettlementDatabase {
  readonly pool: PostgresPool;
  readonly probe: DependencyProbe;
}

/**
 * Opens the settlement service's database connection.
 *
 * @param databaseUrl - The value of `SETTLEMENT_DATABASE_URL`.
 * @returns The pool and its readiness probe.
 */
export function createSettlementDatabase(
  databaseUrl: string,
): SettlementDatabase {
  const pool = createPostgresPool(databaseUrl);

  return { pool, probe: postgresProbe(pool) };
}
