import { phaseLabel, phaseTone, type MatchPhase } from "@betng/ui-core";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";

export function LiveDot({
  className,
}: {
  readonly className?: string | undefined;
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5 rounded-full bg-live animate-pulse-live",
        className,
      )}
    />
  );
}

export interface PhaseBadgeProps {
  readonly phase: MatchPhase;
  readonly minute?: number;
  readonly solid?: boolean;
  readonly size?: "sm" | "md";
}

export function PhaseBadge({
  phase,
  minute,
  solid = false,
  size = "sm",
}: PhaseBadgeProps): React.JSX.Element {
  const live = phase === "LIVE";

  return (
    <Badge tone={phaseTone(phase)} solid={solid} size={size}>
      {live && <LiveDot className={solid ? "bg-white" : undefined} />}
      {phaseLabel(phase)}
      {live && minute !== undefined && (
        <span className="tabular">{minute}'</span>
      )}
    </Badge>
  );
}
