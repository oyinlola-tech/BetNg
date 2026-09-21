import { formatCountdown } from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";

export interface CountdownProps {
  /** A platform-supplied instant. */
  readonly to: string;
  readonly className?: string | undefined;
  readonly prefix?: string | undefined;
  readonly now?: number | undefined;
}

export function Countdown({
  to,
  className,
  prefix,
  now,
}: CountdownProps): React.JSX.Element {
  const ticking = useNow(1000);
  const remaining = Date.parse(to) - (now ?? ticking);

  return (
    <span className={cn("tabular", className)} aria-live="off">
      {prefix}
      {formatCountdown(remaining)}
    </span>
  );
}
