import type { LimitKind, ResponsibleGamingAccount, ResponsibleGamingLimit } from "@betng/contracts";
import { formatDateTime, formatMoney, formatRelative, formatShortDate } from "@betng/ui-core";
import { Badge, Panel, StatusBadge, type Column } from "@betng/ui-web";
import { AdminListTable } from "../components/AdminListTable";
import { ServiceNotDeployed, isNotImplemented } from "../components/ComplianceBits";
import { PageHeader } from "../components/PageHeader";
import { RG_FLAGS, useResponsibleGaming } from "../hooks/compliance";
import { DASH } from "../lib/format";

type Flag = ResponsibleGamingAccount["flags"][number];

const FLAG_VIEW: Readonly<Record<Flag, { readonly label: string; readonly tone: "danger" | "warning" | "info" }>> = {
  SELF_EXCLUDED: { label: "Self-excluded", tone: "danger" },
  LIMIT_BREACH_ATTEMPT: { label: "Limit breach attempt", tone: "warning" },
  LIMIT_RAISED: { label: "Limit raised", tone: "info" },
  LONG_SESSION: { label: "Long session", tone: "info" },
};

const LIMIT_LABEL: Readonly<Record<LimitKind, string>> = {
  deposit_daily: "Deposit / day",
  deposit_weekly: "Deposit / week",
  deposit_monthly: "Deposit / month",
  loss_daily: "Loss / day",
  loss_weekly: "Loss / week",
  session_minutes: "Session",
};

function amount(limit: ResponsibleGamingLimit, value: number): string {
  return limit.kind === "session_minutes" ? `${String(value)} min` : formatMoney(value, { fraction: "never" });
}

function LimitsSummary({ account }: { readonly account: ResponsibleGamingAccount }): React.JSX.Element {
  const active = account.limits.filter((l) => l.status === "active" || l.status === "pending");

  if (active.length === 0) return <span className="text-sm text-text-muted">No limits set</span>;

  return (
    <ul className="space-y-0.5 text-sm">
      {active.map((limit) => (
        <li key={limit.kind} className="flex flex-wrap gap-x-1.5 whitespace-nowrap">
          <span className="text-text-muted">{LIMIT_LABEL[limit.kind]}</span>
          <span className="tabular text-text-primary">{amount(limit, limit.value)}</span>
          {limit.used !== undefined && <span className="tabular text-text-muted">used {amount(limit, limit.used)}</span>}
          {limit.pendingValue !== undefined && <span className="tabular text-text-secondary">→ {amount(limit, limit.pendingValue)}{limit.pendingEffectiveAt === undefined ? "" : ` from ${formatShortDate(limit.pendingEffectiveAt)}`}</span>}
        </li>
      ))}
    </ul>
  );
}

const COLUMNS: readonly Column<ResponsibleGamingAccount>[] = [
  {
    key: "customer",
    header: "Customer",
    hideable: false,
    cell: (a) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium">{a.displayName}</span>
        <span className="block truncate text-sm text-text-muted">{a.email}</span>
      </span>
    ),
  },
  {
    key: "flags",
    header: "Flags",
    cell: (a) => (
      <span className="flex flex-wrap gap-1">
        {a.flags.map((flag) => (
          <Badge key={flag} tone={FLAG_VIEW[flag].tone}>
            {FLAG_VIEW[flag].label}
          </Badge>
        ))}
      </span>
    ),
  },
  { key: "limits", header: "Limits", cell: (a) => <LimitsSummary account={a} />, hideBelow: "lg" },
  {
    key: "exclusion",
    header: "Self-exclusion",
    cell: (a) =>
      a.selfExclusion.active ? (
        <span className="whitespace-nowrap text-sm text-text-primary">{a.selfExclusion.endsAt === undefined ? "Active, permanent" : `Until ${formatShortDate(a.selfExclusion.endsAt)}`}</span>
      ) : (
        <span className="text-sm text-text-muted">None</span>
      ),
  },
  {
    key: "restricted",
    header: "Account",
    cell: (a) => (a.restricted ? <StatusBadge status="BLOCKED">Restricted</StatusBadge> : <StatusBadge status="ACTIVE">Can bet</StatusBadge>),
    hideBelow: "md",
  },
  { key: "flaggedAt", header: "Flagged", cell: (a) => (a.flaggedAt === undefined ? DASH : <span className="whitespace-nowrap text-text-secondary" title={formatDateTime(a.flaggedAt)}>{formatRelative(a.flaggedAt)}</span>), hideBelow: "lg" },
];

export function ResponsibleGamingPage(): React.JSX.Element {
  const list = useResponsibleGaming();

  return (
    <>
      <PageHeader title="Responsible gaming" description="Accounts the platform has flagged: self-exclusions, attempts to go past a limit, raised limits and long sessions. Read-only; limits are enforced by the wallet and betting services and changed only by the customer." />
      {isNotImplemented(list.query.error) ? (
        <ServiceNotDeployed what="responsible gaming oversight" />
      ) : (
        <Panel flush>
          <AdminListTable
            list={list}
            caption="Flagged accounts"
            noun="flagged accounts"
            columns={COLUMNS}
            rowKey={(a) => a.userId}
            search={{ label: "Search flagged accounts by name or email", placeholder: "Search name, email" }}
            filters={[{ key: "flag", label: "Flag", anyLabel: "All flags", options: RG_FLAGS.map((flag) => ({ value: flag, label: FLAG_VIEW[flag].label })) }]}
            renderCard={(a) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.displayName}</span>
                    <span className="block truncate text-sm text-text-muted">{a.email}</span>
                  </span>
                  {a.restricted && <StatusBadge status="BLOCKED">Restricted</StatusBadge>}
                </div>
                <span className="flex flex-wrap gap-1">
                  {a.flags.map((flag) => (
                    <Badge key={flag} tone={FLAG_VIEW[flag].tone}>
                      {FLAG_VIEW[flag].label}
                    </Badge>
                  ))}
                </span>
                <LimitsSummary account={a} />
              </div>
            )}
          />
        </Panel>
      )}
    </>
  );
}
