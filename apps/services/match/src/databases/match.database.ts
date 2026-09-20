/**
 * The match service's PostgreSQL connection.
 *
 * The service connects to `MATCH_DATABASE_URL` and to nothing else. That is
 * what makes data ownership enforceable rather than merely documented: the
 * match service holds no credentials for a table it does not own.
 *
 * The connection exists now so readiness reports the truth and so the
 * migration workflow has somewhere to point. Queries arrive with the match
 * schema; see `infrastructure/migrations/match`.
 */

import { createPostgresPool, postgresProbe } from "@betng/service-kit";
import type { DependencyProbe, PostgresPool } from "@betng/service-kit";

/** The match database connection and the readiness probe that watches it. */
export interface MatchDatabase {
  readonly pool: PostgresPool;
  readonly probe: DependencyProbe;
}

/**
 * Opens the match service's database connection.
 *
 * @param databaseUrl - The value of `MATCH_DATABASE_URL`.
 * @returns The pool and its readiness probe.
 */
export function createMatchDatabase(databaseUrl: string): MatchDatabase {
  const pool = createPostgresPool(databaseUrl);

  return { pool, probe: postgresProbe(pool) };
}
