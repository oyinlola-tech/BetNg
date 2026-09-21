import type { AdminPermission } from "@betng/contracts";
import { Button, PermissionDenied, Tooltip, type ButtonProps } from "@betng/ui-web";
import { useAdmin } from "../hooks/useAdmin";

/** Renders the page only when the session carries the permission; the platform still checks every request. */
export function RequirePermission({ permission, children }: { readonly permission: AdminPermission; readonly children: React.ReactNode }): React.JSX.Element {
  const { can } = useAdmin();

  if (!can(permission)) return <PermissionDenied permission={permission} />;

  return <>{children}</>;
}

export interface GuardedButtonProps extends ButtonProps {
  readonly permission: AdminPermission;
  /** Why the action is unavailable right now, independent of permission. */
  readonly blockedReason?: string | undefined;
}

export function GuardedButton({ permission, blockedReason, disabled, children, ...rest }: GuardedButtonProps): React.JSX.Element {
  const { can } = useAdmin();
  const allowed = can(permission);
  const reason = !allowed ? `Requires the “${permission}” permission` : blockedReason;
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
