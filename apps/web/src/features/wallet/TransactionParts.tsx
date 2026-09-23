import { Link } from "react-router";
import { formatDateTime, formatMoney, formatSignedMoney, type TransactionView } from "@betng/ui-core";
import { Dialog, StatusBadge, cn } from "@betng/ui-web";
import { transactionDescription, transactionTypeMeta } from "./transactionMeta";

export function SignedAmount({ amount, className }: { readonly amount: number; readonly className?: string }): React.JSX.Element {
  return <span className={cn("type-financial whitespace-nowrap", amount > 0 ? "text-success" : "text-text-primary", className)}>{formatSignedMoney(amount)}</span>;
}

export function TransactionTypeLabel({ transaction }: { readonly transaction: TransactionView }): React.JSX.Element {
  const meta = transactionTypeMeta(transaction.type);
  const Icon = meta.icon;

  return (
    <span className="type-small inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-text-secondary">
      <Icon className="size-3.5 text-text-muted" aria-hidden />
      {meta.label}
    </span>
  );
}

export function TransactionCard({ transaction }: { readonly transaction: TransactionView }): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-body truncate font-semibold text-text-primary">{transactionDescription(transaction)}</p>
          <p className="type-small text-text-muted">{formatDateTime(transaction.createdAt)}</p>
        </div>
        <SignedAmount amount={transaction.amount} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <TransactionTypeLabel transaction={transaction} />
          {transaction.status !== undefined && <StatusBadge status={transaction.status} />}
        </span>
        <span className="type-small tabular text-text-muted">Balance {formatMoney(transaction.balanceAfter)}</span>
      </div>
    </div>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="type-small shrink-0 text-text-secondary">{label}</dt>
      <dd className="type-data min-w-0 text-right text-text-primary">{children}</dd>
    </div>
  );
}

export function TransactionDetailDialog({ transaction, onClose }: { readonly transaction: TransactionView | undefined; readonly onClose: () => void }): React.JSX.Element {
  return (
    <Dialog open={transaction !== undefined} onClose={onClose} title="Transaction" size="sm">
      {transaction !== undefined && (
        <div>
          <p className="type-caption">{transactionTypeMeta(transaction.type).label}</p>
          <p className={cn("type-financial mt-1 text-left text-2xl", transaction.amount > 0 ? "text-success" : "text-text-primary")}>{formatSignedMoney(transaction.amount)}</p>
          <p className="type-body mt-1 text-text-secondary">{transactionDescription(transaction)}</p>
          <dl className="mt-4 divide-y divide-border border-y border-border">
            <Row label="Date">{formatDateTime(transaction.createdAt)}</Row>
            {transaction.status !== undefined && (
              <Row label="Status">
                <StatusBadge status={transaction.status} />
              </Row>
            )}
            <Row label="Balance after">{formatMoney(transaction.balanceAfter)}</Row>
            {transaction.reference !== undefined && (
              <Row label="Reference">
                <span className="break-all font-mono">{transaction.reference}</span>
              </Row>
            )}
            <Row label="Transaction ID">
              <span className="break-all font-mono">{transaction.id}</span>
            </Row>
            {transaction.betId !== undefined && (
              <Row label="Ticket">
                <Link to={`/tickets/${transaction.betId}`} onClick={onClose} className="rounded-xs font-semibold text-brand hover:underline focus-ring">
                  View ticket
                </Link>
              </Row>
            )}
          </dl>
          <p className="type-small mt-3 text-text-muted">Every entry is a record of an authoritative platform transaction.</p>
        </div>
      )}
    </Dialog>
  );
}
