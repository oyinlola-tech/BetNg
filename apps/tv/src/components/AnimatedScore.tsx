import { useCountTo } from "../hooks/useCountTo";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { cn } from "../lib/cn";

export function AnimatedScore({ value, className }: { readonly value: number; readonly className?: string }): React.JSX.Element {
  const reduced = useReducedMotion();
  const shown = useCountTo(value, reduced);

  return (
    <span className={cn("inline-block overflow-hidden tabular", className)}>
      <span key={shown} data-motion={reduced ? "reduced" : "full"} className={cn("inline-block", !reduced && "animate-score-roll")}>
        {shown}
      </span>
    </span>
  );
}
