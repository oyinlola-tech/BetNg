import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";
import { formatDateTime, formatMoney, formatSignedMoney, type TransactionView, type WalletView } from "@betng/ui-core";
import { Button, Card, EmptyState, SectionHeader, SectionHeading, SkeletonRows, WalletSkeleton, cn } from "@betng/ui-web";
import { AccountErrorState } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { SignedAmount, TransactionDetailDialog, TransactionTypeLabel } from "../features/wallet/TransactionParts";
import { TRANSACTION_TYPES, TRANSACTION_TYPE_META, transactionDescription, transactionTypeMeta } from "../features/wallet/transactionMeta";
import { WalletActionDialog, type WalletAction } from "../features/wallet/WalletActionDialog";
import { RECENT_TRANSACTIONS_QUERY, useAccountSignals, useTransactionsPage, useWallet } from "../hooks/accountQueries";

function Figure({ label, amount, note }: { readonly label: string; readonly amount: number; readonly note?: string }): React.JSX.Element {
  return (
    <div className="px-4 py-3">
      <dt className="type-caption">{label}</dt>
      <dd className="type-financial mt-1 text-left text-lg text-text-primary">{formatMoney(amount)}</dd>
      {note !== undefined && <p className="type-small mt-0.5 text-text-muted">{note}</p>}
    </div>
  );
}

function Balances({ wallet, onAction }: { readonly wallet: WalletView; readonly onAction: (action: WalletAction) => void }): React.JSX.Element {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 p-5 md:p-6">
        <div className="min-w-0">
          <p className="type-caption">Available to bet</p>
          <p className="type-financial mt-1 text-left text-4xl leading-none text-text-primary md:text-5xl" data-testid="wallet-available">
            {formatMoney(wallet.available)}
          </p>
          <p className="type-small mt-2 text-text-muted">{wallet.currency} · simulated funds</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            className="flex-1 sm:flex-none"
            leadingIcon={<ArrowDownToLine className="size-4" aria-hidden />}
            onClick={() => {
              onAction("DEPOSIT");
            }}
          >
            Deposit
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            variant="secondary"
            leadingIcon={<ArrowUpFromLine className="size-4" aria-hidden />}
            onClick={() => {
              onAction("WITHDRAW");
            }}
          >
            Withdraw
          </Button>
        </div>
      </div>
      <dl className={cn("grid divide-y divide-border border-t border-border bg-surface-sunken sm:divide-x sm:divide-y-0", wallet.pending === undefined ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        <Figure label="Balance" amount={wallet.balance} note="Everything in the wallet" />
        <Figure label="Reserved" amount={wallet.reserved} note="Held by open bets" />
        {wallet.pending !== undefined && <Figure label="Pending" amount={wallet.pending} note="Being processed" />}
      </dl>
    </Card>
  );
}

function PageBreakdown({ items }: { readonly items: readonly TransactionView[] }): React.JSX.Element {
  const sums = useMemo(() => {
    const totals = new Map<string, number>();

    for (const item of items) totals.set(item.type, (totals.get(item.type) ?? 0) + item.amount);

    return totals;
  }, [items]);

  return (
    <Card>
      <SectionHeading as="h2">This page</SectionHeading>
      <p className="type-small mt-1 text-text-muted">
        Sums of the {items.length} most recent {items.length === 1 ? "transaction" : "transactions"} shown here. These are not account totals.
      </p>
      <dl className="mt-3 divide-y divide-border">
        {[...TRANSACTION_TYPES, ...[...sums.keys()].filter((type) => !Object.hasOwn(TRANSACTION_TYPE_META, type))].map((type) => (
          <div key={type} className="flex items-center justify-between gap-3 py-2">
            <dt className="type-small text-text-secondary">{transactionTypeMeta(type).plural}</dt>
            <dd className="type-financial text-text-primary">{sums.has(type) ? formatSignedMoney(sums.get(type) ?? 0) : "–"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function WalletPage(): React.JSX.Element {
  usePageMeta({ title: "Wallet", noindex: true });
  useAccountSignals();

  const wallet = useWallet();
  const recent = useTransactionsPage(RECENT_TRANSACTIONS_QUERY);
  const [action, setAction] = useState<WalletAction>();
  const [selected, setSelected] = useState<TransactionView>();

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" eyebrow="Simulated funds" title="Wallet" />

      {wallet.data !== undefined ? (
        <Balances wallet={wallet.data} onAction={setAction} />
      ) : wallet.isError ? (
        <Card padding="none">
          <AccountErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />
        </Card>
      ) : (
        <WalletSkeleton transactions={0} />
      )}

      <p className="type-small flex items-start gap-2 rounded-sm border border-border bg-surface px-3 py-2.5 text-text-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <span>
          BETNG runs on simulated funds. Deposits and withdrawals change a play-money balance on the platform; no payment provider is connected and no real money is involved.
        </span>
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padding="none" className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <SectionHeading as="h2">Recent transactions</SectionHeading>
            <Link to="/transactions" className="type-small rounded-xs font-semibold text-brand hover:underline focus-ring">
              All transactions
            </Link>
          </div>
          {recent.data === undefined ? (
            recent.isError ? (
              <AccountErrorState compact error={recent.error} onRetry={() => void recent.refetch()} />
            ) : (
              <SkeletonRows rows={6} className="p-4" />
            )
          ) : recent.data.items.length === 0 ? (
            <EmptyState compact preset="noTransactions" />
          ) : (
            <ul className="divide-y divide-border">
              {recent.data.items.map((transaction) => (
                <li key={transaction.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(transaction);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="type-body block truncate font-semibold text-text-primary">{transactionDescription(transaction)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2">
                        <TransactionTypeLabel transaction={transaction} />
                        <span className="type-small text-text-muted">{formatDateTime(transaction.createdAt)}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <SignedAmount amount={transaction.amount} />
                      <span className="type-small block tabular text-text-muted">{formatMoney(transaction.balanceAfter)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {recent.data !== undefined && recent.data.items.length > 0 && <PageBreakdown items={recent.data.items} />}
      </div>

      <WalletActionDialog
        action={action}
        available={wallet.data?.available}
        onClose={() => {
          setAction(undefined);
        }}
      />
      <TransactionDetailDialog
        transaction={selected}
        onClose={() => {
          setSelected(undefined);
        }}
      />
    </div>
  );
}
