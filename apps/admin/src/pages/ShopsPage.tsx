import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BarChart3, Eye, MoreHorizontal, Pause, Pencil, Play, Plus, UserSquare } from "lucide-react";
import type { AdminShopSummary } from "@betng/contracts";
import { formatMoney, formatRelative } from "@betng/ui-core";
import { DataTable, Dropdown, Panel, SearchInput, Select, type Column } from "@betng/ui-web";
import { FilterBar, Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { ShopFormDrawer } from "../components/ShopFormDrawer";
import { useAdminAction, useShops } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { adminSource } from "../services/sources";

type StatusFilter = "ALL" | AdminShopSummary["status"];

export function useShopStatusAction() {
  return useAdminAction({
    run: (input: { readonly id: string; readonly status: "ACTIVE" | "SUSPENDED"; readonly reason: string }) => adminSource.setShopStatus(input.id, input.status, input.reason),
    success: (shop) => `${shop.code} is now ${shop.status.toLowerCase()}`,
  });
}

export function ShopsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { can } = useAdmin();
  const shops = useShops();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [form, setForm] = useState<{ readonly shop?: AdminShopSummary } | undefined>();
  const { ask, dialog } = useReasonAction();
  const setShopStatus = useShopStatusAction();
  const needsWrite = "Requires the “shops:write” permission";

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return shops.data?.filter((s) => (status === "ALL" || s.status === status) && (needle === "" || `${s.code} ${s.name} ${s.ownerName} ${s.address}`.toLowerCase().includes(needle)));
  }, [shops.data, q, status]);

  const columns: readonly Column<AdminShopSummary>[] = [
    { key: "code", header: "Shop code", sortValue: (s) => s.code, cell: (s) => <Mono className="text-text-primary">{s.code}</Mono> },
    {
      key: "name",
      header: "Shop name",
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="block min-w-40">
          <span className="block truncate font-medium">{s.name}</span>
          <span className="block truncate text-sm text-text-muted">{s.address}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", sortValue: (s) => s.status, cell: (s) => <Status value={s.status} /> },
    { key: "cashiers", header: "Cashiers", numeric: true, sortValue: (s) => s.cashierCount, cell: (s) => s.cashierCount, hideBelow: "md" },
    { key: "sales", header: "Today's sales", numeric: true, sortValue: (s) => s.todaySales, cell: (s) => formatMoney(s.todaySales) },
    { key: "payouts", header: "Today's payouts", numeric: true, sortValue: (s) => s.todayPayouts, cell: (s) => formatMoney(s.todayPayouts), hideBelow: "lg" },
    { key: "active", header: "Last active", sortValue: (s) => s.lastActiveAt ?? "", cell: (s) => <span className="text-text-secondary">{s.lastActiveAt === undefined ? "Never" : formatRelative(s.lastActiveAt)}</span>, hideBelow: "lg" },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "48px",
      cell: (s) => (
        <span
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          role="presentation"
        >
          <Dropdown
            label={`Actions for ${s.code}`}
            trigger={
              <span className="flex size-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-hover hover:text-text-primary">
                <MoreHorizontal className="size-4" />
              </span>
            }
            items={[
              { key: "view", label: "View", icon: <Eye />, onSelect: () => void navigate(`/shops/${s.id}`) },
              { key: "edit", label: "Edit", icon: <Pencil />, disabled: !can("shops:write"), disabledReason: needsWrite, onSelect: () => setForm({ shop: s }) },
              { key: "cashiers", label: "Cashiers", icon: <UserSquare />, onSelect: () => void navigate(`/shops/${s.id}?tab=cashiers`) },
              { key: "reports", label: "Reports", icon: <BarChart3 />, onSelect: () => void navigate(`/shops/${s.id}?tab=reports`) },
              s.status === "SUSPENDED"
                ? {
                    key: "activate",
                    label: "Activate",
                    icon: <Play />,
                    disabled: !can("shops:write"),
                    disabledReason: needsWrite,
                    onSelect: () =>
                      ask({ title: `Activate ${s.code}?`, description: "Cashiers will be able to sign in and sell tickets again.", confirmLabel: "Activate shop", run: (reason) => setShopStatus.mutateAsync({ id: s.id, status: "ACTIVE", reason }) }),
                  }
                : {
                    key: "suspend",
                    label: "Suspend",
                    icon: <Pause />,
                    tone: "danger" as const,
                    disabled: !can("shops:write"),
                    disabledReason: needsWrite,
                    onSelect: () =>
                      ask({
                        title: `Suspend ${s.code}?`,
                        description: "All cashier sessions end and the shop cannot sell or pay out until reactivated. Open tickets still settle.",
                        confirmLabel: "Suspend shop",
                        tone: "danger",
                        run: (reason) => setShopStatus.mutateAsync({ id: s.id, status: "SUSPENDED", reason }),
                      }),
                  },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Shops"
        description="Retail locations selling over the counter. Sales and payouts are today's simulated totals."
        actions={
          <GuardedButton permission="shops:write" icon={<Plus className="size-4" />} onClick={() => setForm({})}>
            New shop
          </GuardedButton>
        }
      />
      <Panel flush>
        <FilterBar>
          <SearchInput label="Search shops" placeholder="Search code, name, owner" value={q} onChange={setQ} className="w-full sm:w-72" />
          <Select
            label="Status"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "OFFLINE", label: "Offline" },
            ]}
          />
          <span className="ml-auto text-sm tabular text-text-muted">{rows === undefined ? "" : `${String(rows.length)} shops`}</span>
        </FilterBar>
        <DataTable
          caption="Shops"
          columns={columns}
          rows={rows}
          rowKey={(s) => s.id}
          loading={shops.isLoading}
          error={shops.error}
          onRetry={() => void shops.refetch()}
          onRowClick={(s) => void navigate(`/shops/${s.id}`)}
          initialSort={{ key: "sales", direction: "desc" }}
          pageSize={20}
          empty={{ title: "No shops match", description: "Clear the search or change the status filter." }}
        />
      </Panel>
      <ShopFormDrawer open={form !== undefined} onClose={() => setForm(undefined)} shop={form?.shop} />
      {dialog}
    </>
  );
}
