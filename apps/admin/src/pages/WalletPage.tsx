import { useState } from "react";
import { Lock } from "lucide-react";
import type { CommissionSummary, OperatorSummary, PlatformLedgerEntry } from "@betng/contracts";
import { formatDateTime, formatMoney, formatMoneyCompact, formatSignedMoney } from "@betng/ui-core";
import { DataTable, EmptyState, ErrorState, Panel, SectionHeading, Select, SkeletonRows, WalletSkeleton, emptyPresets, type Column } from "@betng/ui-web";
import { DetailItem, Mono, SignedMoney, Stamp, Status } from "../components/Bits";
import { CommissionForm } from "../components/CommissionForm";
import { GuardedButton } from "../components/Guard";
import { MetricCard, metricFrom } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction, useCommission, useCommissionConfig, useOperatorLedger, useOperatorPeriods, useShopDirectory, useWalletOverview } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { formatCount, formatPercent, formatStamp, humanise } from "../lib/format";
import { keys } from "../lib/queryKeys";
import { adminSource } from "../services/runtime";

const ENTRY_COLUMNS: readonly Column<PlatformLedgerEntry>[] = [
  { key: "createdAt", header: "Time", cell: (e) => <Stamp iso={e.createdAt} /> },
  { key: "type", header: "Type", cell: (e) => <span className="text-sm font-medium text-text-secondary">{humanise(e.type)}</span> },
  { key: "owner", header: "Account", cell: (e) => <span className="whitespace-nowrap">{e.owner.replace(/^(user|shop):/, "")}</span> },
  { key: "reference", header: "Reference", cell: (e) => <Mono>{e.reference ?? "—"}</Mono>, hideBelow: "lg" },
  { key: "id", header: "Entry", cell: (e) => <Mono>{e.id}</Mono>, hideBelow: "xl" },
  { key: "amount", header: "Amount", numeric: true, cell: (e) => <span className="type-financial">{formatSignedMoney(e.amount)}</span> },
];

function Entries({ caption, entries, loading, error, onRetry }: { readonly caption: string; readonly entries: readonly PlatformLedgerEntry[] | undefined; readonly loading: boolean; readonly error: unknown; readonly onRetry: () => void }): React.JSX.Element {
  return (
    <DataTable
      caption={caption}
      columns={ENTRY_COLUMNS}
      rows={entries}
      rowKey={(e) => e.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      pageSize={10}
      empty={{ title: emptyPresets.noTransactions.title, description: "The platform lists no recent movements here." }}
      renderCard={(e) => (
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium">{e.owner.replace(/^(user|shop):/, "")}</span>
            <span className="block text-sm text-text-muted">
              {humanise(e.type)} · {formatDateTime(e.createdAt)}
            </span>
          </span>
          <span className="type-financial">{formatSignedMoney(e.amount)}</span>
        </div>
      )}
    />
  );
}

function Locked({ permission }: { readonly permission: string }): React.JSX.Element {
  return <EmptyState compact icon={<Lock className="size-5" />} title="Not included in your role" description={`This ledger needs the “${permission}” permission.`} />;
}

const PERIOD_COLUMNS: readonly Column<OperatorSummary>[] = [
  { key: "period", header: "Period", cell: (s) => <Mono className="text-text-primary">{s.period.id}</Mono> },
  { key: "kind", header: "Kind", cell: (s) => <span className="text-text-secondary">{humanise(s.period.kind)}</span>, hideBelow: "lg" },
  { key: "endsAt", header: "Closed at", cell: (s) => <Stamp iso={s.period.endsAt} />, hideBelow: "lg" },
  { key: "settledBets", header: "Settled bets", numeric: true, cell: (s) => formatCount(s.settledBets), hideBelow: "xl" },
  { key: "grossStakes", header: "Gross stakes", numeric: true, cell: (s) => formatMoney(s.grossStakes) },
  { key: "grossPayouts", header: "Gross payouts", numeric: true, cell: (s) => formatMoney(s.grossPayouts) },
  { key: "operatorResult", header: "Operator result", numeric: true, cell: (s) => <SignedMoney value={s.operatorResult} className="type-financial" /> },
  { key: "rate", header: "Rate", numeric: true, cell: (s) => formatPercent(s.operatorResultRate), hideBelow: "lg" },
];

const COMMISSION_COLUMNS: readonly Column<CommissionSummary>[] = [
  { key: "shop", header: "Shop", cell: (c) => <span className="whitespace-nowrap font-medium">{c.shopName ?? c.shopId.slice(0, 8)}</span> },
  { key: "grossStakes", header: "Gross stakes", numeric: true, cell: (c) => formatMoney(c.grossStakes), hideBelow: "lg" },
  { key: "grossPayouts", header: "Gross payouts", numeric: true, cell: (c) => formatMoney(c.grossPayouts), hideBelow: "lg" },
  { key: "result", header: "Gross operator result", numeric: true, cell: (c) => <SignedMoney value={c.grossOperatorResult} /> },
  { key: "share", header: "Shop share", numeric: true, cell: (c) => `${String(c.shopSharePercent)}%` },
  { key: "shopAmount", header: "Shop amount", numeric: true, cell: (c) => <span className="type-financial">{formatMoney(c.shopShareAmount)}</span> },
  { key: "platformAmount", header: "Platform amount", numeric: true, cell: (c) => <SignedMoney value={c.platformShareAmount} className="type-financial" />, hideBelow: "xl" },
];

function OperatorLedgerSection(): React.JSX.Element {
  const ledger = useOperatorLedger();
  const { ask, dialog } = useReasonAction();
  const close = useAdminAction({ run: (reason: string) => adminSource.closeOperatorPeriod(reason), success: (summary) => `Period ${summary.period.id} closed`, invalidate: [keys.operatorLedger, keys.operatorPeriods, ["admin", "commission"]] });
  const current = ledger.data?.current;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Gross stakes" state={metricFrom(ledger, (d) => formatMoneyCompact(d.current.grossStakes))} hint="Current period" />
        <MetricCard label="Gross payouts" state={metricFrom(ledger, (d) => formatMoneyCompact(d.current.grossPayouts))} hint="Current period" />
        <MetricCard label="Operator result" state={metricFrom(ledger, (d) => <SignedMoney value={d.current.operatorResult} whole />)} hint="Gross stakes less gross payouts" />
        <MetricCard label="Operator result rate" state={metricFrom(ledger, (d) => formatPercent(d.current.operatorResultRate))} hint="Of gross stakes" />
        <MetricCard label="Refunded stakes" state={metricFrom(ledger, (d) => formatMoneyCompact(d.current.refundedStakes))} hint="On void bets" />
      </div>
      <Panel
        title="Current period"
        actions={
          <GuardedButton
            permission="settlement:operate"
            size="sm"
            variant="danger"
            blockedReason={current === undefined ? "No open period" : undefined}
            onClick={() =>
              ask({
                title: "Close the current period?",
                description: `${current?.period.id ?? "The open period"} is closed with the figures the platform holds now and a new period opens. Commission for the period is calculated from it. A closed period cannot be reopened.`,
                confirmLabel: "Close period",
                tone: "danger",
                run: (reason) => close.mutateAsync(reason),
              })
            }
          >
            Close period
          </GuardedButton>
        }
      >
        {current === undefined ? (
          ledger.error !== null ? (
            <ErrorState error={ledger.error} compact onRetry={() => void ledger.refetch()} />
          ) : (
            <SkeletonRows rows={2} />
          )
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <DetailItem label="Period">
              <Mono className="text-text-primary">{current.period.id}</Mono>
            </DetailItem>
            <DetailItem label="Status">
              <Status value={current.period.status} />
            </DetailItem>
            <DetailItem label="Kind">{humanise(current.period.kind)}</DetailItem>
            <DetailItem label="Opened">{formatDateTime(current.period.startsAt)}</DetailItem>
            <DetailItem label="Settled bets">{formatCount(current.settledBets)}</DetailItem>
            <DetailItem label="Void bets">{formatCount(current.voidBets)}</DetailItem>
          </dl>
        )}
      </Panel>
      <Panel title="Closed periods" flush>
        <DataTable
          caption="Closed operator periods"
          columns={PERIOD_COLUMNS}
          rows={ledger.data?.closed}
          rowKey={(s) => s.period.id}
          loading={ledger.isPending}
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
          pageSize={8}
          empty={{ title: "No closed periods", description: "Closed periods appear here with the figures they were closed on." }}
          renderCard={(s) => (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <Mono className="text-text-primary">{s.period.id}</Mono>
                <span className="block text-sm text-text-muted">{formatStamp(s.period.endsAt)}</span>
              </span>
              <SignedMoney value={s.operatorResult} className="type-financial" />
            </div>
          )}
        />
      </Panel>
      {dialog}
    </>
  );
}

function CommissionSection(): React.JSX.Element {
  const { can } = useAdmin();
  const periods = useOperatorPeriods();
  const [periodId, setPeriodId] = useState("current");
  const commission = useCommission(periodId === "current" ? undefined : periodId);
  const config = useCommissionConfig();
  const shops = useShopDirectory(can("shops:read"));
  const shopCode = (id: string | undefined): string => (id === undefined ? "Platform default" : (shops.data?.find((s) => s.id === id)?.code ?? id.slice(0, 8)));

  return (
    <>
      <Panel
        title="Commission by shop"
        description="The shop's share of the gross operator result, as the platform calculated it"
        flush
        actions={<Select label="Period" size="sm" value={periodId} onChange={setPeriodId} options={[{ value: "current", label: "Current period" }, ...(periods.data ?? []).filter((p) => p.status === "CLOSED").map((p) => ({ value: p.id, label: p.id }))]} />}
      >
        <DataTable
          caption="Commission by shop"
          columns={COMMISSION_COLUMNS}
          rows={commission.data}
          rowKey={(c) => `${c.periodId}:${c.shopId}`}
          loading={commission.isPending}
          error={commission.error}
          onRetry={() => void commission.refetch()}
          pageSize={10}
          empty={{ title: "No commission rows", description: "The platform lists no shop commission for this period." }}
          renderCard={(c) => (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.shopName ?? c.shopId.slice(0, 8)}</span>
                <span className="block text-sm text-text-muted">{String(c.shopSharePercent)}% share</span>
              </span>
              <span className="type-financial">{formatMoney(c.shopShareAmount)}</span>
            </div>
          )}
        />
      </Panel>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Commission configuration">
          {config.data === undefined ? (
            config.error !== null ? (
              <ErrorState error={config.error} compact onRetry={() => void config.refetch()} />
            ) : (
              <SkeletonRows rows={3} />
            )
          ) : (
            <ul className="divide-y divide-border">
              {[config.data.default, ...config.data.shops].map((entry) => (
                <li key={entry.shopId ?? "default"} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{shopCode(entry.shopId)}</span>
                    <span className="block text-sm text-text-muted">
                      From {formatDateTime(entry.effectiveFrom)}
                      {entry.updatedBy === undefined ? "" : ` · ${entry.updatedBy}`}
                    </span>
                  </span>
                  <span className="type-financial">{String(entry.shopSharePercent)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Change a share" description="Needs “settlement:operate”, a reason and a confirmation">
          {can("settlement:operate") ? <CommissionForm shops={shops.data ?? []} /> : <Locked permission="settlement:operate" />}
        </Panel>
      </div>
    </>
  );
}

export function WalletPage(): React.JSX.Element {
  const { can } = useAdmin();
  const wallet = useWalletOverview();
  const w = wallet.data;
  const ledgerGranted = can("settlement:read");

  if (w === undefined && wallet.error === null) return <WalletSkeleton />;

  return (
    <>
      <PageHeader title="Wallet and ledgers" description="Three separate books. Customer wallets and shop floats hold other people's money; the operator ledger is the platform's own result. All are read from the platform and none can be edited here." />
      <div className="space-y-10">
        <section aria-labelledby="ledger-customers" className="space-y-4">
          <SectionHeading id="ledger-customers">Customer wallets</SectionHeading>
          <p className="-mt-2 text-sm text-text-muted">Money customers hold with the platform on web and mobile.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Customer balances" state={metricFrom(wallet, (d) => formatMoneyCompact(d.customerBalances))} hint="All customer wallets" />
            <MetricCard label="Reserved" state={metricFrom(wallet, (d) => formatMoneyCompact(d.reserved))} hint="Held against open bets" />
            <MetricCard label="Deposits today" state={metricFrom(wallet, (d) => formatMoneyCompact(d.todayDeposits))} />
            <MetricCard label="Withdrawals today" state={metricFrom(wallet, (d) => formatMoneyCompact(d.todayWithdrawals))} />
          </div>
          <Panel title="Recent customer wallet movements" flush>
            <Entries caption="Customer wallet movements" entries={w?.entries.filter((e) => e.channel === "ONLINE")} loading={wallet.isPending} error={wallet.error} onRetry={() => void wallet.refetch()} />
          </Panel>
        </section>

        <section aria-labelledby="ledger-shops" className="space-y-4">
          <SectionHeading id="ledger-shops">Shop ledger</SectionHeading>
          <p className="-mt-2 text-sm text-text-muted">Floats the shops hold for over-the-counter sales and payouts, and the commission they earn.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Shop floats" state={metricFrom(wallet, (d) => formatMoneyCompact(d.shopFloats))} hint="All shops" />
          </div>
          <Panel title="Recent shop ledger movements" flush>
            <Entries caption="Shop ledger movements" entries={w?.entries.filter((e) => e.channel === "SHOP")} loading={wallet.isPending} error={wallet.error} onRetry={() => void wallet.refetch()} />
          </Panel>
          {ledgerGranted ? <CommissionSection /> : <Panel><Locked permission="settlement:read" /></Panel>}
        </section>

        <section aria-labelledby="ledger-operator" className="space-y-4">
          <SectionHeading id="ledger-operator">Platform and operator ledger</SectionHeading>
          <p className="-mt-2 text-sm text-text-muted">The platform's own book for each reporting period. The result may be negative and is shown as recorded. The operator takes no bets and holds no customer wallet.</p>
          {ledgerGranted ? <OperatorLedgerSection /> : <Panel><Locked permission="settlement:read" /></Panel>}
        </section>
      </div>
    </>
  );
}
