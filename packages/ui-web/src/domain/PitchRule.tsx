import { cn } from "../lib/cn";

export interface PitchRuleProps {
  readonly className?: string | undefined;
}

export function PitchRule({ className }: PitchRuleProps): React.JSX.Element {
  return (
    <div
      role="presentation"
      aria-hidden
      className={cn("flex items-center text-border-strong", className)}
    >
      <span className="h-px flex-1 bg-current" />
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <circle cx="12" cy="12" r="9.5" />
        <line x1="2.5" y1="12" x2="21.5" y2="12" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}
