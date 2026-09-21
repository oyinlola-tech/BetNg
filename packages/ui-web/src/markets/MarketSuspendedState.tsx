import { Lock } from "lucide-react";
import { cn } from "../lib/cn";

export interface MarketSuspendedStateProps {
  readonly reason?: string | undefined;
  readonly title?: string;
  readonly className?: string | undefined;
}

export function MarketSuspendedState({
  reason,
  title = "Market suspended",
  className,
}: MarketSuspendedStateProps): React.JSX.Element {
  return (
    <p
      role="status"
      className={cn(
        "type-small flex items-center gap-2 rounded-sm bg-suspended-subtle px-3 py-2 text-suspended",
        className,
      )}
    >
      <Lock className="size-3.5 shrink-0" aria-hidden />
      <span className="font-semibold">{title}</span>
      {reason !== undefined && (
        <span className="min-w-0 truncate text-text-secondary">{reason}</span>
      )}
    </p>
  );
}
