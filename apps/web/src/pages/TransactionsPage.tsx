import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { formatDateTime, formatMoney, type TransactionView } from "@betng/ui-core";
import { Button, Card, Checkbox, DataTable, Dropdown, SearchInput, SectionHeader, StatusBadge, statusTone, useDebouncedValue, useIsCompact, type Column } from "@betng/ui-web";
import { AccountErrorState } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { SignedAmount, TransactionCard, TransactionDetailDialog, TransactionTypeLabel } from "../features/wallet/TransactionParts";
import { TRANSACTION_STATUSES, TRANSACTION_TYPES, TRANSACTION_TYPE_META, transactionDescription } from "../features/wallet/transactionMeta";
import { useTransactionFilters } from "../features/wallet/useTransactionFilters";
import { useAccountSignals, useTransactionsPage } from "../hooks/accountQueries";

const COLUMNS: readonly Column<TransactionView>[] = [
  { key: "createdAt", header: "Date", sortable: true, hideable: false, cell: (t) => <span className="type-small whitespace-nowrap text-text-secondary">{formatDateTime(t.createdAt)}</span> },
  { key: "reference", header: "Reference", hideBelow: "lg", cell: (t) => <span className="type-small font-mono text-text-secondary">{t.reference ?? "–"}</span> },
  { key: "type", header: "Type", sortable: true, cell: (t) => <TransactionTypeLabel transaction={t} /> },
  { key: "description", header: "Description", cell: (t) => <span className="type-body line-clamp-1 text-text-primary">{transactionDescription(t)}</span> },
  { key: "amount", header: "Amount", sortable: true, numeric: true, hideable: false, cell: (t) => <SignedAmount amount={t.amount} /> },
  { key: "status", header: "Status", cell: (t) => (t.status === undefined ? <span className="text-text-muted">–</span> : <StatusBadge status={t.status} />) },
  { key: "balanceAfter", header: "Balance after", sortable: true, numeric: true, hideBelow: "lg", cell: (t) => <span className="type-financial text-text-secondary">{formatMoney(t.balanceAfter)}</span> },
];

function toggled<T>(list: readonly T[], value: T, on: boolean): readonly T[] {
  return on ? [...list.filter((item) => item !== value), value] : list.filter((item) => item !== value);
}

function FilterTrigger({ label, count }: { readonly label: string; readonly count: number }): React.JSX.Element {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover pointer-coarse:h-11">
      {label}
      {count > 0 && <span className="rounded-xs bg-brand-subtle px-1 text-xs font-bold tabular text-brand">{count}</span>}
      <ChevronDown className="size-3.5 text-text-muted" aria-hidden />
    </span>
  );
}

const DATE_INPUT =
  "h-8 w-full min-w-0 rounded-sm border border-border-strong bg-surface px-2 text-sm text-text-primary tabular focus-ring pointer-coarse:h-11 sm:w-auto";

export function TransactionsPage(): React.JSX.Element {
  usePageMeta({ title: "Transactions", noindex: true });
  useAccountSignals();

  const { filters, query, active, update, clear } = useTransactionFilters();
  const transactions = useTransactionsPage(query);
  const [selected, setSelected] = useState<TransactionView>();
  const [searchText, setSearchText] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchText, 350);
  const compact = useIsCompact();

  useEffect(() => {
    if (debouncedSearch.trim() !== filters.search.trim()) update({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a settled search term writes the URL
  }, [debouncedSearch]);

  const toolbar = (
    <>
      <SearchInput label="Search transactions" placeholder="Search description or reference" value={searchText} onChange={setSearchText} className="w-full sm:w-64" />
      <Dropdown label="Filter by type" align="start" trigger={<FilterTrigger label="Type" count={filters.types.length} />}>
        <div className="space-y-2">
          {TRANSACTION_TYPES.map((type) => (
            <Checkbox
              key={type}
              label={TRANSACTION_TYPE_META[type].label}
              checked={filters.types.includes(type)}
              onChange={(event) => {
                update({ types: toggled(filters.types, type, event.target.checked) });
              }}
            />
          ))}
        </div>
      </Dropdown>
      <Dropdown label="Filter by status" align="start" trigger={<FilterTrigger label="Status" count={filters.statuses.length} />}>
        <div className="space-y-2">
          {TRANSACTION_STATUSES.map((status) => (
            <Checkbox
              key={status}
              label={statusTone(status).label}
              checked={filters.statuses.includes(status)}
              onChange={(event) => {
                update({ statuses: toggled(filters.statuses, status, event.target.checked) });
              }}
            />
          ))}
        </div>
      </Dropdown>
      <div className="flex w-full gap-2 sm:w-auto">
        <label className="type-small flex min-w-0 flex-1 items-center gap-1.5 text-text-secondary">
          From
          <input
            type="date"
            value={filters.from}
            max={filters.to === "" ? undefined : filters.to}
            onChange={(event) => {
              update({ from: event.target.value });
            }}
            className={DATE_INPUT}
          />
        </label>
        <label className="type-small flex min-w-0 flex-1 items-center gap-1.5 text-text-secondary">
          To
          <input
            type="date"
            value={filters.to}
            min={filters.from === "" ? undefined : filters.from}
            onChange={(event) => {
              update({ to: event.target.value });
            }}
            className={DATE_INPUT}
          />
        </label>
      </div>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<X className="size-3.5" aria-hidden />}
          onClick={() => {
            setSearchText("");
            clear();
          }}
        >
          Clear filters
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <SectionHeader as="h1" eyebrow="Simulated funds" title="Transactions" to="/wallet" linkLabel="Wallet" />
      <Card padding="none">
        {transactions.isError && transactions.data === undefined ? (
          <AccountErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
        ) : (
          <DataTable
            caption="Wallet transactions"
            columns={COLUMNS}
            rows={transactions.data?.items}
            rowKey={(t) => t.id}
            loading={transactions.isPending}
            density="comfortable"
            toolbar={toolbar}
            columnVisibility={!compact}
            sort={filters.sort}
            onSortChange={(sort) => {
              update({ sort });
            }}
            {...(transactions.data === undefined
              ? {}
              : {
                  pagination: {
                    page: transactions.data.page,
                    pageSize: transactions.data.pageSize,
                    total: transactions.data.total,
                    onPage: (page: number) => {
                      update({ page });
                    },
                  },
                })}
            empty={
              active
                ? { title: "No transactions match these filters", description: "Change or clear the filters to see more." }
                : { title: "No transactions", description: "Deposits, withdrawals and bet activity will be listed here." }
            }
            selectedKey={selected?.id}
            onRowClick={setSelected}
            renderCard={(t) => <TransactionCard transaction={t} />}
            skeletonRows={8}
          />
        )}
      </Card>
      <TransactionDetailDialog
        transaction={selected}
        onClose={() => {
          setSelected(undefined);
        }}
      />
    </div>
  );
}
