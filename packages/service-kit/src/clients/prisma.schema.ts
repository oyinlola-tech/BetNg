// `@prisma/adapter-pg` needs the schema passed separately: `new PrismaPg({ connectionString }, { schema })`.

export function databaseSchema(databaseUrl: string): string {
  const schema = new URL(databaseUrl).searchParams.get("schema");

  if (schema === null || schema === "") {
    throw new Error("The database URL must name its schema, e.g. ?schema=match.");
  }

  return schema;
}
