import { Clock } from "lucide-react";
import { formatAge } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { useNow } from "../hooks/useNow";
import { toIso } from "./ConnectionStrip";
import type { Timestamp } from "./ConnectionStrip";

export interface StaleBadgeProps {
  readonly updatedAt?: Timestamp | undefined;
  /** Hides the badge until the data is at least this old. `0` always shows it. */
  readonly staleAfterMs?: number;
  readonly className?: string;
}

export function StaleBadge({
  updatedAt,
  staleAfterMs = 0,
  className,
}: StaleBadgeProps): React.JSX.Element | null {
  const now = useNow(1000);
  const iso = updatedAt === undefined ? undefined : toIso(updatedAt);

  if (iso !== undefined && now - Date.parse(iso) < staleAfterMs) return null;

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-xs bg-warning-subtle px-1.5 text-xs font-semibold whitespace-nowrap text-warning",
        className,
      )}
    >
      <Clock aria-hidden className="size-3 shrink-0" />
      Stale
      {iso !== undefined && (
        <span className="tabular font-medium">
          · updated {formatAge(iso, now)}
        </span>
      )}
    </span>
  );
}
