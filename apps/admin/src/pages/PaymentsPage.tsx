import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CircleAlert, Clock, Wallet, X } from "lucide-react";
import { paymentProviderSchema, paymentStatusSchema, type AdminPayment, type WithdrawalReview } from "@betng/contracts";
import { formatDateTime, formatMoney, formatMoneyCompact, formatRelative } from "@betng/ui-core";
import { Button, Drawer, Input, Panel, SectionHeading, type Column } from "@betng/ui-web";
import { AdminListTable } from "../components/AdminListTable";
import { DetailItem, Mono, Stamp, Status } from "../components/Bits";
import { AuditNote, ProviderStatus, ServiceNotDeployed, isNotImplemented } from "../components/ComplianceBits";
import { ExportControl } from "../components/ExportControl";
import { GuardedButton } from "../components/Guard";
import { MetricCard, metricFrom } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { usePaymentOverview, usePayments } from "../hooks/compliance";
import { useAdminAction } from "../hooks/queries";
import { ANY } from "../hooks/useAdminList";
import { downloadCsv } from "../lib/csv";
import { DASH, dayKey, formatCount, humanise } from "../lib/format";
import { compliance } from "../services/runtime";

const COLUMNS: readonly Column<AdminPayment>[] = [
  { key: "reference", header: "Reference", hideable: false, cell: (p) => <Mono className="text-text-primary">{p.reference}</Mono> },
  {
    key: "direction",
    header: "Direction",
    cell: (p) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-secondary">
        {p.direction === "DEPOSIT" ? <ArrowDownLeft className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
        {humanise(p.direction)}
      </span>
    ),
  },
  { key: "status", header: "Status", cell: (p) => <Status value={p.status} /> },
  { key: "amount", header: "Amount", numeric: true, cell: (p) => <span className="type-financial">{formatMoney(p.amount)}</span> },
  { key: "customer", header: "Customer", cell: (p) => <span className="block max-w-56 truncate text-text-secondary">{p.userEmail}</span>, hideBelow: "lg" },
  { key: "provider", header: "Provider", cell: (p) => (p.provider === undefined ? DASH : humanise(p.provider)), hideBelow: "lg" },
  { key: "method", header: "Method", cell: (p) => (p.method === undefined ? DASH : humanise(p.method)), hideBelow: "xl", defaultHidden: true },
  { key: "createdAt", header: "Created", cell: (p) => <Stamp iso={p.createdAt} /> },
];

const reviewable = (p: AdminPayment): boolean => p.direction === "WITHDRAWAL" && p.status === "PENDING";

function Overview(): React.JSX.Element {
  const overview = usePaymentOverview();
  const o = overview.data;

  return (
    <section aria-labelledby="payments-overview" className="mb-6 space-y-3">
      <SectionHeading id="payments-overview">Today</SectionHeading>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Deposits today" icon={<ArrowDownLeft aria-hidden />} state={metricFrom(overview, (d) => formatMoneyCompact(d.depositsToday))} hint="Confirmed by the provider" />
        <MetricCard label="Withdrawals today" icon={<ArrowUpRight aria-hidden />} state={metricFrom(overview, (d) => formatMoneyCompact(d.withdrawalsToday))} hint="Confirmed by the provider" />
        <MetricCard label="Pending deposits" icon={<Clock aria-hidden />} state={metricFrom(overview, (d) => formatCount(d.pendingDeposits))} />
        <MetricCard label="Pending withdrawals" icon={<Wallet aria-hidden />} state={metricFrom(overview, (d) => formatCount(d.pendingWithdrawals))} hint="Awaiting operator review" />
        <MetricCard label="Failed today" icon={<CircleAlert aria-hidden />} state={metricFrom(overview, (d) => formatCount(d.failedToday))} />
      </div>
      {o !== undefined && (
        <Panel title="Providers" description="Reachability as the payments service last checked it" flush>
          {o.providers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">No data available. The platform reports no providers.</p>
          ) : (
            <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {o.providers.map((provider) => (
                <li key={provider.provider} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium text-text-primary">{humanise(provider.provider)}</span>
                    <span className="block text-sm text-text-muted" title={formatDateTime(provider.checkedAt)}>
                      Checked {formatRelative(provider.checkedAt)}
                    </span>
                  </span>
                  <ProviderStatus status={provider.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </section>
  );
}

export function PaymentsPage(): React.JSX.Element {
  const list = usePayments();
  const [selectedRef, setSelectedRef] = useState<string | undefined>();
  const selected = list.query.data?.items.find((p) => p.reference === selectedRef);
  const { ask, dialog } = useReasonAction();
  const decide = useAdminAction({
    run: (input: { readonly reference: string; readonly review: WithdrawalReview }) => compliance.reviewWithdrawal(input.reference, input.review),
    success: (payment) => `${payment.reference}: ${humanise(payment.status)}`,
  });
  const f = list.state.filters;
  const pendingOnly = f["direction"] === "WITHDRAWAL" && f["status"] === "PENDING";

  const askReview = (payment: AdminPayment, decision: WithdrawalReview["decision"]): void => {
    ask({
      title: decision === "APPROVE" ? `Approve withdrawal ${payment.reference}?` : `Reject withdrawal ${payment.reference}?`,
      description:
        decision === "APPROVE"
          ? `${formatMoney(payment.amount)} to ${payment.userEmail}. The payments service sends it to the provider; the ledger moves only when the provider confirms.`
          : `${formatMoney(payment.amount)} for ${payment.userEmail}. The withdrawal is cancelled and the reserved funds return to the customer's wallet.`,
      confirmLabel: decision === "APPROVE" ? "Approve withdrawal" : "Reject withdrawal",
      tone: decision === "APPROVE" ? "primary" : "danger",
      details: <AuditNote>Your decision and reason are recorded in the platform's audit log.</AuditNote>,
      run: (reason) => decide.mutateAsync({ reference: payment.reference, review: { decision, reason: reason.trim().slice(0, 300) } }),
    });
  };

  const reviewButtons = (payment: AdminPayment, size: "sm" | "md" = "sm"): React.JSX.Element => (
    <span className="flex gap-1.5">
      <GuardedButton permission="payments:write" size={size} variant="secondary" leadingIcon={<Check className="size-3.5" aria-hidden />} onClick={() => askReview(payment, "APPROVE")}>
        Approve
      </GuardedButton>
      <GuardedButton permission="payments:write" size={size} variant="danger" leadingIcon={<X className="size-3.5" aria-hidden />} onClick={() => askReview(payment, "REJECT")}>
        Reject
      </GuardedButton>
    </span>
  );

  const exportPage = (): void => {
    downloadCsv(
      `betng-payments-page${String(list.state.page)}-${dayKey(0)}.csv`,
      ["reference", "direction", "status", "amount_minor", "fee_minor", "currency", "provider", "method", "customer_email", "created_at", "completed_at"],
      (list.query.data?.items ?? []).map((p) => [p.reference, p.direction, p.status, p.amount, p.fee ?? "", p.currency, p.provider ?? "", p.method ?? "", p.userEmail, p.createdAt, p.completedAt ?? ""]),
    );
  };

  return (
    <>
      <PageHeader title="Payments" description="Deposits and withdrawals as the payments service records them. Providers are called by the platform only; nothing here moves money directly." />
      {isNotImplemented(list.query.error) ? (
        <>
          <Overview />
          <ServiceNotDeployed what="payment monitoring" />
        </>
      ) : (
        <>
          <Overview />
          <Panel flush>
            <AdminListTable
              list={list}
              caption="Payments"
              noun="payments"
              columns={COLUMNS}
              rowKey={(p) => p.reference}
              search={{ label: "Search payments by reference or customer email", placeholder: "Reference or email" }}
              toolbarStart={
                <Button
                  variant={pendingOnly ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={pendingOnly}
                  onClick={() => {
                    list.setFilters({ direction: pendingOnly ? ANY : "WITHDRAWAL", status: pendingOnly ? ANY : "PENDING" });
                  }}
                >
                  Pending withdrawals
                </Button>
              }
              toolbarEnd={
                <>
                  <Input aria-label="From date" type="date" value={f["from"] ?? ""} {...(f["to"] === undefined ? {} : { max: f["to"] })} onChange={(event) => list.setFilter("from", event.target.value)} className="w-36 [&>div]:h-8" />
                  <Input aria-label="To date" type="date" value={f["to"] ?? ""} {...(f["from"] === undefined ? {} : { min: f["from"] })} onChange={(event) => list.setFilter("to", event.target.value)} className="w-36 [&>div]:h-8" />
                  <ExportControl scope="this page" rowCount={list.query.data?.items.length ?? 0} onExport={exportPage} />
                </>
              }
              filters={[
                { key: "direction", label: "Direction", anyLabel: "All directions", options: [{ value: "DEPOSIT", label: "Deposits" }, { value: "WITHDRAWAL", label: "Withdrawals" }] },
                { key: "status", label: "Status", anyLabel: "All statuses", options: paymentStatusSchema.options.map((s) => ({ value: s, label: humanise(s) })) },
                { key: "provider", label: "Provider", anyLabel: "All providers", options: paymentProviderSchema.options.map((p) => ({ value: p, label: humanise(p) })) },
              ]}
              onRowClick={(p) => setSelectedRef(p.reference)}
              selectedKey={selectedRef}
              rowActions={(p) => (reviewable(p) ? reviewButtons(p) : null)}
              renderCard={(p) => (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <Mono className="text-text-primary">{p.reference}</Mono>
                    <Status value={p.status} />
                  </div>
                  <div className="flex items-baseline justify-between text-sm text-text-secondary">
                    <span>{humanise(p.direction)}</span>
                    <span className="type-financial text-text-primary">{formatMoney(p.amount)}</span>
                  </div>
                </div>
              )}
            />
          </Panel>
        </>
      )}

      <Drawer open={selected !== undefined} onClose={() => setSelectedRef(undefined)} title={selected?.reference ?? ""} description={selected === undefined ? "" : `${humanise(selected.direction)} · ${formatDateTime(selected.createdAt)}`} footer={selected !== undefined && reviewable(selected) ? reviewButtons(selected, "md") : undefined}>
        {selected !== undefined && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailItem label="Status">
              <Status value={selected.status} />
            </DetailItem>
            <DetailItem label="Amount">
              <span className="type-financial">{formatMoney(selected.amount)}</span>
            </DetailItem>
            <DetailItem label="Fee">{selected.fee === undefined ? DASH : formatMoney(selected.fee)}</DetailItem>
            <DetailItem label="Net">{selected.netAmount === undefined ? DASH : formatMoney(selected.netAmount)}</DetailItem>
            <DetailItem label="Provider">{selected.provider === undefined ? DASH : humanise(selected.provider)}</DetailItem>
            <DetailItem label="Method">{selected.method === undefined ? DASH : humanise(selected.method)}</DetailItem>
            <DetailItem label="Customer" className="col-span-2">
              {selected.userEmail}
            </DetailItem>
            <DetailItem label="Provider reference" className="col-span-2">
              <Mono className="whitespace-normal break-all">{selected.providerReference ?? DASH}</Mono>
            </DetailItem>
            {selected.failureReason !== undefined && (
              <DetailItem label="Failure reason" className="col-span-2">
                {selected.failureReason}
              </DetailItem>
            )}
            <DetailItem label="Updated">{formatDateTime(selected.updatedAt)}</DetailItem>
            <DetailItem label="Completed">{selected.completedAt === undefined ? DASH : formatDateTime(selected.completedAt)}</DetailItem>
          </dl>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
