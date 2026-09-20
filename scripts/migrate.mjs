/**
 * Applies each service's SQL migrations to its own database.
 *
 * One service, one database, one migration directory. The runner connects
 * with that service's URL and applies only that service's files, so a
 * migration cannot reach a table its service does not own.
 *
 * Each file runs inside a transaction together with the row that records it,
 * so a migration either applies completely and is marked done, or does
 * neither. A half-applied migration is the one failure mode that makes a
 * schema unrecoverable without manual surgery.
 *
 * Usage:
 *   node scripts/migrate.mjs            apply every pending migration
 *   node scripts/migrate.mjs --status   list what is applied and pending
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The services that own a database, and where their URL comes from. */
const SERVICES = [
  { name: "match", urlKey: "MATCH_DATABASE_URL" },
  { name: "betting", urlKey: "BETTING_DATABASE_URL" },
  { name: "wallet", urlKey: "WALLET_DATABASE_URL" },
  { name: "settlement", urlKey: "SETTLEMENT_DATABASE_URL" },
];

const STATUS_ONLY = process.argv.includes("--status");

/** Creates the ledger this runner reads and writes. */
const CREATE_LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     text        PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`;

async function readMigrations(service) {
  const directory = join(ROOT, "infrastructure", "migrations", service);

  let entries;
  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .map((file) => ({ version: file, path: join(directory, file) }));
}

async function applyTo(service, url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(CREATE_LEDGER);

    const { rows } = await client.query(
      "SELECT version FROM schema_migrations",
    );
    const applied = new Set(rows.map((row) => row.version));

    const migrations = await readMigrations(service);
    const pending = migrations.filter((m) => !applied.has(m.version));

    if (STATUS_ONLY) {
      console.log(
        `  ${service}: ${String(applied.size)} applied, ` +
          `${String(pending.length)} pending`,
      );
      for (const migration of pending) {
        console.log(`    pending: ${migration.version}`);
      }
      return pending.length;
    }

    if (pending.length === 0) {
      console.log(`  ${service}: up to date (${String(applied.size)} applied)`);
      return 0;
    }

    for (const migration of pending) {
      const sql = await readFile(migration.path, "utf8");

      // The migration and the row recording it commit together, so a
      // failure leaves neither behind.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [migration.version],
        );
        await client.query("COMMIT");
        console.log(`  ${service}: applied ${migration.version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `${service}/${migration.version} failed and was rolled back: ` +
            `${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    }

    return pending.length;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(
    STATUS_ONLY ? "BetNG migration status" : "Applying BetNG migrations",
  );

  let failed = false;

  for (const service of SERVICES) {
    const url = process.env[service.urlKey];

    if (!url) {
      console.error(
        `  ${service.name}: ${service.urlKey} is not set. ` +
          `Copy .env.example to .env.`,
      );
      failed = true;
      continue;
    }

    try {
      await applyTo(service.name, url);
    } catch (error) {
      console.error(
        `  ${service.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      failed = true;
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

await main();
