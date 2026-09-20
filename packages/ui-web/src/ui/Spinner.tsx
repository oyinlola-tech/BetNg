import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

export function Spinner({
  className,
  label = "Loading",
}: {
  readonly className?: string;
  readonly label?: string;
}): React.JSX.Element {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn("size-5 animate-spin text-text-muted", className)}
    />
  );
}
