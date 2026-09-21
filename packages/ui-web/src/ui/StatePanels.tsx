import {
  Clock,
  Compass,
  Loader2,
  Lock,
  LogIn,
  RefreshCw,
  WifiOff,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./Button";
import { EmptyState } from "./States";

export function LoadingState({
  label = "Loading",
  className,
}: {
  readonly label?: string;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-text-muted",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function OfflineState({
  onRetry,
}: {
  readonly onRetry?: () => void;
}): React.JSX.Element {
  return (
    <EmptyState
      icon={<WifiOff className="size-5" />}
      title="You are offline"
      description="What is on screen may be out of date. It refreshes as soon as the connection returns."
      {...(onRetry === undefined
        ? {}
        : {
            action: (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
                leadingIcon={<RefreshCw className="size-3.5" aria-hidden />}
              >
                Try now
              </Button>
            ),
          })}
    />
  );
}

export interface PermissionDeniedProps {
  readonly permission?: string;
  readonly action?: React.ReactNode;
}

export function PermissionDenied({
  permission,
  action,
}: PermissionDeniedProps): React.JSX.Element {
  return (
    <EmptyState
      icon={<Lock className="size-5" />}
      title="Permission denied"
      description={
        permission === undefined
          ? "Your role does not include this area. Ask an administrator if you need access."
          : `Your role does not include “${permission}”. Ask an administrator if you need access.`
      }
      {...(action === undefined ? {} : { action })}
    />
  );
}

export const ForbiddenState: (
  props: PermissionDeniedProps,
) => React.JSX.Element = PermissionDenied;

export function SessionExpiredState({
  onSignIn,
}: {
  readonly onSignIn: () => void;
}): React.JSX.Element {
  return (
    <EmptyState
      icon={<Clock className="size-5" />}
      title="Your session has ended"
      description="Sign in again to pick up where you left off. Nothing you were working on has been submitted."
      action={<Button onClick={onSignIn}>Sign in</Button>}
    />
  );
}

export interface UnauthorizedStateProps {
  readonly onSignIn?: () => void;
  readonly description?: string;
  readonly action?: React.ReactNode;
}

export function UnauthorizedState({
  onSignIn,
  description = "Sign in to see this page.",
  action,
}: UnauthorizedStateProps): React.JSX.Element {
  const resolved =
    action ??
    (onSignIn === undefined ? undefined : (
      <Button onClick={onSignIn} leadingIcon={<LogIn className="size-4" aria-hidden />}>
        Sign in
      </Button>
    ));

  return (
    <EmptyState
      icon={<LogIn className="size-5" />}
      title="Sign in required"
      description={description}
      {...(resolved === undefined ? {} : { action: resolved })}
    />
  );
}

export interface NotFoundStateProps {
  readonly title?: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
}

export function NotFoundState({
  title = "Page not found",
  description = "The address may be wrong, or the page may have moved.",
  action,
}: NotFoundStateProps): React.JSX.Element {
  return (
    <EmptyState
      icon={<Compass className="size-5" />}
      title={title}
      description={description}
      {...(action === undefined ? {} : { action })}
    />
  );
}

export interface MaintenanceStateProps {
  readonly title?: string;
  readonly description?: string;
  readonly onRetry?: () => void;
}

export function MaintenanceState({
  title = "Down for maintenance",
  description = "The platform is being updated. Your balance and open bets are not affected.",
  onRetry,
}: MaintenanceStateProps): React.JSX.Element {
  return (
    <EmptyState
      icon={<Wrench className="size-5" />}
      title={title}
      description={description}
      {...(onRetry === undefined
        ? {}
        : {
            action: (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
                leadingIcon={<RefreshCw className="size-3.5" aria-hidden />}
              >
                Check again
              </Button>
            ),
          })}
    />
  );
}
