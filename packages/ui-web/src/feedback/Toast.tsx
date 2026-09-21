import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BellRing,
  CheckCircle2,
  Info,
  OctagonAlert,
  Ticket,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export type ToastTone = "success" | "info" | "warning" | "error" | "system";
export type ToastKind = "bet" | "wallet" | "match";

export interface ToastAction {
  readonly label: string;
  readonly onSelect: () => void;
}

export interface ToastProps {
  readonly title: string;
  readonly message?: string;
  readonly tone?: ToastTone;
  readonly kind?: ToastKind;
  readonly action?: ToastAction;
  /** Milliseconds before auto-dismiss. `0` keeps the toast until it is dismissed. */
  readonly duration?: number;
  readonly onDismiss: () => void;
  readonly className?: string;
}

const TONE_ICONS: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: OctagonAlert,
  system: BellRing,
};

const KIND_ICONS: Record<ToastKind, LucideIcon> = {
  bet: Ticket,
  wallet: Wallet,
  match: Activity,
};

const BORDER: Record<ToastTone, string> = {
  success: "border-success/40",
  info: "border-info/40",
  warning: "border-warning/40",
  error: "border-danger/40",
  system: "border-border-strong",
};

const ICON: Record<ToastTone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  error: "text-danger",
  system: "text-text-secondary",
};

const TONE_LABEL: Record<ToastTone, string> = {
  success: "Success",
  info: "Information",
  warning: "Warning",
  error: "Error",
  system: "System",
};

export function Toast({
  title,
  message,
  tone = "info",
  kind,
  action,
  duration = 4200,
  onDismiss,
  className,
}: ToastProps): React.JSX.Element {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const dismiss = useRef(onDismiss);

  dismiss.current = onDismiss;

  useEffect(() => {
    if (paused || duration <= 0) return;

    const startedAt = Date.now();
    const timer = setTimeout(() => {
      dismiss.current();
    }, remaining.current);

    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        800,
        remaining.current - (Date.now() - startedAt),
      );
    };
  }, [paused, duration]);

  const Icon = kind === undefined ? TONE_ICONS[tone] : KIND_ICONS[kind];
  const urgent = tone === "error";

  return (
    <div
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic
      data-tone={tone}
      onMouseEnter={() => {
        setPaused(true);
      }}
      onMouseLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={() => {
        setPaused(false);
      }}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-surface-elevated p-3 shadow-lg animate-toast-in",
        BORDER[tone],
        className,
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", ICON[tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">
          <span className="sr-only">{TONE_LABEL[tone]}: </span>
          {title}
        </p>
        {message !== undefined && (
          <p className="mt-0.5 text-sm text-text-secondary">{message}</p>
        )}
        {action !== undefined && (
          <button
            type="button"
            onClick={() => {
              action.onSelect();
              onDismiss();
            }}
            className="mt-1.5 rounded-xs text-sm font-semibold text-brand hover:text-brand-hover focus-ring"
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="rounded-sm p-1 text-text-muted hover:text-text-primary focus-ring"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
