/**
 * Cross-schema reads.
 *
 * Another service's tables are read with schema-qualified SQL and parameterised values only; the match login has
 * no write grant outside its own schema. A peer that has not run its migrations yet has no table: that reads as
 * "nothing there", because for this service an absent result and an absent table mean the same thing.
 */

const UNDEFINED_TABLE = "42P01";

function mentionsUndefinedTable(value: unknown, depth: number): boolean {
  if (depth > 4 || value === null || typeof value !== "object") return false;

  const candidate = value as { code?: unknown; message?: unknown; meta?: unknown; cause?: unknown };

  if (candidate.code === UNDEFINED_TABLE) return true;

  if (typeof candidate.message === "string" && /relation ".+" does not exist/.test(candidate.message)) return true;

  return mentionsUndefinedTable(candidate.meta, depth + 1) || mentionsUndefinedTable(candidate.cause, depth + 1);
}

export async function orWhenTableMissing<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (mentionsUndefinedTable(error, 0)) return fallback;

    throw error;
  }
}
