import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import { formatMoney, formatRelative } from "@betng/ui-core";
import { ErrorState, KpiCard, LoadingState, Panel, RankedBars, Tabs } from "@betng/ui-web";
import { Field, Meter, Mono, Status } from "../components/Bits";
import { CashierTable, CreateCashierDrawer } from "../components/CashierTable";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { ShopFormDrawer } from "../components/ShopFormDrawer";
import { useCashiers, useShop } from "../hooks/queries";
import { formatDate } from "../lib/format";
import { useShopStatusAction } from "./ShopsPage";

type Tab = "overview" | "cashiers" | "reports";

export function ShopDetailPage(): React.JSX.Element {
  const { shopId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (["overview", "cashiers", "reports"] as const).find((t) => t === params.get("tab")) ?? "overview";
  const shop = useShop(shopId);
  const cashiers = useCashiers(shopId);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const { ask, dialog } = useReasonAction();
  const setStatus = useShopStatusAction();

  if (shop.data === undefined) return shop.error !== null ? <ErrorState error={shop.error} onRetry={() => void shop.refetch()} /> : <LoadingState label="Loading shop" />;

  const s = shop.data;
  const suspended = s.status === "SUSPENDED";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/shops" className="inline-flex items-center gap-1 rounded-xs hover:text-text-primary focus-ring">
            <ChevronLeft className="size-3.5" /> Shops
          </Link>
        }
        title={s.name}
        description={s.address}
        actions={
          <>
            <Status value={s.status} />
            <GuardedButton permission="shops:write" variant="secondary" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
              Edit
            </GuardedButton>
            <GuardedButton
              permission="shops:write"
              variant={suspended ? "primary" : "danger"}
              size="sm"
              onClick={() =>
                ask({
                  title: suspended ? `Activate ${s.code}?` : `Suspend ${s.code}?`,
                  description: suspended ? "Cashiers will be able to sign in and sell tickets again." : "All cashier sessions end and the shop cannot sell or pay out until reactivated. Open tickets still settle.",
                  confirmLabel: suspended ? "Activate shop" : "Suspend shop",
                  tone: suspended ? "primary" : "danger",
                  run: (reason) => setStatus.mutateAsync({ id: s.id, status: suspended ? "ACTIVE" : "SUSPENDED", reason }),
                })
              }
            >
              {suspended ? "Activate" : "Suspend"}
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
              <Field label="Shop code">
                <Mono className="text-text-primary">{s.code}</Mono>
              </Field>
              <Field label="Owner">{s.ownerName}</Field>
              <Field label="Phone">{s.phone}</Field>
              <Field label="Email">
                <span className="break-all">{s.email}</span>
              </Field>
              <Field label="Opened">{formatDate(s.createdAt)}</Field>
              <Field label="Last active">{s.lastActiveAt === undefined ? "Never" : formatRelative(s.lastActiveAt)}</Field>
            </dl>
          </Panel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <KpiCard label="Float" value={formatMoney(s.balance)} hint="held for payouts" />
            <KpiCard label="Open tickets" value={s.openTickets.toLocaleString()} hint="awaiting results" />
          </div>
        </div>
      )}

      {tab === "cashiers" && (
        <Panel
          title="Cashiers"
          flush
          actions={
            <GuardedButton permission="cashiers:write" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
              New cashier
            </GuardedButton>
          }
        >
          <CashierTable rows={cashiers.data} loading={cashiers.isLoading} error={cashiers.error} onRetry={() => void cashiers.refetch()} />
        </Panel>
      )}

      {tab === "reports" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Today's sales" value={formatMoney(s.todaySales)} hint={`${String(s.cashierCount)} cashiers`} />
            <KpiCard label="Today's payouts" value={formatMoney(s.todayPayouts)} hint={s.todaySales === 0 ? "no sales yet" : `${((s.todayPayouts / s.todaySales) * 100).toFixed(1)}% of sales`} />
            <KpiCard label="Net position" value={formatMoney(s.todaySales - s.todayPayouts)} hint="sales minus payouts" emphasis />
            <KpiCard label="Open tickets" value={s.openTickets.toLocaleString()} hint="awaiting results" />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
          <Panel title="Sales by cashier" description="Today, simulated naira" className="lg:col-span-2">
            <RankedBars
              title="Sales by cashier today"
              formatValue={formatMoney}
              items={[...(cashiers.data ?? [])].sort((a, b) => b.todaySales - a.todaySales).map((c) => ({ key: c.id, label: c.displayName, detail: `${String(c.todayTransactions)} transactions`, value: c.todaySales }))}
            />
          </Panel>
          <Panel title="Float cover" description="Can the float meet today's payouts?">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-display text-lg font-semibold tabular text-text-primary">{formatMoney(s.todayPayouts)}</span>
              <span className="tabular text-text-muted">float {formatMoney(s.balance)}</span>
            </div>
            <Meter value={s.todayPayouts} limit={s.balance} label="Today's payouts against the shop float" />
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Payout ratio">
                <span className="tabular">{s.todaySales === 0 ? "—" : `${((s.todayPayouts / s.todaySales) * 100).toFixed(1)}%`}</span>
              </Field>
              <Field label="Sales per cashier">
                <span className="tabular">{s.cashierCount === 0 ? "—" : formatMoney(Math.round(s.todaySales / s.cashierCount))}</span>
              </Field>
            </dl>
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
