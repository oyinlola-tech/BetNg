import type { StateTone } from "@betng/design-tokens";
import { cn } from "../lib/cn";

export interface BadgeProps {
  readonly tone?: StateTone;
  readonly solid?: boolean;
  readonly size?: "sm" | "md";
  readonly icon?: React.ReactNode;
  readonly dot?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}

const SUBTLE: Record<StateTone, string> = {
  live: "bg-live-subtle text-live",
  brand: "bg-brand-subtle text-brand",
  neutral: "bg-surface-sunken text-text-secondary",
  muted: "bg-surface-sunken text-text-muted",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
  pending: "bg-pending-subtle text-pending",
  void: "bg-void-subtle text-void",
  suspended: "bg-suspended-subtle text-suspended",
};

const SOLID: Record<StateTone, string> = {
  live: "bg-live text-text-on-live",
  brand: "bg-brand text-text-on-brand",
  neutral: "bg-text-secondary text-background",
  muted: "bg-text-muted text-background",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  info: "bg-info text-white",
  pending: "bg-pending text-white",
  void: "bg-void text-white",
  suspended: "bg-suspended text-white",
};

export function Badge({
  tone = "neutral",
  solid = false,
  size = "sm",
  icon,
  dot = false,
  className,
  children,
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs font-semibold uppercase tracking-caps whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
        size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs",
        solid ? SOLID[tone] : SUBTLE[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-current",
            tone === "live" && "animate-pulse-live",
          )}
        />
      )}
      {icon}
      {children}
    </span>
  );
}
