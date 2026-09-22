import {
  Clock,
  Inbox,
  Lock,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DataSourceErrorCode } from "@betng/ui-core";
import { Button } from "./Button";
import { emptyPresets } from "./emptyPresets";
import type { EmptyPresetName } from "./emptyPresets";
import { cn } from "../lib/cn";
import { presentError } from "../lib/errors";
import { ErrorHelp, errorHelpTopic } from "../feedback/ErrorHelp";
import type { ErrorTone } from "../lib/errors";

export interface EmptyStateProps {
  readonly preset?: EmptyPresetName;
  readonly icon?: React.ReactNode;
  readonly title?: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly compact?: boolean;
  readonly className?: string | undefined;
}

export function EmptyState({
  preset,
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps): React.JSX.Element {
  const base = preset === undefined ? undefined : emptyPresets[preset];
  const PresetIcon = base?.icon ?? Inbox;
  const text = description ?? base?.description;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className="flex size-10 items-center justify-center rounded-md bg-surface-sunken text-text-muted"
      >
        {icon ?? <PresetIcon className="size-5" />}
      </div>
      <p className="mt-3 text-md font-semibold text-text-primary">
        {title ?? base?.title ?? "Nothing to show"}
      </p>
      {text !== undefined && (
        <p className="mt-1 max-w-xs text-sm text-text-muted">{text}</p>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  readonly error: unknown;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly action?: React.ReactNode;
  readonly compact?: boolean;
  readonly className?: string | undefined;
}

const CODE_ICONS: Partial<Record<DataSourceErrorCode, LucideIcon>> = {
  NETWORK: WifiOff,
  OFFLINE: WifiOff,
  TIMEOUT: Clock,
  RATE_LIMITED: Clock,
  FORBIDDEN: Lock,
  UNAUTHENTICATED: Lock,
  SESSION_EXPIRED: Lock,
};

const TONES: Record<ErrorTone, string> = {
  danger: "bg-danger-subtle text-danger",
  warning: "bg-warning-subtle text-warning",
  info: "bg-info-subtle text-info",
};

export function ErrorState({
  error,
  onRetry,
  retryLabel = "Try again",
  action,
  compact = false,
  className,
}: ErrorStateProps): React.JSX.Element {
  const presented = presentError(error);
  const Icon =
    (presented.code === undefined ? undefined : CODE_ICONS[presented.code]) ??
    TriangleAlert;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "flex size-10 items-center justify-center rounded-md",
          TONES[presented.tone],
        )}
      >
        <Icon className="size-5" />
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
          leadingIcon={<RefreshCw className="size-3.5" aria-hidden />}
        >
          {retryLabel}
        </Button>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
      <ErrorHelp topic={errorHelpTopic(presented.code)} className="mt-3" />
      {presented.requestId !== undefined && (
        <p className="mt-4 font-mono text-xs text-text-muted">
          Support reference{" "}
          <span className="select-all text-text-secondary">
            {presented.requestId}
          </span>
        </p>
      )}
    </div>
  );
}
