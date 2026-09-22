// `@prisma/adapter-pg` needs the schema passed separately: `new PrismaPg({ connectionString }, { schema })`.

export function databaseSchema(databaseUrl: string): string {
  const schema = new URL(databaseUrl).searchParams.get("schema");

  if (schema === null || schema === "") {
    throw new Error("The database URL must name its schema, e.g. ?schema=match.");
  }

  return schema;
}

export interface PoolOptions {
  readonly connectionString: string;
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
}

function bounded(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw);

  return raw !== undefined && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/** Pool settings for `new PrismaPg(poolOptions(url), …)`, sized by `DB_POOL_MAX` so replicas can share the server's connection budget. */
export function poolOptions(databaseUrl: string, env: Readonly<Record<string, string | undefined>> = process.env): PoolOptions {
  return {
    connectionString: databaseUrl,
    max: bounded(env["DB_POOL_MAX"], 10, 1, 100),
    idleTimeoutMillis: bounded(env["DB_POOL_IDLE_MS"], 30_000, 1_000, 600_000),
    connectionTimeoutMillis: bounded(env["DB_POOL_CONNECT_TIMEOUT_MS"], 5_000, 500, 60_000),
  };
}
