import { useState } from "react";
import type { AdminCustomer } from "@betng/contracts";
import { formatDateTime, formatMoney, formatRelative, formatShortDate } from "@betng/ui-core";
import { Avatar, Drawer, Panel, type Column } from "@betng/ui-web";
import { AdminListTable } from "../components/AdminListTable";
import { CustomerEditDrawer } from "../components/CustomerEditDrawer";
import { DetailItem, Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction } from "../hooks/queries";
import { useAdminList } from "../hooks/useAdminList";
import { DASH } from "../lib/format";
import { adminSource } from "../services/runtime";

const COLUMNS: readonly Column<AdminCustomer>[] = [
  {
    key: "displayName",
    header: "Customer",
    sortable: true,
    hideable: false,
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
  { key: "status", header: "Status", sortable: true, cell: (c) => <Status value={c.status} /> },
  { key: "balance", header: "Wallet balance", numeric: true, sortable: true, cell: (c) => <span className="type-financial">{formatMoney(c.balance)}</span> },
  { key: "openBets", header: "Open bets", numeric: true, sortable: true, cell: (c) => c.openBets, hideBelow: "lg" },
  { key: "lifetimeStake", header: "Lifetime stake", numeric: true, sortable: true, cell: (c) => formatMoney(c.lifetimeStake), hideBelow: "lg" },
  { key: "lifetimePayout", header: "Lifetime payout", numeric: true, sortable: true, cell: (c) => formatMoney(c.lifetimePayout), hideBelow: "xl", defaultHidden: true },
  { key: "lastActiveAt", header: "Last active", sortable: true, cell: (c) => <span className="whitespace-nowrap text-text-secondary">{formatRelative(c.lastActiveAt)}</span>, hideBelow: "lg" },
];

export function UsersPage(): React.JSX.Element {
  const list = useAdminList("users", { defaults: { sort: "lastActiveAt", direction: "desc" }, filterKeys: ["status"] });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const selected = list.query.data?.items.find((c) => c.id === selectedId);
  const { ask, dialog } = useReasonAction();
  const setCustomerStatus = useAdminAction({
    run: (input: { readonly id: string; readonly status: "ACTIVE" | "SUSPENDED"; readonly reason: string }) => adminSource.setCustomerStatus(input.id, input.status, input.reason),
    success: (customer) => `${customer.displayName} is now ${customer.status.toLowerCase()}`,
  });
  const sendPasswordReset = useAdminAction({
    run: (input: { readonly id: string; readonly name: string; readonly reason: string }) => adminSource.sendCustomerPasswordReset(input.id, input.reason),
    success: (_result, input) => `Password reset sent to ${input.name}`,
  });

  return (
    <>
      <PageHeader title="Users" description="Customer accounts on web and mobile. Balances are the platform's wallet figures and are read-only here." />
      <Panel flush>
        <AdminListTable
          list={list}
          caption="Customers"
          noun="customers"
          columns={COLUMNS}
          rowKey={(c) => c.id}
          search={{ label: "Search customers by name, email or phone", placeholder: "Search name, email, phone" }}
          filters={[
            {
              key: "status",
              label: "Status",
              anyLabel: "All statuses",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
              ],
            },
          ]}
          onRowClick={(c) => setSelectedId(c.id)}
          selectedKey={selectedId}
          renderCard={(c) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.displayName}</span>
                  <span className="block truncate text-sm text-text-muted">{c.email}</span>
                </span>
                <Status value={c.status} />
              </div>
              <div className="flex items-baseline justify-between text-sm text-text-secondary">
                <span>{formatRelative(c.lastActiveAt)}</span>
                <span className="type-financial text-text-primary">{formatMoney(c.balance)}</span>
              </div>
            </div>
          )}
        />
      </Panel>

      <Drawer
        open={selected !== undefined && !editing}
        onClose={() => setSelectedId(undefined)}
        title={selected?.displayName ?? ""}
        description={selected?.email ?? ""}
        footer={
          selected !== undefined && (
            <>
              <GuardedButton permission="users:write" variant="secondary" onClick={() => setEditing(true)}>
                Edit details
              </GuardedButton>
              <GuardedButton
                permission="users:write"
                variant="secondary"
                onClick={() => {
                  ask({
                    title: "Send a password reset?",
                    description: `${selected.displayName} gets an email at ${selected.email} with a code to set a new password. Their current password keeps working until they use it.`,
                    confirmLabel: "Send password reset",
                    run: (reason) => sendPasswordReset.mutateAsync({ id: selected.id, name: selected.displayName, reason: reason.trim() }),
                  });
                }}
              >
                Send password reset
              </GuardedButton>
              <GuardedButton
                permission="users:write"
                variant={selected.status === "ACTIVE" ? "danger" : "primary"}
                onClick={() => {
                  const next = selected.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

                  ask({
                    title: next === "SUSPENDED" ? "Suspend this customer?" : "Reactivate this customer?",
                    description: next === "SUSPENDED" ? `${selected.displayName} will be signed out and unable to bet or withdraw. Open bets still settle.` : `${selected.displayName} will be able to sign in and bet again.`,
                    confirmLabel: next === "SUSPENDED" ? "Suspend customer" : "Reactivate customer",
                    tone: next === "SUSPENDED" ? "danger" : "primary",
                    run: (reason) => setCustomerStatus.mutateAsync({ id: selected.id, status: next, reason }),
                  });
                }}
              >
                {selected.status === "ACTIVE" ? "Suspend customer" : "Reactivate customer"}
              </GuardedButton>
            </>
          )
        }
      >
        {selected !== undefined && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailItem label="Status">
              <Status value={selected.status} />
            </DetailItem>
            <DetailItem label="Phone">{selected.phone ?? DASH}</DetailItem>
            <DetailItem label="Customer ID" className="col-span-2">
              <Mono className="whitespace-normal break-all">{selected.id}</Mono>
            </DetailItem>
            <DetailItem label="Joined">{formatShortDate(selected.createdAt)}</DetailItem>
            <DetailItem label="Wallet balance">
              <span className="type-financial">{formatMoney(selected.balance)}</span>
              <span className="mt-0.5 block text-xs text-text-muted">Read-only: the platform's ledger figure.</span>
            </DetailItem>
            <DetailItem label="Open bets">{selected.openBets}</DetailItem>
            <DetailItem label="Lifetime stake">
              <span className="tabular">{formatMoney(selected.lifetimeStake)}</span>
            </DetailItem>
            <DetailItem label="Lifetime payout">
              <span className="tabular">{formatMoney(selected.lifetimePayout)}</span>
            </DetailItem>
            <DetailItem label="Last active" className="col-span-2">
              {formatDateTime(selected.lastActiveAt)}
            </DetailItem>
          </dl>
        )}
      </Drawer>
      <CustomerEditDrawer customer={editing ? selected : undefined} onClose={() => setEditing(false)} />
      {dialog}
    </>
  );
}
