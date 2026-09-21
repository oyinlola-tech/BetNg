import { cn } from "../lib/cn";

export interface LiveDotProps {
  readonly className?: string | undefined;
}

export function LiveDot({ className }: LiveDotProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full bg-live animate-pulse-live",
        className,
      )}
    />
  );
}
