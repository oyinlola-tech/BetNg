import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, KeyRound, MoreHorizontal, Pause, Play, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";
import type { AdminCashierSummary, CashierCredentials } from "@betng/contracts";
import { formatDateTime, formatMoney, formatRelative } from "@betng/ui-core";
import { Avatar, Button, ConfirmDialog, DataTable, Drawer, Dropdown, Input, Modal, RadioGroup, type Column } from "@betng/ui-web";
import { useAdminAction } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { keys } from "../lib/queryKeys";
import { cashierSchema, type CashierValues } from "../lib/schemas";
import { adminSource } from "../services/sources";
import { CopyButton, Mono, Status } from "./Bits";
import { useReasonAction } from "./ReasonAction";

export interface CashierRow extends AdminCashierSummary {
  readonly shopCode?: string;
}

function CredentialsModal({ credentials, onClose }: { readonly credentials: CashierCredentials | undefined; readonly onClose: () => void }): React.JSX.Element {
  return (
    <Modal open={credentials !== undefined} onClose={onClose} title="One-time credentials" size="sm" footer={<Button onClick={onClose}>I have passed these on</Button>}>
      {credentials !== undefined && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-sm bg-warning-subtle px-3 py-2 text-sm text-text-secondary">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            Shown once. The platform keeps only hashes, so these cannot be retrieved after you close this window. The cashier must change both at first sign-in.
          </p>
          <dl className="divide-y divide-border rounded-sm border border-border">
            {[
              ["Username", credentials.username],
              ["Temporary password", credentials.temporaryPassword],
              ["Temporary PIN", credentials.temporaryPin],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-sm text-text-muted">{label}</dt>
                <dd className="flex items-center gap-1">
                  <Mono className="text-base text-text-primary">{value}</Mono>
                  <CopyButton value={value ?? ""} label={`Copy ${(label ?? "").toLowerCase()}`} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-text-muted">Expires {formatDateTime(credentials.expiresAt)}.</p>
        </div>
      )}
    </Modal>
  );
}

export function CreateCashierDrawer({ shopId, shopCode, open, onClose }: { readonly shopId: string; readonly shopCode: string; readonly open: boolean; readonly onClose: () => void }): React.JSX.Element {
  const [issued, setIssued] = useState<CashierCredentials | undefined>();
  const form = useForm<CashierValues>({ resolver: zodResolver(cashierSchema), defaultValues: { username: "", displayName: "", role: "CASHIER" }, mode: "onTouched" });
  const create = useAdminAction({
    run: (values: CashierValues) => adminSource.createCashier(shopId, values),
    success: (_, values) => `${values.displayName} added to ${shopCode}`,
    onDone: (credentials) => {
      setIssued(credentials);
      form.reset();
      onClose();
    },
  });

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="New cashier"
        description={`Joins ${shopCode}. One-time credentials are issued on creation.`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="cashier-form" loading={create.isPending}>
              Create cashier
            </Button>
          </>
        }
      >
        <form
          id="cashier-form"
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              create.mutate(values);
            })(event);
          }}
        >
          <Input label="Full name" error={form.formState.errors.displayName?.message} {...form.register("displayName")} />
          <Input label="Username" hint="Used with the shop code to sign in at the terminal." error={form.formState.errors.username?.message} {...form.register("username")} />
          <RadioGroup
            legend="Role"
            value={form.watch("role")}
            onChange={(role) => form.setValue("role", role, { shouldDirty: true })}
            options={[
              { value: "CASHIER", label: "Cashier", description: "Sells and checks tickets, pays out winnings." },
              { value: "MANAGER", label: "Manager", description: "Everything a cashier does, plus cancellations and reports." },
              { value: "OWNER", label: "Owner", description: "Full access to the shop, including its cashier list." },
            ]}
          />
        </form>
      </Drawer>
      <CredentialsModal credentials={issued} onClose={() => setIssued(undefined)} />
    </>
  );
}

export function CashierTable({ rows, loading, error, onRetry, showShop = false }: { readonly rows: readonly CashierRow[] | undefined; readonly loading: boolean; readonly error: unknown; readonly onRetry: () => void; readonly showShop?: boolean }): React.JSX.Element {
  const navigate = useNavigate();
  const { can } = useAdmin();
  const { ask, dialog } = useReasonAction();
  const [issued, setIssued] = useState<CashierCredentials | undefined>();
  const [resetting, setResetting] = useState<CashierRow | undefined>();
  const needs = "Requires the “cashiers:write” permission";
  const invalidate = [keys.root];

  const setStatus = useAdminAction({
    run: (input: { readonly cashier: CashierRow; readonly status: "ACTIVE" | "SUSPENDED"; readonly reason: string }) => adminSource.setCashierStatus(input.cashier.shopId, input.cashier.id, input.status, input.reason),
    success: (cashier) => `${cashier.displayName} is now ${cashier.status.toLowerCase()}`,
    invalidate,
  });
  const reset = useAdminAction({
    run: (cashier: CashierRow) => adminSource.resetCashierCredentials(cashier.shopId, cashier.id),
    success: (_, cashier) => `Credentials reset for ${cashier.displayName}`,
    invalidate,
    onDone: (credentials) => {
      setResetting(undefined);
      setIssued(credentials);
    },
  });

  const columns: readonly Column<CashierRow>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (c) => c.displayName,
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={c.displayName} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.displayName}</span>
            <Mono>{c.username}</Mono>
          </span>
        </span>
      ),
    },
    ...(showShop ? [{ key: "shop", header: "Shop", sortValue: (c: CashierRow) => c.shopCode ?? "", cell: (c: CashierRow) => <Mono className="text-text-primary">{c.shopCode}</Mono> }] : []),
    { key: "role", header: "Role", sortValue: (c) => c.role, cell: (c) => <span className="text-sm font-medium capitalize text-text-secondary">{c.role.toLowerCase()}</span> },
    { key: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <Status value={c.status} /> },
    { key: "active", header: "Last active", sortValue: (c) => c.lastActiveAt ?? "", cell: (c) => <span className="text-text-secondary">{c.lastActiveAt === undefined ? "Never" : formatRelative(c.lastActiveAt)}</span>, hideBelow: "md" },
    { key: "tx", header: "Today's transactions", numeric: true, sortValue: (c) => c.todayTransactions, cell: (c) => c.todayTransactions },
    { key: "sales", header: "Today's sales", numeric: true, sortValue: (c) => c.todaySales, cell: (c) => formatMoney(c.todaySales), hideBelow: "lg" },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "48px",
      cell: (c) => (
        <Dropdown
          label={`Actions for ${c.displayName}`}
          trigger={
            <span className="flex size-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-hover hover:text-text-primary">
              <MoreHorizontal className="size-4" />
            </span>
          }
          items={[
            c.status === "ACTIVE"
              ? {
                  key: "suspend",
                  label: "Suspend",
                  icon: <Pause />,
                  tone: "danger" as const,
                  disabled: !can("cashiers:write"),
                  disabledReason: needs,
                  onSelect: () =>
                    ask({ title: `Suspend ${c.displayName}?`, description: "Their terminal session ends at once and they cannot sign in until reactivated.", confirmLabel: "Suspend cashier", tone: "danger", run: (reason) => setStatus.mutateAsync({ cashier: c, status: "SUSPENDED", reason }) }),
                }
              : {
                  key: "reactivate",
                  label: "Reactivate",
                  icon: <Play />,
                  disabled: !can("cashiers:write"),
                  disabledReason: needs,
                  onSelect: () => ask({ title: `Reactivate ${c.displayName}?`, description: "They will be able to sign in at the shop terminal again.", confirmLabel: "Reactivate cashier", run: (reason) => setStatus.mutateAsync({ cashier: c, status: "ACTIVE", reason }) }),
                },
            { key: "reset", label: "Reset credentials", icon: <KeyRound />, disabled: !can("cashiers:write"), disabledReason: needs, onSelect: () => setResetting(c) },
            { key: "activity", label: "View activity", icon: <History />, disabled: !can("audit:read"), disabledReason: "Requires the “audit:read” permission", onSelect: () => void navigate(`/audit?resource=${c.id}`) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable caption="Cashiers" columns={columns} rows={rows} rowKey={(c) => c.id} loading={loading} error={error} onRetry={onRetry} pageSize={15} initialSort={{ key: "tx", direction: "desc" }} empty={{ title: "No cashiers yet", description: "Create the first cashier so this shop can trade." }} />
      <ConfirmDialog
        open={resetting !== undefined}
        onClose={() => setResetting(undefined)}
        title="Reset credentials?"
        description={`${resetting?.displayName ?? "This cashier"}'s password and PIN stop working immediately. New one-time credentials are shown once for you to hand over.`}
        confirmLabel="Reset credentials"
        tone="danger"
        loading={reset.isPending}
        onConfirm={() => {
          if (resetting !== undefined) reset.mutate(resetting);
        }}
      />
      <CredentialsModal credentials={issued} onClose={() => setIssued(undefined)} />
      {dialog}
    </>
  );
}
