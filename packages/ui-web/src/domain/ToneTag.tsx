import type { StateTone } from "@betng/design-tokens";
import { cn } from "../lib/cn";
import { TONE_SUBTLE } from "./tone";

export interface ToneTagProps {
  readonly tone: StateTone;
  readonly icon?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string | undefined;
}

/** A status word with its tone. The word carries the meaning; the colour only supports it. */
export function ToneTag({
  tone,
  icon,
  children,
  className,
}: ToneTagProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-xs px-1.5 text-[10px] font-semibold uppercase tracking-caps whitespace-nowrap",
        TONE_SUBTLE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
