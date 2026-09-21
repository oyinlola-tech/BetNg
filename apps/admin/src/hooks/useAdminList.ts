import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { AdminCashierSummary, AdminCustomer, AdminFixture, AdminSettlement, AdminShopSummary, AdminSimulationRun, AdminTeam, Page } from "@betng/contracts";
import { useDebouncedValue, type SortState } from "@betng/ui-web";
import { keys } from "../lib/queryKeys";
import { adminSource } from "../services/runtime";

export interface AdminListRows {
  readonly users: AdminCustomer;
  readonly shops: AdminShopSummary;
  readonly cashiers: AdminCashierSummary;
  readonly teams: AdminTeam;
  readonly fixtures: AdminFixture;
  readonly settlements: AdminSettlement;
  readonly simulations: AdminSimulationRun;
}

export type AdminListResource = keyof AdminListRows;
type RowOf<K extends AdminListResource> = AdminListRows[K];

export interface AdminListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: string;
  readonly direction?: "asc" | "desc";
  readonly search?: string;
  readonly filters: Readonly<Record<string, string>>;
}

/** A filter set to this value in the URL is switched off, even when the list has a default for it. */
export const ANY = "all";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export interface AdminListDefaults {
  readonly pageSize?: number;
  readonly sort?: string;
  readonly direction?: "asc" | "desc";
  readonly filters?: Readonly<Record<string, string>>;
}

export interface AdminListOptions {
  readonly defaults?: AdminListDefaults;
  /** The filter names this list reads from the URL. */
  readonly filterKeys?: readonly string[];
  /** Filters the screen always applies, such as the league of a league page. Never written to the URL. */
  readonly fixedFilters?: Readonly<Record<string, string>>;
  readonly enabled?: boolean;
  readonly refetchInterval?: number;
}

export interface AdminListState {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: SortState | undefined;
  readonly search: string;
  readonly filters: Readonly<Record<string, string>>;
}

export interface AdminList<K extends AdminListResource> {
  readonly resource: K;
  readonly state: AdminListState;
  readonly request: AdminListQuery;
  readonly query: UseQueryResult<Page<RowOf<K>>>;
  readonly searchInput: string;
  readonly setSearchInput: (value: string) => void;
  readonly setPage: (page: number) => void;
  readonly setPageSize: (pageSize: number) => void;
  readonly setSort: (sort: SortState) => void;
  readonly setFilter: (key: string, value: string) => void;
  readonly clear: () => void;
  readonly isFiltered: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

function positiveInt(raw: string | null, fallback: number): number {
  const value = Number(raw);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function useAdminList<K extends AdminListResource>(resource: K, options: AdminListOptions = {}): AdminList<K> {
  const { defaults = {}, filterKeys = [], fixedFilters, enabled = true, refetchInterval } = options;
  const [params, setParams] = useSearchParams();
  const defaultPageSize = defaults.pageSize ?? 25;

  const page = positiveInt(params.get("page"), 1);
  const pageSize = Math.min(100, positiveInt(params.get("size"), defaultPageSize));
  const sortKey = params.get("sort") ?? defaults.sort;
  const direction = params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : (defaults.direction ?? "asc");
  const search = params.get("q") ?? "";
  const filterSignature = filterKeys.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");

  const filters = useMemo(() => {
    const out: Record<string, string> = {};

    for (const key of filterKeys) {
      const value = params.get(key) ?? defaults.filters?.[key];

      if (value !== undefined && value !== "" && value !== ANY) out[key] = value;
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  const patch = useCallback(
    (changes: Readonly<Record<string, string | undefined>>, resetPage = true) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          if (resetPage) next.delete("page");

          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }

          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const [searchInput, setSearchInput] = useState(search);
  const debounced = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const written = useRef(search);

  const settled = useRef(debounced);

  useEffect(() => {
    // Only a newly settled value is written; a re-render with the old one must not undo a clear.
    if (debounced === settled.current) return;

    settled.current = debounced;

    const next = debounced.trim();

    if (next === written.current) return;

    written.current = next;
    patch({ q: next });
  }, [debounced, patch]);

  useEffect(() => {
    // Back, forward or a pasted link changed the search; the box follows the address.
    if (search === written.current) return;

    written.current = search;
    setSearchInput(search);
  }, [search]);

  const sort: SortState | undefined = sortKey === undefined ? undefined : { key: sortKey, direction };

  const request = useMemo<AdminListQuery>(
    () => ({
      page,
      pageSize,
      ...(sortKey === undefined ? {} : { sort: sortKey, direction }),
      ...(search === "" ? {} : { search }),
      filters: { ...filters, ...fixedFilters },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, sortKey, direction, search, filters, JSON.stringify(fixedFilters ?? {})],
  );

  const query = useQuery({
    queryKey: keys.list(resource, request),
    queryFn: () => adminSource.queryList(resource, request),
    placeholderData: keepPreviousData,
    enabled,
    ...(refetchInterval === undefined ? {} : { refetchInterval: Math.max(5000, refetchInterval) }),
  }) as UseQueryResult<Page<RowOf<K>>>;

  const isFiltered = search !== "" || filterKeys.some((key) => params.get(key) !== null);

  return {
    resource,
    state: { page, pageSize, sort, search, filters },
    request,
    query,
    searchInput,
    setSearchInput,
    setPage: (next) => {
      patch({ page: next <= 1 ? undefined : String(next) }, false);
    },
    setPageSize: (next) => {
      patch({ size: next === defaultPageSize ? undefined : String(next) });
    },
    setSort: (next) => {
      patch({ sort: next.key, dir: next.direction });
    },
    setFilter: (key, value) => {
      const fallback = defaults.filters?.[key];

      // With a default in place, "no filter" has to be said out loud; otherwise the absent parameter already means it.
      patch({ [key]: value === ANY ? (fallback === undefined ? undefined : ANY) : value === fallback ? undefined : value });
    },
    clear: () => {
      written.current = "";
      setSearchInput("");
      patch(Object.fromEntries([["q", undefined], ...filterKeys.map((key) => [key, undefined] as const)]));
    },
    isFiltered,
  };
}
