import { cn } from "../lib/cn";

export type StatusTone = "success" | "warning" | "danger" | "brand" | "live" | "neutral";

const DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  brand: "bg-brand",
  live: "bg-live",
  neutral: "bg-text-muted",
};

export function StatusBadge({ tone, children, pulse = false, className }: { readonly tone: StatusTone; readonly children: React.ReactNode; readonly pulse?: boolean; readonly className?: string }): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-text-primary", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", DOT[tone], pulse && "animate-pulse-live")} aria-hidden />
      {children}
    </span>
  );
}
