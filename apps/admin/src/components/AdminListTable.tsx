import { X } from "lucide-react";
import { Button, DataTable, SearchInput, Select, emptyPresets, type Column } from "@betng/ui-web";
import { ANY, PAGE_SIZES, type PagedList } from "../hooks/useAdminList";
import { formatCount } from "../lib/format";

export interface ListFilter {
  readonly key: string;
  readonly label: string;
  readonly anyLabel: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

export interface AdminListTableProps<T> {
  readonly list: PagedList<T>;
  readonly caption: string;
  readonly noun: string;
  readonly columns: readonly Column<T>[];
  readonly rowKey: (row: T) => string;
  readonly search?: { readonly label: string; readonly placeholder: string };
  readonly filters?: readonly ListFilter[];
  readonly toolbarStart?: React.ReactNode;
  readonly onRowClick?: (row: T) => void;
  readonly selectedKey?: string | undefined;
  readonly rowActions?: (row: T) => React.ReactNode;
  readonly renderCard: (row: T) => React.ReactNode;
}

/** The one table every server-driven admin list uses: the platform pages, sorts, searches and filters; this renders the page it answers. */
export function AdminListTable<T>({ list, caption, noun, columns, rowKey, search, filters = [], toolbarStart, onRowClick, selectedKey, rowActions, renderCard }: AdminListTableProps<T>): React.JSX.Element {
  const { query, state } = list;
  const total = query.data?.total;
  const preset = emptyPresets.noAdminRecords;

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={query.data?.items}
      rowKey={rowKey}
      loading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      sort={state.sort}
      onSortChange={list.setSort}
      pagination={{ page: query.data?.page ?? state.page, pageSize: query.data?.pageSize ?? state.pageSize, total: total ?? 0, onPage: list.setPage }}
      columnVisibility
      renderCard={renderCard}
      skeletonRows={8}
      {...(onRowClick === undefined ? {} : { onRowClick })}
      {...(selectedKey === undefined ? {} : { selectedKey })}
      {...(rowActions === undefined ? {} : { rowActions })}
      empty={{
        title: preset.title,
        description: list.isFiltered ? preset.description : `The platform has no ${noun} to list.`,
        ...(list.isFiltered
          ? {
              action: (
                <Button variant="secondary" size="sm" onClick={list.clear}>
                  Clear filters
                </Button>
              ),
            }
          : {}),
      }}
      toolbar={
        <>
          {toolbarStart}
          {search !== undefined && <SearchInput label={search.label} placeholder={search.placeholder} value={list.searchInput} onChange={list.setSearchInput} className="h-8 w-full sm:w-56" />}
          {filters.map((filter) => (
            <Select
              key={filter.key}
              label={filter.label}
              size="sm"
              value={state.filters[filter.key] ?? ANY}
              onChange={(value) => {
                list.setFilter(filter.key, value);
              }}
              options={[{ value: ANY, label: filter.anyLabel }, ...filter.options]}
            />
          ))}
          {list.isFiltered && (
            <Button variant="ghost" size="sm" leadingIcon={<X className="size-3.5" aria-hidden />} onClick={list.clear}>
              Clear
            </Button>
          )}
          <span className="ml-auto flex items-center gap-2">
            <span role="status" className="text-sm tabular text-text-muted">
              {total === undefined ? "" : `${formatCount(total)} ${noun}`}
            </span>
            <Select
              label="Rows per page"
              size="sm"
              value={String(state.pageSize)}
              onChange={(value) => {
                list.setPageSize(Number(value));
              }}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: `${String(size)} rows` }))}
            />
          </span>
        </>
      }
    />
  );
}
