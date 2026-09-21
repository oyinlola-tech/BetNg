import { useState } from "react";
import { cn } from "../lib/cn";

export interface ScoreValueProps {
  readonly value: number;
  readonly className?: string | undefined;
}

/** Pops when the platform reports a different score, never on first paint. */
export function ScoreValue({
  value,
  className,
}: ScoreValueProps): React.JSX.Element {
  const [initial] = useState(value);
  const [changed, setChanged] = useState(false);

  if (!changed && value !== initial) setChanged(true);

  return (
    <span
      key={value}
      className={cn(
        "type-score inline-block",
        changed && "animate-score-pop",
        className,
      )}
    >
      {value}
    </span>
  );
}
