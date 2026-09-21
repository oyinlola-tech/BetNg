/**
 * Reads the `schema` parameter of a Prisma PostgreSQL URL.
 *
 * Every BetNG service lives in its own schema of the one `betng` database. Prisma's migration engine reads the
 * schema from the URL; the `@prisma/adapter-pg` driver adapter needs it passed separately:
 * `new PrismaPg({ connectionString }, { schema: databaseSchema(url) })`.
 */
export function databaseSchema(databaseUrl: string): string {
  const schema = new URL(databaseUrl).searchParams.get("schema");

  if (schema === null || schema === "") {
    throw new Error("The database URL must name its schema, e.g. ?schema=match.");
  }

  return schema;
}
