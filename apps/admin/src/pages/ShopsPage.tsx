import { useState } from "react";
import { useNavigate } from "react-router";
import { BarChart3, Eye, MoreHorizontal, Pause, Pencil, Play, Plus, UserSquare } from "lucide-react";
import type { AdminShopSummary } from "@betng/contracts";
import { formatMoney, formatRelative } from "@betng/ui-core";
import { Dropdown, Panel, type Column } from "@betng/ui-web";
import { AdminListTable } from "../components/AdminListTable";
import { Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction, type PendingAction } from "../components/ReasonAction";
import { ShopFormDrawer } from "../components/ShopFormDrawer";
import { useAdminAction } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { useAdminList } from "../hooks/useAdminList";
import { missingPermission } from "../lib/navigation";
import { adminSource } from "../services/runtime";

export function useShopStatusAction() {
  return useAdminAction({
    run: (input: { readonly id: string; readonly status: "ACTIVE" | "SUSPENDED"; readonly reason: string }) => adminSource.setShopStatus(input.id, input.status, input.reason),
    success: (shop) => `${shop.code} is now ${shop.status.toLowerCase()}`,
  });
}

export function shopStatusPrompt(shop: AdminShopSummary, run: (status: "ACTIVE" | "SUSPENDED", reason: string) => Promise<unknown>): PendingAction {
  return shop.status === "SUSPENDED"
    ? { title: `Activate ${shop.code}?`, description: "Cashiers will be able to sign in and sell tickets again.", confirmLabel: "Activate shop", run: (reason) => run("ACTIVE", reason) }
    : {
        title: `Suspend ${shop.code}?`,
        description: "All cashier sessions end and the shop cannot sell or pay out until it is activated again. Open tickets still settle.",
        confirmLabel: "Suspend shop",
        tone: "danger",
        run: (reason) => run("SUSPENDED", reason),
      };
}

const COLUMNS: readonly Column<AdminShopSummary>[] = [
  { key: "code", header: "Shop code", sortable: true, hideable: false, cell: (s) => <Mono className="text-text-primary">{s.code}</Mono> },
  {
    key: "name",
    header: "Shop",
    sortable: true,
    cell: (s) => (
      <span className="block min-w-40">
        <span className="block truncate font-medium">{s.name}</span>
        <span className="block truncate text-sm text-text-muted">{s.address}</span>
      </span>
    ),
  },
  { key: "status", header: "Status", sortable: true, cell: (s) => <Status value={s.status} /> },
  { key: "cashierCount", header: "Cashiers", numeric: true, sortable: true, cell: (s) => s.cashierCount, hideBelow: "lg" },
  { key: "balance", header: "Float", numeric: true, sortable: true, cell: (s) => formatMoney(s.balance), hideBelow: "xl" },
  { key: "todaySales", header: "Sales today", numeric: true, sortable: true, cell: (s) => <span className="type-financial">{formatMoney(s.todaySales)}</span> },
  { key: "todayPayouts", header: "Payouts today", numeric: true, sortable: true, cell: (s) => formatMoney(s.todayPayouts), hideBelow: "lg" },
  { key: "openTickets", header: "Open tickets", numeric: true, sortable: true, cell: (s) => s.openTickets, hideBelow: "xl", defaultHidden: true },
  { key: "lastActiveAt", header: "Last active", sortable: true, cell: (s) => <span className="whitespace-nowrap text-text-secondary">{s.lastActiveAt === undefined ? "Never" : formatRelative(s.lastActiveAt)}</span>, hideBelow: "xl" },
];

export function ShopsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { can } = useAdmin();
  const list = useAdminList("shops", { defaults: { sort: "todaySales", direction: "desc" }, filterKeys: ["status"] });
  const [form, setForm] = useState<{ readonly shop?: AdminShopSummary } | undefined>();
  const { ask, dialog } = useReasonAction();
  const setShopStatus = useShopStatusAction();
  const writable = can("shops:write");

  return (
    <>
      <PageHeader
        title="Shops"
        description="Retail locations selling over the counter. Sales and payouts are the platform's totals for today."
        actions={
          <GuardedButton permission="shops:write" leadingIcon={<Plus className="size-4" aria-hidden />} onClick={() => setForm({})}>
            New shop
          </GuardedButton>
        }
      />
      <Panel flush>
        <AdminListTable
          list={list}
          caption="Shops"
          noun="shops"
          columns={COLUMNS}
          rowKey={(s) => s.id}
          search={{ label: "Search shops by code, name or owner", placeholder: "Search code, name, owner" }}
          filters={[
            {
              key: "status",
              label: "Status",
              anyLabel: "All statuses",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "OFFLINE", label: "Offline" },
              ],
            },
          ]}
          onRowClick={(s) => void navigate(`/shops/${s.id}`)}
          rowActions={(s) => (
            <Dropdown
              label={`Actions for ${s.code}`}
              trigger={
                <span className="flex size-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-hover hover:text-text-primary">
                  <MoreHorizontal className="size-4" aria-hidden />
                </span>
              }
              items={[
                { key: "view", label: "View", icon: <Eye />, onSelect: () => void navigate(`/shops/${s.id}`) },
                { key: "edit", label: "Edit", icon: <Pencil />, disabled: !writable, disabledReason: missingPermission("shops:write"), onSelect: () => setForm({ shop: s }) },
                { key: "cashiers", label: "Cashiers", icon: <UserSquare />, onSelect: () => void navigate(`/shops/${s.id}?tab=cashiers`) },
                { key: "reports", label: "Reports", icon: <BarChart3 />, onSelect: () => void navigate(`/shops/${s.id}?tab=reports`) },
                {
                  key: "status",
                  label: s.status === "SUSPENDED" ? "Activate" : "Suspend",
                  icon: s.status === "SUSPENDED" ? <Play /> : <Pause />,
                  ...(s.status === "SUSPENDED" ? {} : { tone: "danger" as const }),
                  disabled: !writable,
                  disabledReason: missingPermission("shops:write"),
                  onSelect: () => ask(shopStatusPrompt(s, (status, reason) => setShopStatus.mutateAsync({ id: s.id, status, reason }))),
                },
              ]}
            />
          )}
          renderCard={(s) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <Mono className="text-text-primary">{s.code}</Mono>
                  <span className="block truncate font-medium">{s.name}</span>
                </span>
                <Status value={s.status} />
              </div>
              <div className="flex items-baseline justify-between text-sm text-text-secondary">
                <span>{s.cashierCount} cashiers</span>
                <span className="type-financial text-text-primary">{formatMoney(s.todaySales)}</span>
              </div>
            </div>
          )}
        />
      </Panel>
      <ShopFormDrawer open={form !== undefined} onClose={() => setForm(undefined)} shop={form?.shop} />
      {dialog}
    </>
  );
}
