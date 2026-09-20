/**
 * The PostgreSQL boundary.
 *
 * A service connects to its own database and no other. The pool is created
 * from the single `DATABASE_URL` that service's configuration carries, which
 * is what keeps ownership enforceable rather than merely documented: a
 * service has no credentials for a table it does not own.
 *
 * This is a connection and health boundary only. Domain schema and queries
 * arrive with the services that need them; see `docs/architecture.md` for
 * the ownership map and `scripts/migrate.mjs` for how migrations are applied.
 */

import pg from "pg";
import type { DependencyProbe } from "../health/probes.js";

export interface PostgresPool {
  /** Runs `SELECT 1`, proving the connection works. */
  readonly ping: (signal?: AbortSignal) => Promise<void>;
  readonly close: () => Promise<void>;
  /** The underlying pool, for the services that run queries. */
  readonly pool: pg.Pool;
}

export function createPostgresPool(databaseUrl: string): PostgresPool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    // A foundation service holds a small pool: enough to serve concurrent
    // requests, few enough that eight services do not exhaust PostgreSQL's
    // default 100 connections between them.
    max: 5,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10_000,
  });

  // A pool emits `error` for an idle client dropped by the server. Without a
  // listener Node treats it as an unhandled 'error' event and exits.
  pool.on("error", () => {
    /* Reconnection is the pool's job; the next query surfaces any problem. */
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

/** A readiness probe for a service's own database. */
export function postgresProbe(pool: PostgresPool): DependencyProbe {
  return {
    name: "postgres",
    check: (signal) => pool.ping(signal),
  };
}
