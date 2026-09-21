import type { AdminListQuery } from "@betng/client-sdk";

export interface PagedRows<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

function searchable(row: object): string {
  return Object.values(row)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ")
    .toLowerCase();
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;

  const text = (value: unknown): string =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";

  return text(a).localeCompare(text(b), undefined, { numeric: true });
}

/** What a server does to a list before answering: search, filter, sort, then cut the page. */
export function pageRows<T extends object>(rows: readonly T[], query: AdminListQuery): PagedRows<T> {
  const needle = query.search?.trim().toLowerCase() ?? "";
  const filters = Object.entries(query.filters ?? {}).filter(([, value]) => value !== undefined && value !== "");

  let out = rows.filter((row) => {
    if (needle !== "" && !searchable(row).includes(needle)) return false;

    return filters.every(([key, value]) => !(key in row) || String((row as Record<string, unknown>)[key]) === value);
  });

  if (query.sort !== undefined && out.some((row) => query.sort !== undefined && query.sort in row)) {
    const key = query.sort;
    const sign = query.direction === "desc" ? -1 : 1;

    out = out
      .map((row, index) => ({ row, index }))
      .sort((a, b) => sign * compare((a.row as Record<string, unknown>)[key], (b.row as Record<string, unknown>)[key]) || a.index - b.index)
      .map((entry) => entry.row);
  }

  const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 25)));
  const page = Math.max(1, Math.trunc(query.page ?? 1));

  return { items: out.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: out.length };
}
