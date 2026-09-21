import { cn } from "../lib/cn";
import type { StatusTone } from "./StatusBadge";

export interface ActivityItem {
  readonly id: string;
  readonly title: React.ReactNode;
  readonly detail?: React.ReactNode;
  readonly time: string;
  readonly tone?: StatusTone;
  readonly icon?: React.ReactNode;
}

const TONE: Record<StatusTone, string> = {
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  brand: "bg-brand-subtle text-brand",
  live: "bg-live-subtle text-live",
  neutral: "bg-surface-sunken text-text-muted",
  info: "bg-info-subtle text-info",
  pending: "bg-pending-subtle text-pending",
  void: "bg-void-subtle text-void",
  suspended: "bg-suspended-subtle text-suspended",
};

export function ActivityFeed({ items, className }: { readonly items: readonly ActivityItem[]; readonly className?: string }): React.JSX.Element {
  return (
    <ol className={cn("divide-y divide-border", className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
          <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm [&>svg]:size-3.5", TONE[item.tone ?? "neutral"])} aria-hidden>
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base text-text-primary">{item.title}</p>
            {item.detail !== undefined && <p className="truncate text-sm text-text-muted">{item.detail}</p>}
          </div>
          <time className="shrink-0 text-sm tabular text-text-muted">{item.time}</time>
        </li>
      ))}
    </ol>
  );
}
