import type { PaymentRecord } from "@betng/contracts";
import { formatDateTime, formatMoney } from "@betng/ui-core";
import { Card, cn } from "@betng/ui-web";
import { DIRECTION_LABEL, METHOD_META } from "./paymentMeta";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="type-small text-text-muted">{label}</dt>
      <dd className="type-body min-w-0 text-right text-text-primary">{children}</dd>
    </div>
  );
}

export interface PaymentStatusCardProps {
  readonly payment: PaymentRecord;
  readonly bankAccountLabel?: string | undefined;
  readonly footer?: React.ReactNode;
  readonly className?: string;
}

/** A payment exactly as the platform last reported it. */
export function PaymentStatusCard({ payment, bankAccountLabel, footer, className }: PaymentStatusCardProps): React.JSX.Element {
  return (
    <Card padding="none" className={cn("overflow-hidden", className)} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 md:p-5">
        <div className="min-w-0">
          <p className="type-caption">{DIRECTION_LABEL[payment.direction]}</p>
          <p className="type-financial mt-1 text-left text-3xl leading-none text-text-primary" data-testid="payment-amount">
            {formatMoney(payment.amount)}
          </p>
        </div>
        <PaymentStatusBadge status={payment.status} className="text-base" />
      </div>
      {payment.failureReason !== undefined && (payment.status === "FAILED" || payment.status === "EXPIRED" || payment.status === "CANCELLED" || payment.status === "REVERSED") && (
        <p className="type-small mx-4 mb-3 rounded-sm border border-border bg-surface-sunken px-3 py-2 text-text-secondary md:mx-5">{payment.failureReason}</p>
      )}
      <dl className="divide-y divide-border border-t border-border px-4 md:px-5">
        <Row label="Reference">
          <span className="font-mono text-sm select-all">{payment.reference}</span>
        </Row>
        {payment.method !== undefined && <Row label="Method">{METHOD_META[payment.method].label}</Row>}
        {bankAccountLabel !== undefined && <Row label="Bank account">{bankAccountLabel}</Row>}
        {payment.fee !== undefined && <Row label="Fee">{<span className="type-financial">{formatMoney(payment.fee)}</span>}</Row>}
        {payment.netAmount !== undefined && (
          <Row label={payment.direction === "WITHDRAWAL" ? "You receive" : "Net amount"}>
            <span className="type-financial">{formatMoney(payment.netAmount)}</span>
          </Row>
        )}
        <Row label="Started">{formatDateTime(payment.createdAt)}</Row>
        <Row label="Last updated">{formatDateTime(payment.updatedAt)}</Row>
        {payment.completedAt !== undefined && <Row label="Finished">{formatDateTime(payment.completedAt)}</Row>}
      </dl>
      {footer !== undefined && <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-sunken px-4 py-3 md:px-5">{footer}</div>}
    </Card>
  );
}
