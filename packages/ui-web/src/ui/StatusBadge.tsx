import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { statusTone } from "./statusTone";
import type { StatusTone } from "./statusTone";

export type { StatusTone } from "./statusTone";

export interface StatusBadgeProps {
  /** A platform status such as `SETTLED`. Supplies the tone, icon and label unless they are given. */
  readonly status?: string;
  readonly tone?: StatusTone;
  readonly icon?: LucideIcon;
  readonly pulse?: boolean;
  readonly className?: string;
  readonly children?: React.ReactNode;
}

const DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  live: "bg-live",
  pending: "bg-pending",
  void: "bg-void",
  suspended: "bg-suspended",
  neutral: "bg-text-muted",
  brand: "bg-brand",
};

const ICON: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  live: "text-live",
  pending: "text-pending",
  void: "text-void",
  suspended: "text-suspended",
  neutral: "text-text-muted",
  brand: "text-brand",
};

export function StatusBadge({
  status,
  tone,
  icon,
  pulse = false,
  className,
  children,
}: StatusBadgeProps): React.JSX.Element {
  const preset = status === undefined ? undefined : statusTone(status);
  const resolved = tone ?? preset?.tone ?? "neutral";
  const Icon = icon ?? preset?.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-text-primary",
        className,
      )}
    >
      {Icon === undefined ? (
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            DOT[resolved],
            pulse && "animate-pulse-live",
          )}
        />
      ) : (
        <Icon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            ICON[resolved],
            pulse && "animate-pulse-live",
          )}
        />
      )}
      {children ?? preset?.label}
    </span>
  );
}
