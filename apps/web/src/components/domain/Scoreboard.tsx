import {
  formatBroadcastClock,
  isFinished,
  isInPlay,
  isUpcoming,
  matchClock,
  phaseDescription,
  type MatchSummary,
} from "@betng/ui-core";
import { useNow } from "../../hooks/useNow";
import { cn } from "../../lib/cn";
import { Countdown } from "./Countdown";
import { PhaseBadge } from "./PhaseBadge";
import { TeamBadge } from "./TeamBadge";

export interface ScoreboardProps {
  readonly match: MatchSummary;
  readonly size?: "md" | "lg";
  readonly className?: string;
}

export function Scoreboard({
  match,
  size = "lg",
  className,
}: ScoreboardProps): React.JSX.Element {
  const now = useNow(500);
  const clock = matchClock(match.kickoffAt, now);
  const live = isInPlay(match.phase);
  const finished = isFinished(match.phase);
  const large = size === "lg";

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6",
        className,
      )}
    >
      <Side team={match.home} align="end" large={large} />
      <div className="flex flex-col items-center gap-1.5">
        <PhaseBadge phase={match.phase} solid={live} size="md" />
        {live || finished ? (
          <p
            className={cn(
              "font-display font-black tabular tracking-tight",
              large ? "text-score md:text-score-lg" : "text-4xl",
              finished && "text-text-secondary",
            )}
          >
            {match.score.home}
            <span className="mx-2 font-sans font-medium text-text-muted md:mx-3">
              –
            </span>
            {match.score.away}
          </p>
        ) : (
          <Countdown
            to={match.kickoffAt}
            className={cn(
              "font-display font-black tracking-tight text-text-secondary",
              large ? "text-4xl md:text-5xl" : "text-3xl",
            )}
          />
        )}
        <p
          className={cn(
            "tabular text-sm font-medium",
            live ? "text-live" : "text-text-muted",
          )}
        >
          {live
            ? match.phase === "HALFTIME"
              ? "Half time"
              : formatBroadcastClock(clock.minute, clock.second)
            : isUpcoming(match.phase)
              ? "Kick-off"
              : phaseDescription(match.phase)}
        </p>
      </div>
      <Side team={match.away} align="start" large={large} />
    </div>
  );
}

function Side({
  team,
  align,
  large,
}: {
  readonly team: MatchSummary["home"];
  readonly align: "start" | "end";
  readonly large: boolean;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 md:flex-row md:gap-4",
        align === "end"
          ? "md:justify-end md:text-right"
          : "md:flex-row-reverse md:justify-end md:text-left",
      )}
    >
      <TeamBadge team={team} size={large ? "xl" : "lg"} />
      <div className="min-w-0 text-center md:text-inherit">
        <p
          className={cn(
            "truncate font-display font-bold tracking-tight",
            large ? "text-lg md:text-2xl" : "text-md md:text-lg",
          )}
        >
          {team.name}
        </p>
        <p className="truncate text-sm text-text-muted">{team.city}</p>
      </div>
    </div>
  );
}
