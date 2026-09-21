import { CircleSlash } from "lucide-react";
import type { AdminPermission } from "@betng/contracts";
import type { FeatureFlag } from "@betng/ui-core";
import { Button, EmptyState, ForbiddenState, Tooltip, useFlag, type ButtonProps } from "@betng/ui-web";
import { useAdmin } from "../hooks/useAdmin";
import { missingPermission } from "../lib/navigation";

/** Presentation only: the platform checks the permission again on every request. */
export function RequirePermission({ permission, children }: { readonly permission: AdminPermission; readonly children: React.ReactNode }): React.JSX.Element {
  const { can } = useAdmin();

  if (!can(permission)) return <ForbiddenState permission={permission} />;

  return <>{children}</>;
}

export interface GuardedButtonProps extends ButtonProps {
  readonly permission: AdminPermission;
  /** Why the action is unavailable right now, independent of permission. */
  readonly blockedReason?: string | undefined;
}

export function GuardedButton({ permission, blockedReason, disabled, children, ...rest }: GuardedButtonProps): React.JSX.Element {
  const { can } = useAdmin();
  const reason = can(permission) ? blockedReason : missingPermission(permission);
  const button = (
    <Button {...rest} disabled={disabled === true || reason !== undefined}>
      {children}
    </Button>
  );

  return reason === undefined ? (
    button
  ) : (
    <Tooltip content={reason} {...(rest.full === true ? { className: "flex w-full" } : {})}>
      {button}
    </Tooltip>
  );
}

export function NotAvailableYet({ title = "Not available yet", description }: { readonly title?: string; readonly description: string }): React.JSX.Element {
  return <EmptyState icon={<CircleSlash className="size-5" />} title={title} description={description} />;
}

/** The platform switches whole areas on with a feature flag; a direct link to one that is off lands here. */
export function RequireFlag({ flag, children }: { readonly flag: FeatureFlag; readonly children: React.ReactNode }): React.JSX.Element {
  const enabled = useFlag(flag);

  if (!enabled) return <NotAvailableYet description="The platform has not switched this area on for this environment. Nothing here can be read or changed until it does." />;

  return <>{children}</>;
}
