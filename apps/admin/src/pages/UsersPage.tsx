import { useMemo, useState } from "react";
import type { AdminCustomer } from "@betng/contracts";
import { formatDateTime, formatMoney, formatRelative } from "@betng/ui-core";
import { Avatar, DataTable, Drawer, Panel, SearchInput, Select, type Column } from "@betng/ui-web";
import { Field, FilterBar, Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction, useCustomers } from "../hooks/queries";
import { adminSource } from "../services/sources";

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED";

export function UsersPage(): React.JSX.Element {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const customers = useCustomers(q);
  const { ask, dialog } = useReasonAction();
  const setCustomerStatus = useAdminAction({
    run: (input: { readonly id: string; readonly status: "ACTIVE" | "SUSPENDED"; readonly reason: string }) => adminSource.setCustomerStatus(input.id, input.status, input.reason),
    success: (customer) => `${customer.displayName} is now ${customer.status.toLowerCase()}`,
  });

  const rows = useMemo(() => customers.data?.filter((c) => status === "ALL" || c.status === status), [customers.data, status]);
  const selected = customers.data?.find((c) => c.id === selectedId);

  const columns: readonly Column<AdminCustomer>[] = [
    {
      key: "user",
      header: "User",
      sortValue: (c) => c.displayName,
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={c.displayName} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.displayName}</span>
            <span className="block truncate text-sm text-text-muted">{c.email}</span>
          </span>
        </span>
      ),
    },
    { key: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <Status value={c.status} /> },
    { key: "balance", header: "Balance", numeric: true, sortValue: (c) => c.balance, cell: (c) => formatMoney(c.balance) },
    { key: "open", header: "Open bets", numeric: true, sortValue: (c) => c.openBets, cell: (c) => c.openBets, hideBelow: "md" },
    { key: "stake", header: "Lifetime stake", numeric: true, sortValue: (c) => c.lifetimeStake, cell: (c) => formatMoney(c.lifetimeStake), hideBelow: "lg" },
    { key: "active", header: "Last active", sortValue: (c) => c.lastActiveAt, cell: (c) => <span className="text-text-secondary">{formatRelative(c.lastActiveAt)}</span>, hideBelow: "md" },
  ];

  return (
    <>
      <PageHeader title="Users" description="Customer accounts on web and mobile. Balances are simulated." />
      <Panel flush>
        <FilterBar>
          <SearchInput label="Search users by name, email or phone" placeholder="Search name, email, phone" value={q} onChange={setQ} className="w-full sm:w-72" />
          <Select
            label="Status"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
          />
          <span className="ml-auto text-sm tabular text-text-muted">{rows === undefined ? "" : `${String(rows.length)} users`}</span>
        </FilterBar>
        <DataTable
          caption="Users"
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          loading={customers.isLoading}
          error={customers.error}
          onRetry={() => void customers.refetch()}
          onRowClick={(c) => setSelectedId(c.id)}
          selectedKey={selectedId}
          pageSize={15}
          initialSort={{ key: "active", direction: "desc" }}
          empty={{ title: "No users match", description: "Try a different name, email or status." }}
        />
      </Panel>

      <Drawer
        open={selected !== undefined}
        onClose={() => setSelectedId(undefined)}
        title={selected?.displayName ?? ""}
        description={selected?.email ?? ""}
        footer={
          selected !== undefined && (
            <GuardedButton
              permission="users:write"
              variant={selected.status === "ACTIVE" ? "danger" : "primary"}
              onClick={() => {
                const next = selected.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

                ask({
                  title: next === "SUSPENDED" ? "Suspend this user?" : "Reactivate this user?",
                  description: next === "SUSPENDED" ? `${selected.displayName} will be signed out and unable to bet or withdraw. Open bets still settle.` : `${selected.displayName} will be able to sign in and bet again.`,
                  confirmLabel: next === "SUSPENDED" ? "Suspend user" : "Reactivate user",
                  tone: next === "SUSPENDED" ? "danger" : "primary",
                  run: (reason) => setCustomerStatus.mutateAsync({ id: selected.id, status: next, reason }),
                });
              }}
            >
              {selected.status === "ACTIVE" ? "Suspend user" : "Reactivate user"}
            </GuardedButton>
          )
        }
      >
        {selected !== undefined && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Status">
              <Status value={selected.status} />
            </Field>
            <Field label="User ID">
              <Mono>{selected.id.slice(0, 13)}</Mono>
            </Field>
            <Field label="Phone">{selected.phone ?? "—"}</Field>
            <Field label="Joined">{formatDateTime(selected.createdAt)}</Field>
            <Field label="Wallet balance">
              <span className="tabular">{formatMoney(selected.balance)}</span>
            </Field>
            <Field label="Open bets">{selected.openBets}</Field>
            <Field label="Lifetime stake">
              <span className="tabular">{formatMoney(selected.lifetimeStake)}</span>
            </Field>
            <Field label="Lifetime payout">
              <span className="tabular">{formatMoney(selected.lifetimePayout)}</span>
            </Field>
            <Field label="Last active" className="col-span-2">
              {formatDateTime(selected.lastActiveAt)}
            </Field>
          </dl>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
