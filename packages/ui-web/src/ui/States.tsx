import { Inbox, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../lib/cn";
import { presentError } from "../lib/errors";

export interface EmptyStateProps {
  readonly icon?: React.ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly compact?: boolean;
  readonly className?: string | undefined;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-surface-sunken text-text-muted">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="mt-3 text-md font-semibold text-text-primary">{title}</p>
      {description !== undefined && (
        <p className="mt-1 max-w-xs text-sm text-text-muted">{description}</p>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  readonly error: unknown;
  readonly onRetry?: () => void;
  readonly compact?: boolean;
  readonly className?: string | undefined;
}

export function ErrorState({
  error,
  onRetry,
  compact = false,
  className,
}: ErrorStateProps): React.JSX.Element {
  const presented = presentError(error);
  const offline = presented.title === "Connection problem";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-danger-subtle text-danger">
        {offline ? (
          <WifiOff className="size-5" />
        ) : (
          <RefreshCw className="size-5" />
        )}
      </div>
      <p className="mt-3 text-md font-semibold text-text-primary">
        {presented.title}
      </p>
      <p className="mt-1 max-w-xs text-sm text-text-muted">
        {presented.message}
      </p>
      {onRetry !== undefined && presented.retryable && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={onRetry}
          icon={<RefreshCw className="size-3.5" />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
