import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from "lucide-react";
import { cn } from "../lib/cn";
import { Checkbox } from "./Checkbox";
import { Dropdown } from "./Dropdown";
import { Pagination } from "./Pagination";
import { Skeleton } from "./Skeleton";
import { EmptyState, ErrorState } from "./States";

export type SortDirection = "asc" | "desc";

export interface SortState {
  readonly key: string;
  readonly direction: SortDirection;
}

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly cell: (row: T) => React.ReactNode;
  /** Enables client-side sorting on this column. */
  readonly sortValue?: (row: T) => string | number;
  /** Marks the column sortable when the server does the sorting. */
  readonly sortable?: boolean;
  readonly align?: "left" | "right" | "center";
  /** Tabular figures and no wrapping, for money, odds and counts. */
  readonly numeric?: boolean;
  readonly width?: string;
  readonly hideBelow?: "md" | "lg" | "xl";
  /** Set false to keep the column out of the visibility menu. */
  readonly hideable?: boolean;
  readonly defaultHidden?: boolean;
}

export interface DataTablePagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPage: (page: number) => void;
}

export interface DataTableEmpty {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
}

export interface DataTableProps<T> {
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[] | undefined;
  readonly rowKey: (row: T) => string;
  readonly loading?: boolean;
  readonly error?: unknown;
  readonly onRetry?: () => void;
  readonly empty?: DataTableEmpty;
  readonly onRowClick?: (row: T) => void;
  readonly selectedKey?: string | undefined;
  readonly density?: "compact" | "comfortable";
  /** Client-side page size. Ignored when `pagination` is given. */
  readonly pageSize?: number;
  /** Server-driven pagination. */
  readonly pagination?: DataTablePagination;
  readonly initialSort?: SortState;
  /** Controlled sort. With `onSortChange` the rows are taken as already sorted by the server. */
  readonly sort?: SortState | undefined;
  readonly onSortChange?: (sort: SortState) => void;
  /** Filter bar rendered above the table. */
  readonly toolbar?: React.ReactNode;
  readonly columnVisibility?: boolean;
  readonly rowActions?: (row: T) => React.ReactNode;
  /** Card representation shown instead of the table below the `md` breakpoint. */
  readonly renderCard?: (row: T) => React.ReactNode;
  readonly stickyHeader?: boolean;
  /** Height cap for the scroll area; needed for `stickyHeader` to have something to stick to. */
  readonly maxHeight?: string;
  readonly skeletonRows?: number;
  readonly className?: string;
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

function alignment<T>(column: Column<T>): string {
  if (column.align === "right") return "text-right";
  if (column.align === "center") return "text-center";
  if (column.align === undefined && column.numeric === true) return "text-right";

  return "text-left";
}

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
  sort: controlledSort,
  onSortChange,
  toolbar,
  columnVisibility = false,
  rowActions,
  renderCard,
  stickyHeader = false,
  maxHeight,
  skeletonRows = 6,
  className,
}: DataTableProps<T>): React.JSX.Element {
  const [localSort, setLocalSort] = useState(initialSort);
  const [localPage, setLocalPage] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden === true).map((c) => c.key)),
  );
  const body = useRef<HTMLTableSectionElement>(null);

  const serverSorted = onSortChange !== undefined;
  const sort = controlledSort ?? (serverSorted ? undefined : localSort);

  const sorted = useMemo(() => {
    if (rows === undefined) return [];
    if (serverSorted || sort === undefined) return rows;

    const sortValue = columns.find((c) => c.key === sort.key)?.sortValue;

    if (sortValue === undefined) return rows;

    const factor = sort.direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const x = sortValue(a);
      const y = sortValue(b);

      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y))) * factor
      );
    });
  }, [rows, columns, sort, serverSorted]);

  const clientPaged = pagination === undefined && pageSize !== undefined;
  const pages = clientPaged ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const page = Math.min(localPage, pages);
  const visible = clientPaged
    ? sorted.slice((page - 1) * pageSize, page * pageSize)
    : sorted;

  const shownColumns = columns.filter((c) => !hidden.has(c.key));
  const hideable = columns.filter((c) => c.hideable !== false);
  const interactive = onRowClick !== undefined;
  const pad = density === "compact" ? "px-3 py-2" : "px-4 py-3";
  const failed = error !== undefined && error !== null && rows === undefined;
  const pending = loading && rows === undefined;
  const nothing = !loading && rows?.length === 0;
  const span = shownColumns.length + (rowActions === undefined ? 0 : 1);

  const changeSort = (column: Column<T>): void => {
    const next: SortState =
      sort?.key === column.key && sort.direction === "asc"
        ? { key: column.key, direction: "desc" }
        : { key: column.key, direction: "asc" };

    if (controlledSort === undefined) setLocalSort(next);

    onSortChange?.(next);
  };

  const focusRow = (index: number): void => {
    const clamped = Math.max(0, Math.min(visible.length - 1, index));

    setActiveIndex(clamped);
    body.current
      ?.querySelector<HTMLTableRowElement>(`tr[data-row-index="${String(clamped)}"]`)
      ?.focus();
  };

  const onRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    row: T,
    index: number,
  ): void => {
    if (event.target !== event.currentTarget) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusRow(0);
        break;
      case "End":
        event.preventDefault();
        focusRow(visible.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onRowClick?.(row);
        break;
      default:
    }
  };

  const tabStop = Math.min(activeIndex, Math.max(0, visible.length - 1));
  const showBar = toolbar !== undefined || columnVisibility;

  return (
    <div className={className}>
      {showBar && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {toolbar}
          </div>
          {columnVisibility && hideable.length > 0 && (
            <Dropdown
              label="Choose columns"
              trigger={
                <span className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover">
                  <Columns3 aria-hidden className="size-3.5" />
                  Columns
                </span>
              }
            >
              <div className="space-y-2">
                {hideable.map((column) => (
                  <Checkbox
                    key={column.key}
                    label={column.header}
                    checked={!hidden.has(column.key)}
                    disabled={!hidden.has(column.key) && shownColumns.length === 1}
                    onChange={(event) => {
                      const next = new Set(hidden);

                      if (event.target.checked) next.delete(column.key);
                      else next.add(column.key);

                      setHidden(next);
                    }}
                  />
                ))}
              </div>
            </Dropdown>
          )}
        </div>
      )}
      {failed ? (
        <ErrorState
          error={error}
          {...(onRetry === undefined ? {} : { onRetry })}
          compact
        />
      ) : (
        <>
          <div
            className={cn(
              "overflow-x-auto scrollbar-thin",
              stickyHeader && "overflow-y-auto",
              renderCard !== undefined && "hidden md:block",
            )}
            style={maxHeight === undefined ? undefined : { maxHeight }}
          >
            <table
              aria-busy={pending ? true : undefined}
              className="w-full border-collapse text-left text-base"
            >
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-b border-border">
                  {shownColumns.map((column) => {
                    const sortable =
                      column.sortable ?? column.sortValue !== undefined;
                    const active = sort?.key === column.key;

                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          !sortable
                            ? undefined
                            : active
                              ? sort.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                        }
                        style={
                          column.width === undefined
                            ? undefined
                            : { width: column.width }
                        }
                        className={cn(
                          "caps-label whitespace-nowrap bg-surface",
                          pad,
                          alignment(column),
                          stickyHeader && "sticky top-0 z-sticky",
                          column.hideBelow !== undefined && HIDE[column.hideBelow],
                        )}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => {
                              changeSort(column);
                            }}
                            className="inline-flex items-center gap-1 rounded-xs uppercase tracking-caps hover:text-text-primary focus-ring"
                          >
                            {column.header}
                            {active ? (
                              sort.direction === "asc" ? (
                                <ArrowUp aria-hidden className="size-3" />
                              ) : (
                                <ArrowDown aria-hidden className="size-3" />
                              )
                            ) : (
                              <ChevronsUpDown aria-hidden className="size-3 opacity-50" />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}
                  {rowActions !== undefined && (
                    <th
                      scope="col"
                      className={cn(
                        "sticky right-0 w-px bg-surface",
                        pad,
                        stickyHeader && "top-0 z-sticky",
                      )}
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody ref={body}>
                {pending &&
                  Array.from({ length: skeletonRows }, (_, r) => (
                    <tr key={r} aria-hidden className="border-b border-border last:border-b-0">
                      {Array.from({ length: span }, (_, c) => (
                        <td key={c} className={pad}>
                          <Skeleton className={(r + c) % 2 === 0 ? "w-3/4" : "w-1/2"} />
                        </td>
                      ))}
                    </tr>
                  ))}
                {visible.map((row, index) => {
                  const key = rowKey(row);
                  const selected = key === selectedKey;

                  return (
                    <tr
                      key={key}
                      data-row-index={index}
                      tabIndex={interactive ? (index === tabStop ? 0 : -1) : undefined}
                      aria-selected={selectedKey === undefined ? undefined : selected}
                      onClick={
                        interactive
                          ? () => {
                              setActiveIndex(index);
                              onRowClick(row);
                            }
                          : undefined
                      }
                      onFocus={
                        interactive
                          ? (event) => {
                              if (event.target === event.currentTarget)
                                setActiveIndex(index);
                            }
                          : undefined
                      }
                      onKeyDown={
                        interactive
                          ? (event) => {
                              onRowKeyDown(event, row, index);
                            }
                          : undefined
                      }
                      className={cn(
                        "group/row border-b border-border last:border-b-0",
                        interactive &&
                          "cursor-pointer transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
                        selected && "bg-brand-subtle hover:bg-brand-subtle",
                      )}
                    >
                      {shownColumns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            pad,
                            "align-middle text-text-primary",
                            column.numeric === true && "whitespace-nowrap tabular",
                            alignment(column),
                            column.hideBelow !== undefined && HIDE[column.hideBelow],
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                      {rowActions !== undefined && (
                        <td
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          className={cn(
                            pad,
                            "sticky right-0 w-px cursor-default whitespace-nowrap bg-surface text-right align-middle",
                            interactive && "group-hover/row:bg-surface-hover",
                            selected && "bg-brand-subtle group-hover/row:bg-brand-subtle",
                          )}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {rowActions(row)}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderCard !== undefined && (
            <ul aria-label={caption} className="space-y-2 p-3 md:hidden">
              {pending &&
                Array.from({ length: Math.min(skeletonRows, 4) }, (_, i) => (
                  <li
                    key={i}
                    aria-hidden
                    className="space-y-2 rounded-md border border-border bg-surface p-3"
                  >
                    <Skeleton className="w-2/3" />
                    <Skeleton className="w-1/3" />
                  </li>
                ))}
              {visible.map((row) => {
                const key = rowKey(row);

                return (
                  <li
                    key={key}
                    className={cn(
                      "rounded-md border border-border bg-surface",
                      key === selectedKey && "border-brand",
                    )}
                  >
                    {interactive ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onRowClick(row);
                        }}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key !== "Enter" && event.key !== " ") return;

                          event.preventDefault();
                          onRowClick(row);
                        }}
                        className="rounded-md p-3 focus-ring"
                      >
                        {renderCard(row)}
                      </div>
                    ) : (
                      <div className="p-3">{renderCard(row)}</div>
                    )}
                    {rowActions !== undefined && (
                      <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-1.5">
                        {rowActions(row)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {pending && (
            <p role="status" className="sr-only">
              Loading
            </p>
          )}
          {nothing && (
            <EmptyState
              compact
              title={empty?.title ?? "Nothing to show"}
              {...(empty?.description === undefined
                ? {}
                : { description: empty.description })}
              {...(empty?.action === undefined ? {} : { action: empty.action })}
            />
          )}
        </>
      )}
      {pagination !== undefined ? (
        <Pagination {...pagination} className="border-t border-border px-3 py-2" />
      ) : (
        clientPaged &&
        sorted.length > pageSize && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={sorted.length}
            onPage={setLocalPage}
            className="border-t border-border px-3 py-2"
          />
        )
      )}
    </div>
  );
}
