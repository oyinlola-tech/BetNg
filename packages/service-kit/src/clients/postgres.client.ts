/**
 * The PostgreSQL boundary.
 *
 * A service connects to its own database and no other. The pool is built
 * from the single database URL that service's configuration carries, which
 * is what makes ownership enforceable rather than merely documented: a
 * service holds no credentials for a table it does not own.
 *
 * This is a connection and health boundary only. Domain schema and queries
 * arrive with the services that need them; see `docs/architecture.md` for
 * the ownership map and `scripts/migrate.mjs` for how migrations are
 * applied.
 */

import pg from "pg";
import type { DependencyProbe } from "../healthProbe/index.js";

/** A service's own connection pool. */
export interface PostgresPool {
  /** Runs `SELECT 1`, proving the connection works. */
  readonly ping: (signal?: AbortSignal) => Promise<void>;
  readonly close: () => Promise<void>;
  /** The underlying pool, for the services that run queries. */
  readonly pool: pg.Pool;
}

/**
 * A foundation service holds a small pool: enough to serve concurrent
 * requests, few enough that eight services do not exhaust PostgreSQL's
 * default hundred connections between them.
 */
const MAX_POOL_CLIENTS = 5;

/**
 * Opens a connection pool against one database.
 *
 * @param databaseUrl - The service's own `DATABASE_URL`.
 * @returns The pool, with ping and close.
 */
export function createPostgresPool(databaseUrl: string): PostgresPool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: MAX_POOL_CLIENTS,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10_000,
  });

  pool.on("error", () => {
    /* An idle client dropped by the server; the pool reconnects. Without a
     * listener Node treats this as an unhandled 'error' event and exits. */
  });

  return {
    pool,
    ping: async (signal?: AbortSignal) => {
      const client = await pool.connect();

      try {
        signal?.throwIfAborted();
        await client.query("SELECT 1");
      } finally {
        client.release();
      }
    },
    close: async () => {
      await pool.end();
    },
  };
}

/**
 * Builds a readiness probe for a service's own database.
 *
 * @param pool - The pool to watch.
 * @returns The probe.
 */
export function postgresProbe(pool: PostgresPool): DependencyProbe {
  return { name: "postgres", check: async (signal) => pool.ping(signal) };
}
