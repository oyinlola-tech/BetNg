import { CheckCircle2, CircleAlert, ScrollText, TriangleAlert, XCircle } from "lucide-react";
import type { KycStatus, PaymentOverview } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { Panel, StatusBadge } from "@betng/ui-web";
import { NotAvailableYet } from "./Guard";

export function isNotImplemented(error: unknown): boolean {
  return error instanceof DataSourceError && error.code === "NOT_IMPLEMENTED";
}

const KYC_VIEW: Readonly<Record<KycStatus, { readonly status: string; readonly label: string }>> = {
  NOT_STARTED: { status: "INACTIVE", label: "Not started" },
  PENDING: { status: "PENDING", label: "Pending review" },
  VERIFIED: { status: "VERIFIED", label: "Verified" },
  REJECTED: { status: "REJECTED", label: "Rejected" },
  REQUIRES_ACTION: { status: "WARNING", label: "Action requested" },
};

export const KYC_STATUS_OPTIONS = (Object.keys(KYC_VIEW) as KycStatus[]).map((value) => ({ value, label: KYC_VIEW[value].label }));

export function KycStatusBadge({ value }: { readonly value: KycStatus }): React.JSX.Element {
  return <StatusBadge status={KYC_VIEW[value].status}>{KYC_VIEW[value].label}</StatusBadge>;
}

type ProviderState = PaymentOverview["providers"][number]["status"];

const PROVIDER_VIEW: Readonly<Record<ProviderState, { readonly icon: typeof CheckCircle2; readonly label: string; readonly className: string }>> = {
  UP: { icon: CheckCircle2, label: "Up", className: "text-success" },
  DEGRADED: { icon: TriangleAlert, label: "Degraded", className: "text-warning" },
  DOWN: { icon: XCircle, label: "Down", className: "text-danger" },
};

export function ProviderStatus({ status }: { readonly status: ProviderState }): React.JSX.Element {
  const view = PROVIDER_VIEW[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${view.className}`}>
      <view.icon className="size-4 shrink-0" aria-hidden />
      {view.label}
    </span>
  );
}

export function AuditNote({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="flex items-start gap-2 rounded-sm bg-surface-sunken px-3 py-2 text-sm text-text-secondary">
      <ScrollText className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function PendingNote({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="flex items-start gap-2 text-sm text-text-muted">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Shown in place of a table when the platform answers that the route is not deployed yet. */
export function ServiceNotDeployed({ what }: { readonly what: string }): React.JSX.Element {
  return (
    <Panel>
      <NotAvailableYet description={`The platform has not deployed ${what} yet. Nothing is shown until it does; no figures are filled in here.`} />
    </Panel>
  );
}
