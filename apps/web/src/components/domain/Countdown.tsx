import { formatCountdown } from "@betng/ui-core";
import { useNow } from "../../hooks/useNow";
import { cn } from "../../lib/cn";

export function Countdown({ to, className, prefix }: { readonly to: string; readonly className?: string; readonly prefix?: string }): React.JSX.Element {
  const now = useNow(1000);
  const remaining = Date.parse(to) - now;

  return (
    <span className={cn("tabular", className)} aria-live="off">
      {prefix}
      {formatCountdown(remaining)}
    </span>
  );
}
