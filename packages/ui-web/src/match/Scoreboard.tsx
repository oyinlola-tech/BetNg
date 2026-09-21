import { CloudOff } from "lucide-react";
import {
  displayClock,
  formatBroadcastClock,
  formatCountdown,
  formatKickoffTime,
  formatMatchday,
  isUpcoming,
  phaseDescription,
  type MatchSummary,
} from "@betng/ui-core";
import { PhaseBadge } from "../domain/PhaseBadge";
import { useIsCompact } from "../hooks/useMediaQuery";
import { Stadium } from "../icons";
import { cn } from "../lib/cn";
import { TeamComparison } from "../teams";
import { ScoreValue } from "./ScoreValue";
import { STATE_WORD, matchOutcome, showsScore } from "./matchState";
import { useMatchNow } from "./useMatchNow";

const SIZES = {
  md: { crest: 64, compactCrest: 40, score: "text-4xl", time: "text-3xl" },
  lg: {
    crest: 96,
    compactCrest: 48,
    score: "text-4xl md:text-score",
    time: "text-3xl md:text-5xl",
  },
} as const;

export interface ScoreboardProps {
  readonly match: MatchSummary;
  readonly size?: keyof typeof SIZES;
  readonly now?: number | undefined;
  /** Marks the header as showing the last update received rather than current data. */
  readonly stale?: boolean;
  /** Replaces the default stale indicator. */
  readonly staleIndicator?: React.ReactNode;
  readonly showCompetition?: boolean;
  readonly showVenue?: boolean;
  readonly className?: string | undefined;
}

export function Scoreboard({
  match,
  size = "lg",
  now,
  stale = false,
  staleIndicator,
  showCompetition = true,
  showVenue = true,
  className,
}: ScoreboardProps): React.JSX.Element {
  const spec = SIZES[size];
  const compact = useIsCompact();
  const live = match.phase === "LIVE";
  const upcoming = isUpcoming(match.phase);
  const current = useMatchNow(!stale && (live || upcoming), now, 500);
  const clock = displayClock(
    match.clock,
    stale && match.clock !== undefined ? Date.parse(match.clock.asOf) : current,
  );
  const outcome = matchOutcome(match);
  const scored = showsScore(match);
  const remaining = Date.parse(match.kickoffAt) - current;

  const centre = scored ? (
    <p
      className="flex items-center justify-center gap-2 md:gap-3"
      aria-label={`${match.home.name} ${String(match.score.home)}, ${match.away.name} ${String(match.score.away)}`}
    >
      <ScoreValue
        value={match.score.home}
        className={cn(
          spec.score,
          outcome === "AWAY" ? "text-text-secondary" : "text-text-primary",
        )}
      />
      <span aria-hidden className="type-h2 text-text-muted">
        –
      </span>
      <ScoreValue
        value={match.score.away}
        className={cn(
          spec.score,
          outcome === "HOME" ? "text-text-secondary" : "text-text-primary",
        )}
      />
    </p>
  ) : (
    <p className={cn("type-score text-text-secondary", spec.time)}>
      {upcoming && remaining > 0 && remaining < 60 * 60 * 1000
        ? formatCountdown(remaining)
        : formatKickoffTime(match.kickoffAt)}
    </p>
  );

  return (
    <section
      aria-label={`${match.home.name} v ${match.away.name}`}
      className={cn("flex flex-col items-center gap-3", className)}
    >
      {showCompetition && (
        <p className="type-caption text-center">
          {match.leagueName} · {formatMatchday(match.matchday)}
        </p>
      )}
      <TeamComparison
        home={match.home}
        away={match.away}
        crestSize={compact ? spec.compactCrest : spec.crest}
        centre={
          <div className="flex flex-col items-center gap-2">
            <PhaseBadge
              phase={match.phase}
              label={live ? undefined : STATE_WORD[match.phase]}
              solid={live}
              size="md"
            />
            {centre}
            <p
              className={cn(
                "type-data",
                live ? "text-live" : "text-text-muted",
              )}
            >
              {live
                ? clock === undefined
                  ? ""
                  : match.clock?.minuteLengthMs === undefined
                    ? clock.label
                    : formatBroadcastClock(clock.minute, clock.second)
                : upcoming && !scored
                  ? "Kick-off"
                  : phaseDescription(match.phase)}
            </p>
          </div>
        }
      />
      {match.statusReason !== undefined && (
        <p className="type-small text-center text-text-secondary">
          {match.statusReason}
        </p>
      )}
      {showVenue && match.home.stadium !== "" && (
        <p className="type-small flex items-center gap-1.5 text-text-muted">
          <Stadium size={14} className="shrink-0" />
          {match.home.stadium}
        </p>
      )}
      {stale &&
        (staleIndicator ?? (
          <p
            role="status"
            className="type-caption inline-flex items-center gap-1 text-warning"
          >
            <CloudOff className="size-3" aria-hidden />
            Stale · showing the last update received
          </p>
        ))}
    </section>
  );
}
