import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, KeyRound, MoreHorizontal, Pause, Play, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";
import type { AdminCashierSummary, CashierCredentials } from "@betng/contracts";
import { formatDateTime, formatMoney, formatRelative } from "@betng/ui-core";
import { Avatar, Button, ConfirmationDialog, Drawer, Dropdown, FormError, Modal, RadioGroup, applyFieldErrors, type Column } from "@betng/ui-web";
import { useAdminAction, useShopDirectory } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { useAdminList } from "../hooks/useAdminList";
import { humanise } from "../lib/format";
import { missingPermission } from "../lib/navigation";
import { cashierSchema, type CashierValues } from "../lib/schemas";
import { adminSource } from "../services/runtime";
import { AdminListTable } from "./AdminListTable";
import { CopyButton, Mono, Status } from "./Bits";
import { TextField } from "./form/TextField";
import { useReasonAction } from "./ReasonAction";

/* One-time secrets live in this component's state only: never logged, stored or sent anywhere but the screen. */
function CredentialsDialog({ credentials, onClose }: { readonly credentials: CashierCredentials | undefined; readonly onClose: () => void }): React.JSX.Element {
  const rows: readonly (readonly [string, string])[] =
    credentials === undefined
      ? []
      : [
          ["Username", credentials.username],
          ["Temporary password", credentials.temporaryPassword],
          ["Temporary PIN", credentials.temporaryPin],
        ];

  return (
    <Modal open={credentials !== undefined} onClose={onClose} title="One-time credentials" size="sm" dismissible={false} footer={<Button onClick={onClose}>I have passed these on</Button>}>
      {credentials !== undefined && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-sm bg-warning-subtle px-3 py-2 text-sm text-text-secondary">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            Shown once. The platform keeps only hashes, so these cannot be read again after you close this window. The cashier must change both at first sign-in.
          </p>
          <dl className="divide-y divide-border rounded-sm border border-border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-sm text-text-muted">{label}</dt>
                <dd className="flex items-center gap-1">
                  <Mono className="text-base text-text-primary">{value}</Mono>
                  <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} sensitive />
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

const FIELDS = ["username", "displayName", "role"] as const;

export function CreateCashierDrawer({ shopId, shopCode, open, onClose }: { readonly shopId: string; readonly shopCode: string; readonly open: boolean; readonly onClose: () => void }): React.JSX.Element {
  const [issued, setIssued] = useState<CashierCredentials | undefined>();
  const [pending, setPending] = useState<CashierValues | undefined>();
  const [failure, setFailure] = useState<unknown>();
  const form = useForm<CashierValues>({ resolver: zodResolver(cashierSchema), defaultValues: { username: "", displayName: "", role: "CASHIER" }, mode: "onTouched" });
  const create = useAdminAction({
    run: (values: CashierValues) => adminSource.createCashier(shopId, values),
    success: (_, values) => `${values.displayName} added to ${shopCode}`,
    silentError: true,
    onDone: (credentials) => {
      setPending(undefined);
      setIssued(credentials);
      form.reset();
      onClose();
    },
  });

  useEffect(() => {
    if (open) setFailure(undefined);
  }, [open]);

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
              Review cashier
            </Button>
          </>
        }
      >
        <form
          id="cashier-form"
          noValidate
          aria-label="New cashier"
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              setFailure(undefined);
              setPending(values);
            })(event);
          }}
        >
          <FormError error={failure} />
          <TextField label="Full name" required error={form.formState.errors.displayName?.message} {...form.register("displayName")} />
          <TextField label="Username" required hint="Used with the shop code to sign in at the terminal." error={form.formState.errors.username?.message} {...form.register("username")} />
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
      <ConfirmationDialog
        open={pending !== undefined}
        onClose={() => {
          if (!create.isPending) setPending(undefined);
        }}
        title={`Create ${pending?.displayName ?? "this cashier"}?`}
        description={`A terminal account is added to ${shopCode} and one-time credentials are issued. They are shown once.`}
        confirmLabel="Create cashier"
        loading={create.isPending}
        onConfirm={async () => {
          if (pending === undefined) return;

          try {
            await create.mutateAsync(pending);
          } catch (error) {
            applyFieldErrors(error, form.setError, FIELDS);
            setFailure(error);
            setPending(undefined);
          }
        }}
      />
      <CredentialsDialog credentials={issued} onClose={() => setIssued(undefined)} />
    </>
  );
}

export function CashierList({ shopId }: { readonly shopId?: string }): React.JSX.Element {
  const navigate = useNavigate();
  const { can } = useAdmin();
  const crossShop = shopId === undefined;
  const list = useAdminList("cashiers", { defaults: { sort: "todayTransactions", direction: "desc" }, filterKeys: crossShop ? ["shopId", "status", "role"] : ["status", "role"], ...(crossShop ? {} : { fixedFilters: { shopId } }) });
  const shops = useShopDirectory(crossShop);
  const { ask, dialog } = useReasonAction();
  const [issued, setIssued] = useState<CashierCredentials | undefined>();
  const writable = can("cashiers:write");
  const shopCode = (id: string): string | undefined => shops.data?.find((s) => s.id === id)?.code;

  const setStatus = useAdminAction({
    run: (input: { readonly cashier: AdminCashierSummary; readonly status: "ACTIVE" | "SUSPENDED"; readonly reason: string }) => adminSource.setCashierStatus(input.cashier.shopId, input.cashier.id, input.status, input.reason),
    success: (cashier) => `${cashier.displayName} is now ${cashier.status.toLowerCase()}`,
  });
  const reset = useAdminAction({
    run: (cashier: AdminCashierSummary) => adminSource.resetCashierCredentials(cashier.shopId, cashier.id),
    success: (_, cashier) => `Credentials reset for ${cashier.displayName}`,
    onDone: setIssued,
  });

  const columns: readonly Column<AdminCashierSummary>[] = [
    {
      key: "displayName",
      header: "Cashier",
      sortable: true,
      hideable: false,
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
    ...(crossShop ? [{ key: "shopId", header: "Shop", cell: (c: AdminCashierSummary) => <Mono className="text-text-primary">{shopCode(c.shopId) ?? c.shopId.slice(0, 8)}</Mono> }] : []),
    { key: "role", header: "Role", sortable: true, cell: (c) => <span className="text-sm font-medium text-text-secondary">{humanise(c.role)}</span> },
    { key: "status", header: "Status", sortable: true, cell: (c) => <Status value={c.status} /> },
    { key: "lastActiveAt", header: "Last active", sortable: true, cell: (c) => <span className="whitespace-nowrap text-text-secondary">{c.lastActiveAt === undefined ? "Never" : formatRelative(c.lastActiveAt)}</span>, hideBelow: "lg" },
    { key: "todayTransactions", header: "Transactions today", numeric: true, sortable: true, cell: (c) => c.todayTransactions },
    { key: "todaySales", header: "Sales today", numeric: true, sortable: true, cell: (c) => <span className="type-financial">{formatMoney(c.todaySales)}</span>, hideBelow: "lg" },
  ];

  return (
    <>
      <AdminListTable
        list={list}
        caption="Cashiers"
        noun="cashiers"
        columns={columns}
        rowKey={(c) => c.id}
        search={{ label: "Search cashiers by name or username", placeholder: "Search name or username" }}
        filters={[
          ...(crossShop ? [{ key: "shopId", label: "Shop", anyLabel: "All shops", options: (shops.data ?? []).map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })) }] : []),
          {
            key: "status",
            label: "Status",
            anyLabel: "All statuses",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended" },
            ],
          },
          {
            key: "role",
            label: "Role",
            anyLabel: "All roles",
            options: [
              { value: "CASHIER", label: "Cashier" },
              { value: "MANAGER", label: "Manager" },
              { value: "OWNER", label: "Owner" },
            ],
          },
        ]}
        rowActions={(c) => (
          <Dropdown
            label={`Actions for ${c.displayName}`}
            trigger={
              <span className="flex size-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-hover hover:text-text-primary">
                <MoreHorizontal className="size-4" aria-hidden />
              </span>
            }
            items={[
              c.status === "ACTIVE"
                ? {
                    key: "suspend",
                    label: "Suspend",
                    icon: <Pause />,
                    tone: "danger" as const,
                    disabled: !writable,
                    disabledReason: missingPermission("cashiers:write"),
                    onSelect: () =>
                      ask({ title: `Suspend ${c.displayName}?`, description: "Their terminal session ends at once and they cannot sign in until reactivated.", confirmLabel: "Suspend cashier", tone: "danger", run: (reason) => setStatus.mutateAsync({ cashier: c, status: "SUSPENDED", reason }) }),
                  }
                : {
                    key: "reactivate",
                    label: "Reactivate",
                    icon: <Play />,
                    disabled: !writable,
                    disabledReason: missingPermission("cashiers:write"),
                    onSelect: () => ask({ title: `Reactivate ${c.displayName}?`, description: "They will be able to sign in at the shop terminal again.", confirmLabel: "Reactivate cashier", run: (reason) => setStatus.mutateAsync({ cashier: c, status: "ACTIVE", reason }) }),
                  },
              {
                key: "reset",
                label: "Reset credentials",
                icon: <KeyRound />,
                disabled: !writable,
                disabledReason: missingPermission("cashiers:write"),
                onSelect: () =>
                  ask({
                    title: `Reset credentials for ${c.displayName}?`,
                    description: "Their password and PIN stop working immediately. New one-time credentials are shown once for you to hand over. The platform records the reset in the audit log.",
                    confirmLabel: "Reset credentials",
                    tone: "danger",
                    requireReason: false,
                    run: () => reset.mutateAsync(c),
                  }),
              },
              { key: "activity", label: "View activity", icon: <History />, disabled: !can("audit:read"), disabledReason: missingPermission("audit:read"), onSelect: () => void navigate(`/audit?resource=${encodeURIComponent(c.id)}`) },
            ]}
          />
        )}
        renderCard={(c) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.displayName}</span>
                <Mono>{c.username}</Mono>
              </span>
              <Status value={c.status} />
            </div>
            <div className="flex items-baseline justify-between text-sm text-text-secondary">
              <span>
                {humanise(c.role)}
                {crossShop && shopCode(c.shopId) !== undefined ? ` · ${shopCode(c.shopId) ?? ""}` : ""}
              </span>
              <span className="type-financial text-text-primary">{formatMoney(c.todaySales)}</span>
            </div>
          </div>
        )}
      />
      <CredentialsDialog credentials={issued} onClose={() => setIssued(undefined)} />
      {dialog}
    </>
  );
}
