import { Ban, CalendarX, CirclePause, Clock, Lock } from "lucide-react";
import {
  phaseDescription,
  phaseLabel,
  phaseTone,
  type MatchPhase,
} from "@betng/ui-core";
import { cn } from "../lib/cn";
import { LiveDot } from "./LiveDot";
import { TONE_SOLID, TONE_SUBTLE } from "./tone";

export { LiveDot } from "./LiveDot";

type PhaseIcon = React.ComponentType<{
  readonly className?: string;
  readonly "aria-hidden"?: boolean;
}>;

const PHASE_ICON: Readonly<Partial<Record<MatchPhase, PhaseIcon>>> = {
  BETTING_CLOSED: Lock,
  POSTPONED: CalendarX,
  SUSPENDED: CirclePause,
  CANCELLED: Ban,
  DELAYED: Clock,
};

const SIZE = {
  sm: "h-5 px-1.5 text-[10px]",
  md: "h-6 px-2 text-xs",
} as const;

export interface PhaseBadgeProps {
  readonly phase: MatchPhase;
  /** Overrides the short platform label, e.g. with the full word. */
  readonly label?: string | undefined;
  /** A minute the platform reported. Drawn only while live. */
  readonly minute?: number | undefined;
  /** A formatted clock label such as `45+2'`; wins over `minute`. */
  readonly clock?: string | undefined;
  readonly solid?: boolean;
  readonly size?: keyof typeof SIZE;
  readonly className?: string | undefined;
}

export function PhaseBadge({
  phase,
  label,
  minute,
  clock,
  solid = false,
  size = "sm",
  className,
}: PhaseBadgeProps): React.JSX.Element {
  const live = phase === "LIVE";
  const tone = phaseTone(phase);
  const Icon = PHASE_ICON[phase];
  const time = clock ?? (minute === undefined ? undefined : `${String(minute)}'`);

  return (
    <span
      title={phaseDescription(phase)}
      className={cn(
        "inline-flex items-center gap-1 rounded-xs font-semibold uppercase tracking-caps whitespace-nowrap",
        SIZE[size],
        solid ? TONE_SOLID[tone] : TONE_SUBTLE[tone],
        className,
      )}
    >
      {live && <LiveDot className={solid ? "bg-text-on-live" : undefined} />}
      {Icon !== undefined && <Icon className="size-3" aria-hidden />}
      {label ?? phaseLabel(phase)}
      {live && time !== undefined && time !== "" && (
        <span className="tabular">{time}</span>
      )}
    </span>
  );
}
