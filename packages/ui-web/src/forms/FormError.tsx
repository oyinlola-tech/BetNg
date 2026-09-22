import { Info, OctagonAlert, RefreshCw, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ErrorHelp, errorHelpTopic } from "../feedback/ErrorHelp";
import { cn } from "../lib/cn";
import { presentError } from "../lib/errors";
import type { ErrorTone } from "../lib/errors";

export interface FormErrorProps {
  readonly error: unknown;
  readonly className?: string;
  /** For a failed read only; shown when the failure is one a retry can fix. Never pass it for a money command. */
  readonly onRetry?: () => void;
}

const TONES: Record<ErrorTone, string> = {
  danger: "border-danger/40 bg-danger-subtle text-danger",
  warning: "border-warning/40 bg-warning-subtle text-warning",
  info: "border-info/40 bg-info-subtle text-info",
};

const ICONS: Record<ErrorTone, LucideIcon> = {
  danger: OctagonAlert,
  warning: TriangleAlert,
  info: Info,
};

export function FormError({
  error,
  className,
  onRetry,
}: FormErrorProps): React.JSX.Element | null {
  if (error === undefined || error === null) return null;

  const presented = presentError(error);
  const Icon = ICONS[presented.tone];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-sm border px-3 py-2.5",
        TONES[presented.tone],
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{presented.title}</p>
        <p className="text-sm text-text-secondary">{presented.message}</p>
        {((onRetry !== undefined && presented.retryable) || errorHelpTopic(presented.code) !== undefined) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 empty:hidden">
            {onRetry !== undefined && presented.retryable && (
              <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-xs text-sm font-semibold text-text-primary underline underline-offset-2 focus-ring">
                <RefreshCw aria-hidden className="size-3.5" />
                Try again
              </button>
            )}
            <ErrorHelp topic={errorHelpTopic(presented.code)} />
          </div>
        )}
        {presented.requestId !== undefined && (
          <p className="mt-1 font-mono text-xs text-text-muted">
            Support reference{" "}
            <span className="select-all">{presented.requestId}</span>
          </p>
        )}
      </div>
    </div>
  );
}
