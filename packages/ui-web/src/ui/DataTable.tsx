import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/cn";
import { Pagination } from "./Pagination";
import { SkeletonRows } from "./Skeleton";
import { EmptyState, ErrorState } from "./States";

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly cell: (row: T) => React.ReactNode;
  /** Returning a value makes the column sortable. */
  readonly sortValue?: (row: T) => string | number;
  readonly align?: "left" | "right" | "center";
  /** Tabular figures and no wrapping, for money, odds and counts. */
  readonly numeric?: boolean;
  readonly width?: string;
  /** Hidden below this breakpoint so narrow screens keep the essential columns. */
  readonly hideBelow?: "md" | "lg" | "xl";
}

export interface DataTableProps<T> {
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[] | undefined;
  readonly rowKey: (row: T) => string;
  readonly loading?: boolean;
  readonly error?: unknown;
  readonly onRetry?: () => void;
  readonly empty?: { readonly title: string; readonly description?: string; readonly action?: React.ReactNode };
  readonly onRowClick?: (row: T) => void;
  readonly selectedKey?: string | undefined;
  readonly density?: "compact" | "comfortable";
  /** Client-side page size. Omit when the server paginates and pass `pagination` instead. */
  readonly pageSize?: number;
  readonly pagination?: { readonly page: number; readonly pageSize: number; readonly total: number; readonly onPage: (page: number) => void };
  readonly initialSort?: { readonly key: string; readonly direction: "asc" | "desc" };
  readonly className?: string;
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  empty,
  onRowClick,
  selectedKey,
  density = "compact",
  pageSize,
  pagination,
  initialSort,
  className,
}: DataTableProps<T>): React.JSX.Element {
  const [sort, setSort] = useState(initialSort);
  const [localPage, setLocalPage] = useState(1);

  const sorted = useMemo(() => {
    if (rows === undefined) return [];

    const column = columns.find((c) => c.key === sort?.key);
    const sortValue = column?.sortValue;

    if (sort === undefined || sortValue === undefined) return rows;

    const factor = sort.direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const x = sortValue(a);
      const y = sortValue(b);

      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * factor;
    });
  }, [rows, columns, sort]);

  const pages = pageSize === undefined ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(localPage, pages);
  const visible = pageSize === undefined ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);

  if (error !== undefined && error !== null && rows === undefined) return <ErrorState error={error} {...(onRetry === undefined ? {} : { onRetry })} compact className={className} />;

  const pad = density === "compact" ? "px-3 py-2" : "px-4 py-3";

  return (
    <div className={className}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-left text-base">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => {
                const active = sort?.key === column.key;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                    style={column.width === undefined ? undefined : { width: column.width }}
                    className={cn(
                      "caps-label whitespace-nowrap bg-surface",
                      pad,
                      column.align === "right" || (column.numeric === true && column.align === undefined) ? "text-right" : column.align === "center" ? "text-center" : "text-left",
                      column.hideBelow !== undefined && HIDE[column.hideBelow],
                    )}
                  >
                    {column.sortValue === undefined ? (
                      column.header
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSort(active && sort.direction === "asc" ? { key: column.key, direction: "desc" } : { key: column.key, direction: "asc" });
                        }}
                        className="inline-flex items-center gap-1 rounded-xs uppercase tracking-caps hover:text-text-primary focus-ring"
                      >
                        {column.header}
                        {active ? sort.direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const key = rowKey(row);

              return (
                <tr
                  key={key}
                  tabIndex={onRowClick === undefined ? undefined : 0}
                  aria-selected={selectedKey === undefined ? undefined : key === selectedKey}
                  onClick={
                    onRowClick === undefined
                      ? undefined
                      : () => {
                          onRowClick(row);
                        }
                  }
                  onKeyDown={
                    onRowClick === undefined
                      ? undefined
                      : (event) => {
                          if (event.key === "Enter") onRowClick(row);
                        }
                  }
                  className={cn(
                    "border-b border-border last:border-b-0",
                    onRowClick !== undefined && "cursor-pointer outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover",
                    key === selectedKey && "bg-brand-subtle hover:bg-brand-subtle",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        pad,
                        "align-middle text-text-primary",
                        column.numeric === true && "whitespace-nowrap tabular",
                        column.align === "right" || (column.numeric === true && column.align === undefined) ? "text-right" : column.align === "center" ? "text-center" : "text-left",
                        column.hideBelow !== undefined && HIDE[column.hideBelow],
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && rows === undefined && <SkeletonRows rows={6} className="p-3" />}
      {!loading && rows !== undefined && rows.length === 0 && <EmptyState compact title={empty?.title ?? "Nothing to show"} {...(empty?.description === undefined ? {} : { description: empty.description })} {...(empty?.action === undefined ? {} : { action: empty.action })} />}
      {pagination !== undefined ? (
        <Pagination {...pagination} className="border-t border-border px-3 py-2" />
      ) : (
        pageSize !== undefined && sorted.length > pageSize && <Pagination page={page} pageSize={pageSize} total={sorted.length} onPage={setLocalPage} className="border-t border-border px-3 py-2" />
      )}
    </div>
  );
}
