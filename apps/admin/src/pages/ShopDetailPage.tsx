import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Pencil, Plus } from "lucide-react";
import { formatMoney, formatRelative, formatShortDate } from "@betng/ui-core";
import { AdminSkeleton, EmptyState, ErrorState, KpiCard, Panel, RankedBars, SkeletonRows, Tabs } from "@betng/ui-web";
import { AccountAnalysisPanel } from "../components/AccountAnalysisPanel";
import { DetailItem, Mono, Status } from "../components/Bits";
import { CashierList, CreateCashierDrawer } from "../components/CashierList";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { ShopFormDrawer } from "../components/ShopFormDrawer";
import { useAccountAnalysis, useShop, useTopCashiers } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { formatCount } from "../lib/format";
import { shopStatusPrompt, useShopStatusAction } from "./ShopsPage";

const TABS = ["overview", "cashiers", "reports"] as const;

type Tab = (typeof TABS)[number];

export function ShopDetailPage(): React.JSX.Element {
  const { shopId } = useParams();
  const { can } = useAdmin();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t === params.get("tab")) ?? "overview";
  const shop = useShop(shopId);
  const reportsGranted = can("reports:read");
  const analysis = useAccountAnalysis(tab === "reports" && reportsGranted ? "shops" : undefined, shopId, {});
  const topCashiers = useTopCashiers(shopId, tab === "reports");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const { ask, dialog } = useReasonAction();
  const setStatus = useShopStatusAction();

  if (shop.data === undefined) return shop.error !== null ? <ErrorState error={shop.error} onRetry={() => void shop.refetch()} /> : <AdminSkeleton kpis={2} rows={4} />;

  const s = shop.data;

  return (
    <>
      <PageHeader
        title={s.name}
        description={s.address}
        actions={
          <>
            <Status value={s.status} />
            <GuardedButton permission="shops:write" variant="secondary" size="sm" leadingIcon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(true)}>
              Edit
            </GuardedButton>
            <GuardedButton permission="shops:write" variant={s.status === "SUSPENDED" ? "primary" : "danger"} size="sm" onClick={() => ask(shopStatusPrompt(s, (status, reason) => setStatus.mutateAsync({ id: s.id, status, reason })))}>
              {s.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </GuardedButton>
          </>
        }
      />
      <Tabs<Tab>
        label="Shop sections"
        className="mb-4"
        value={tab}
        onChange={(next) => setParams(next === "overview" ? {} : { tab: next }, { replace: true })}
        items={[
          { value: "overview", label: "Overview" },
          { value: "cashiers", label: "Cashiers", count: s.cashierCount },
          { value: "reports", label: "Reports" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Shop details" className="lg:col-span-2">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
              <DetailItem label="Shop code">
                <Mono className="text-text-primary">{s.code}</Mono>
              </DetailItem>
              <DetailItem label="Owner">{s.ownerName}</DetailItem>
              <DetailItem label="Phone">{s.phone}</DetailItem>
              <DetailItem label="Email">
                <span className="break-all">{s.email}</span>
              </DetailItem>
              <DetailItem label="Opened">{formatShortDate(s.createdAt)}</DetailItem>
              <DetailItem label="Last active">{s.lastActiveAt === undefined ? "Never" : formatRelative(s.lastActiveAt)}</DetailItem>
            </dl>
          </Panel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <KpiCard label="Float" value={formatMoney(s.balance)} hint="Shop ledger balance" />
            <KpiCard label="Open tickets" value={formatCount(s.openTickets)} hint="Awaiting results" />
          </div>
        </div>
      )}

      {tab === "cashiers" && (
        <Panel
          title="Cashiers"
          flush
          actions={
            <GuardedButton permission="cashiers:write" size="sm" leadingIcon={<Plus className="size-3.5" aria-hidden />} onClick={() => setCreating(true)}>
              New cashier
            </GuardedButton>
          }
        >
          <CashierList shopId={s.id} />
        </Panel>
      )}

      {tab === "reports" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Sales today" value={formatMoney(s.todaySales)} hint="Reported by the platform" />
            <KpiCard label="Payouts today" value={formatMoney(s.todayPayouts)} hint="Reported by the platform" />
            <KpiCard label="Float" value={formatMoney(s.balance)} hint="Shop ledger balance" />
            <KpiCard label="Open tickets" value={formatCount(s.openTickets)} hint="Awaiting results" />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Panel title="Shop analysis" description="The platform's view over all bets taken at this shop" className="lg:col-span-2">
              {reportsGranted ? <AccountAnalysisPanel query={analysis} /> : <EmptyState compact title="Not included in your role" description="Shop analysis needs the “reports:read” permission." />}
            </Panel>
            <Panel title="Sales by cashier" description="Today, highest first">
              {topCashiers.data === undefined ? (
                topCashiers.error !== null ? (
                  <ErrorState error={topCashiers.error} compact onRetry={() => void topCashiers.refetch()} />
                ) : (
                  <SkeletonRows rows={4} />
                )
              ) : topCashiers.data.length === 0 ? (
                <EmptyState compact title="No cashiers" description="This shop has no terminal accounts yet." />
              ) : (
                <RankedBars title="Sales by cashier today" formatValue={formatMoney} items={topCashiers.data.map((c) => ({ key: c.id, label: c.displayName, detail: `${formatCount(c.todayTransactions)} transactions`, value: c.todaySales }))} />
              )}
            </Panel>
          </div>
        </div>
      )}

      <ShopFormDrawer open={editing} onClose={() => setEditing(false)} shop={s} />
      <CreateCashierDrawer shopId={s.id} shopCode={s.code} open={creating} onClose={() => setCreating(false)} />
      {dialog}
    </>
  );
}
