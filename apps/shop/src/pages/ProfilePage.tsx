import type { Cashier } from "@betng/contracts";
import { formatDateTime, formatMoney, formatRelative } from "@betng/ui-core";
import { Avatar, Badge, DataTable, Panel, StatusBadge, type Column } from "@betng/ui-web";
import { PageHeader } from "../components/PageHeader";
import { useCashiers } from "../hooks/queries";
import { useShopSession } from "../hooks/useShopSession";

const ROLE_LABEL = { OWNER: "Owner", MANAGER: "Manager", CASHIER: "Cashier" } as const;

const PERMISSION_LABEL: Readonly<Record<string, string>> = {
  "tickets:sell": "Sell tickets",
  "tickets:check": "Check tickets",
  "tickets:payout": "Pay out tickets",
  "tickets:cancel": "Cancel tickets",
  "transactions:read": "View transactions",
  "reports:read": "View reports",
  "cashiers:read": "View cashiers",
};

const COLUMNS: readonly Column<Cashier>[] = [
  { key: "name", header: "Name", cell: (c) => <span className="font-medium">{c.displayName}</span> },
  { key: "username", header: "Username", cell: (c) => <span className="font-mono text-text-secondary">{c.username}</span> },
  { key: "role", header: "Role", cell: (c) => ROLE_LABEL[c.role] },
  { key: "status", header: "Status", cell: (c) => <StatusBadge tone={c.status === "ACTIVE" ? "success" : "danger"}>{c.status === "ACTIVE" ? "Active" : "Suspended"}</StatusBadge> },
  { key: "active", header: "Last active", align: "right", hideBelow: "md", cell: (c) => <span className="text-text-muted">{c.lastActiveAt === undefined ? "—" : formatRelative(c.lastActiveAt)}</span> },
];

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right font-medium text-text-primary">{children}</dd>
    </div>
  );
}

export function ProfilePage(): React.JSX.Element | null {
  const { session, can } = useShopSession();
  const cashiers = useCashiers(can("cashiers:read"));

  if (session === undefined) return null;

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-5">
      <PageHeader title="Profile" description="Your cashier account and this shop. Details are managed by BetNG administration." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cashier">
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={session.cashier.displayName} size="lg" />
            <div>
              <p className="text-md font-semibold">{session.cashier.displayName}</p>
              <p className="text-sm text-text-muted">
                {ROLE_LABEL[session.cashier.role]} · <span className="font-mono">{session.cashier.username}</span>
              </p>
            </div>
          </div>
          <dl>
            <Field label="Status">
              <StatusBadge tone="success">Active</StatusBadge>
            </Field>
            <Field label="Session ends">{formatDateTime(session.expiresAt)}</Field>
          </dl>
          <p className="caps-label mb-1.5 mt-4">What this role can do</p>
          <ul className="flex flex-wrap gap-1.5">
            {(session.permissions ?? []).map((p) => (
              <li key={p}>
                <Badge tone="neutral">{PERMISSION_LABEL[p] ?? p}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Shop">
          <dl>
            <Field label="Code">
              <span className="font-mono">{session.shop.code}</span>
            </Field>
            <Field label="Name">{session.shop.name}</Field>
            <Field label="Address">{session.shop.address}</Field>
            <Field label="Phone">{session.shop.phone}</Field>
            <Field label="Owner">{session.shop.ownerName}</Field>
            <Field label="Float">{formatMoney(session.shop.balance)}</Field>
          </dl>
        </Panel>
      </div>
      {can("cashiers:read") && (
        <Panel title="Cashiers at this shop" description="Accounts are created and suspended from BetNG Admin." flush className="mt-4">
          <DataTable caption="Cashiers" columns={COLUMNS} rows={cashiers.data} rowKey={(c) => c.id} loading={cashiers.isPending} error={cashiers.error} onRetry={() => void cashiers.refetch()} />
        </Panel>
      )}
    </div>
  );
}
