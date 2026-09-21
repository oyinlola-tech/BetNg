import { phaseLabel, phaseTone, type MatchPhase } from "@betng/ui-core";
import { cn } from "../lib/cn";

export function LiveTag({
  phase,
  className,
  large = false,
}: {
  readonly phase: MatchPhase;
  readonly className?: string;
  readonly large?: boolean;
}): React.JSX.Element {
  const tone = phaseTone(phase);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.4em] rounded-xs font-display font-black uppercase tracking-caps",
        large
          ? "px-[0.7em] py-[0.25em] text-[1.1rem]"
          : "px-[0.55em] py-[0.2em] text-[0.8rem]",
        tone === "live" && "bg-live text-text-on-live",
        tone === "brand" && "bg-brand text-text-on-brand",
        tone === "warning" && "bg-warning text-text-on-status",
        (tone === "neutral" || tone === "muted") &&
          "bg-surface-sunken text-text-secondary",
        className,
      )}
    >
      {phase === "LIVE" && (
        <span
          aria-hidden
          className="size-[0.5em] rounded-full bg-white animate-pulse-live"
        />
      )}
      {phaseLabel(phase)}
    </span>
  );
}
