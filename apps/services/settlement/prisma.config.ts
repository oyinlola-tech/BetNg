/**
 * Prisma configuration for the settlement service.
 *
 * Prisma 7 reads the connection URL for `migrate` and `db` commands from
 * here rather than from `schema.prisma`, and the runtime client is built
 * with a driver adapter instead of a URL. The service still learns where its
 * database is from one environment variable, so nothing is hard-coded.
 */

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("SETTLEMENT_DATABASE_URL"),
    // `migrate dev` diffs the schema against a throwaway database. Pointing
    // it at a dedicated one means this service's role does not need
    // CREATEDB — a privilege that would let it create a database outside
    // its own boundary.
    shadowDatabaseUrl: env("SETTLEMENT_SHADOW_DATABASE_URL"),
  },
});
