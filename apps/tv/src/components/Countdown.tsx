import { formatCountdown } from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";

export function Countdown({
  to,
  className,
}: {
  readonly to: string;
  readonly className?: string;
}): React.JSX.Element {
  const now = useNow(1000);

  return (
    <span className={cn("tabular", className)}>
      {formatCountdown(Date.parse(to) - now)}
    </span>
  );
}
