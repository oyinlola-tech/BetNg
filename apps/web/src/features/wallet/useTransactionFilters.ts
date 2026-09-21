import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { TransactionType } from "@betng/contracts";
import { localDayRange, type TransactionQuery, type TransactionStatus } from "@betng/ui-core";
import type { SortState } from "@betng/ui-web";
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from "./transactionMeta";

export const TRANSACTIONS_PAGE_SIZE = 20;

const SORT_KEYS = ["createdAt", "type", "amount", "balanceAfter"] as const;
const DEFAULT_SORT: SortState = { key: "createdAt", direction: "desc" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface TransactionFilters {
  readonly types: readonly TransactionType[];
  readonly statuses: readonly TransactionStatus[];
  readonly from: string;
  readonly to: string;
  readonly search: string;
  readonly page: number;
  readonly sort: SortState;
}

function readList<T extends string>(raw: string | null, allowed: readonly T[]): readonly T[] {
  if (raw === null || raw === "") return [];

  const wanted = new Set(raw.toUpperCase().split(","));

  return allowed.filter((value) => wanted.has(value));
}

function readDate(raw: string | null): string {
  return raw !== null && DATE.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : "";
}

export function readTransactionFilters(params: URLSearchParams): TransactionFilters {
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const sortKey = SORT_KEYS.find((key) => key === params.get("sort"));

  return {
    types: readList(params.get("type"), TRANSACTION_TYPES),
    statuses: readList(params.get("status"), TRANSACTION_STATUSES),
    from: readDate(params.get("from")),
    to: readDate(params.get("to")),
    search: (params.get("q") ?? "").slice(0, 80),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    sort: sortKey === undefined ? DEFAULT_SORT : { key: sortKey, direction: params.get("dir") === "asc" ? "asc" : "desc" },
  };
}

export function toTransactionQuery(filters: TransactionFilters): TransactionQuery {
  const search = filters.search.trim();

  return {
    page: filters.page,
    pageSize: TRANSACTIONS_PAGE_SIZE,
    sort: filters.sort.key,
    direction: filters.sort.direction,
    ...(filters.types.length === 0 ? {} : { types: filters.types }),
    ...(filters.statuses.length === 0 ? {} : { statuses: filters.statuses }),
    ...(filters.from === "" ? {} : { from: localDayRange(filters.from).from }),
    ...(filters.to === "" ? {} : { to: localDayRange(filters.to).to }),
    ...(search === "" ? {} : { search }),
  };
}

function writeFilters(filters: TransactionFilters): URLSearchParams {
  const next = new URLSearchParams();

  if (filters.types.length > 0) next.set("type", filters.types.join(",").toLowerCase());
  if (filters.statuses.length > 0) next.set("status", filters.statuses.join(",").toLowerCase());
  if (filters.from !== "") next.set("from", filters.from);
  if (filters.to !== "") next.set("to", filters.to);
  if (filters.search.trim() !== "") next.set("q", filters.search.trim());
  if (filters.page > 1) next.set("page", String(filters.page));

  if (filters.sort.key !== DEFAULT_SORT.key || filters.sort.direction !== DEFAULT_SORT.direction) {
    next.set("sort", filters.sort.key);
    next.set("dir", filters.sort.direction);
  }

  return next;
}

export interface TransactionFilterState {
  readonly filters: TransactionFilters;
  readonly query: TransactionQuery;
  readonly active: boolean;
  /** Changing a filter returns to the first page; changing the page keeps the filters. */
  readonly update: (patch: Partial<TransactionFilters>) => void;
  readonly clear: () => void;
}

export function useTransactionFilters(): TransactionFilterState {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readTransactionFilters(params), [params]);
  const query = useMemo(() => toTransactionQuery(filters), [filters]);

  const update = useCallback(
    (patch: Partial<TransactionFilters>) => {
      setParams(
        (current) => {
          const base = readTransactionFilters(current);

          return writeFilters({ ...base, page: 1, ...patch });
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return {
    filters,
    query,
    active: filters.types.length > 0 || filters.statuses.length > 0 || filters.from !== "" || filters.to !== "" || filters.search.trim() !== "",
    update,
    clear,
  };
}
