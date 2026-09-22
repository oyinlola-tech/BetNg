import { displayClock, formatBroadcastClock, isInPlay, type MatchSummary } from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { liveClockNow, polledClockNow, useDataHealth } from "../lib/dataHealth";
import { cn } from "../lib/cn";

export function MatchClock({ match, realtime = false, className }: { readonly match: Pick<MatchSummary, "phase" | "clock">; readonly realtime?: boolean; readonly className?: string }): React.JSX.Element {
  const now = useNow(500);
  const health = useDataHealth();
  const clock = displayClock(match.clock, realtime ? liveClockNow(health.realtimeDownSince, now) : polledClockNow(health, now));
  const live = isInPlay(match.phase);

  return (
    <span className={cn("font-display font-black tabular", live ? "text-live" : "text-text-muted", className)}>
      {match.phase === "HALFTIME" ? "HT" : clock === undefined ? (live ? "LIVE" : "") : formatBroadcastClock(clock.minute, clock.second)}
    </span>
  );
}
