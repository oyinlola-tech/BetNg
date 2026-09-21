export function definedOnly<T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

/** For a read that asked for `limit + 1` rows: the page, and whether a further row existed. */
export function toPage<T>(
  rows: readonly T[],
  limit: number,
): { readonly items: readonly T[]; readonly truncated: boolean } {
  return { items: rows.slice(0, limit), truncated: rows.length > limit };
}
