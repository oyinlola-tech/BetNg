import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { X } from "lucide-react";
import type { PaymentDirection, PaymentHistoryQuery, PaymentRecord, PaymentStatus } from "@betng/contracts";
import { formatDateTime, formatMoney } from "@betng/ui-core";
import { Button, Card, DataTable, SectionHeader, Select, type Column } from "@betng/ui-web";
import { DIRECTION_LABEL, METHOD_META, PAYMENT_DIRECTIONS, PAYMENT_STATUSES, paymentPath } from "../features/payments/paymentMeta";
import { usePaymentHistory } from "../features/payments/paymentQueries";
import { PaymentStatusBadge, paymentStatusLabel } from "../features/payments/PaymentStatusBadge";
import { FlagGuard, ServiceError } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";
import { useAccountSignals } from "../hooks/accountQueries";
import { positiveInt, useUrlState } from "../lib/urlState";

const PAGE_SIZE = 20;

const COLUMNS: readonly Column<PaymentRecord>[] = [
  { key: "createdAt", header: "Date", hideable: false, cell: (p) => <span className="type-small whitespace-nowrap text-text-secondary">{formatDateTime(p.createdAt)}</span> },
  {
    key: "reference",
    header: "Reference",
    cell: (p) => (
      <Link to={paymentPath(p.reference, p.direction)} className="rounded-xs font-mono text-sm text-brand hover:underline focus-ring" onClick={(event) => event.stopPropagation()}>
        {p.reference}
      </Link>
    ),
  },
  { key: "direction", header: "Type", cell: (p) => <span className="type-body text-text-primary">{DIRECTION_LABEL[p.direction]}</span> },
  { key: "method", header: "Method", hideBelow: "lg", cell: (p) => <span className="type-small text-text-secondary">{p.method === undefined ? "–" : METHOD_META[p.method].label}</span> },
  { key: "amount", header: "Amount", numeric: true, hideable: false, cell: (p) => <span className="type-financial text-text-primary">{formatMoney(p.amount)}</span> },
  { key: "status", header: "Status", hideable: false, cell: (p) => <PaymentStatusBadge status={p.status} /> },
];

function PaymentCard({ payment }: { readonly payment: PaymentRecord }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="type-body font-semibold text-text-primary">{DIRECTION_LABEL[payment.direction]}</p>
        <p className="type-small truncate font-mono text-text-muted">{payment.reference}</p>
        <p className="type-small text-text-muted">{formatDateTime(payment.createdAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="type-financial text-text-primary">{formatMoney(payment.amount)}</span>
        <PaymentStatusBadge status={payment.status} />
      </div>
    </div>
  );
}

function History(): React.JSX.Element {
  useAccountSignals();

  const navigate = useNavigate();
  const [params, patch] = useUrlState();
  const direction = PAYMENT_DIRECTIONS.find((value) => value === params.get("direction")?.toUpperCase());
  const status = PAYMENT_STATUSES.find((value) => value === params.get("status")?.toUpperCase());
  const page = positiveInt(params.get("page")) ?? 1;
  const query = useMemo<PaymentHistoryQuery>(
    () => ({ page, pageSize: PAGE_SIZE, ...(direction === undefined ? {} : { direction }), ...(status === undefined ? {} : { status }) }),
    [page, direction, status],
  );
  const history = usePaymentHistory(query);
  const filtered = direction !== undefined || status !== undefined;

  const toolbar = (
    <>
      <Select<PaymentDirection | "ALL">
        label="Filter by type"
        size="sm"
        value={direction ?? "ALL"}
        onChange={(value) => {
          patch({ direction: value === "ALL" ? undefined : value.toLowerCase(), page: undefined });
        }}
        options={[{ value: "ALL", label: "All types" }, ...PAYMENT_DIRECTIONS.map((value) => ({ value, label: `${DIRECTION_LABEL[value]}s` }))]}
      />
      <Select<PaymentStatus | "ALL">
        label="Filter by status"
        size="sm"
        value={status ?? "ALL"}
        onChange={(value) => {
          patch({ status: value === "ALL" ? undefined : value.toLowerCase(), page: undefined });
        }}
        options={[{ value: "ALL", label: "All statuses" }, ...PAYMENT_STATUSES.map((value) => ({ value, label: paymentStatusLabel(value) }))]}
      />
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<X className="size-3.5" aria-hidden />}
          onClick={() => {
            patch({ direction: undefined, status: undefined, page: undefined });
          }}
        >
          Clear filters
        </Button>
      )}
    </>
  );

  if (history.isError && history.data === undefined) {
    return (
      <Card padding="none">
        <ServiceError error={history.error} onRetry={() => void history.refetch()} />
      </Card>
    );
  }

  return (
    <Card padding="none">
      <DataTable
        caption="Payments"
        columns={COLUMNS}
        rows={history.data?.items}
        rowKey={(p) => p.reference}
        loading={history.isPending}
        toolbar={toolbar}
        density="comfortable"
        onRowClick={(p) => {
          void navigate(paymentPath(p.reference, p.direction));
        }}
        renderCard={(p) => <PaymentCard payment={p} />}
        skeletonRows={8}
        empty={
          filtered
            ? { title: "No payments match these filters", description: "Change or clear the filters to see more." }
            : { title: "No payments yet", description: "Deposits and withdrawals through a payment provider are listed here." }
        }
        {...(history.data === undefined
          ? {}
          : {
              pagination: {
                page: history.data.page,
                pageSize: history.data.pageSize,
                total: history.data.total,
                onPage: (next: number) => {
                  patch({ page: next === 1 ? undefined : next });
                },
              },
            })}
      />
    </Card>
  );
}

export function PaymentsPage(): React.JSX.Element {
  usePageMeta({ title: "Payments", noindex: true });

  return (
    <div className="space-y-5">
      <SectionHeader as="h1" eyebrow="Wallet" title="Payments" to="/wallet" linkLabel="Wallet" />
      <FlagGuard flag="paymentsEnabled" title="Payments are not available yet" description="Deposits and withdrawals through a payment provider are not switched on for BETNG yet.">
        <History />
      </FlagGuard>
    </div>
  );
}
