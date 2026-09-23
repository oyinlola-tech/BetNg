import { useMemo } from "react";
import {
  displayClock,
  formatBroadcastClock,
  isFinished,
  isInPlay,
  toPresentationState,
  type ConnectionState,
  type MatchView,
  type PlayerMarkerView,
} from "@betng/ui-core";
import { useMatchNow } from "../../match/useMatchNow";
import { cn } from "../../lib/cn";
import { EventOverlay } from "./EventOverlay";
import { Pitch } from "./Pitch";
import { StadiumHeader } from "./StadiumHeader";
import { useMatchAnimation } from "./useMatchAnimation";

/*
 * The live match engine, assembled. Web, Shop, the Match Centre and TV all
 * mount this and differ only in the layout around it and how much detail they
 * ask for, which is why a change to how a goal looks reaches every surface at
 * once.
 *
 * It renders the match; it never advances it. Every score, minute, event and
 * position here came from the platform through the presentation state.
 */

export interface MatchStadiumProps {
  readonly match: MatchView;
  readonly connection: ConnectionState;
  readonly syncedAt?: number | undefined;
  /** Positions the platform reported. Without them the pitch shows the ball alone. */
  readonly players?: readonly PlayerMarkerView[] | undefined;
  readonly density?: "comfortable" | "compact";
  /** Names beside players. Off on mobile and dense surfaces by default. */
  readonly labelled?: boolean;
  readonly texture?: boolean;
  readonly className?: string | undefined;
}

export function MatchStadium({
  match,
  connection,
  syncedAt,
  players,
  density = "comfortable",
  labelled,
  texture = true,
  className,
}: MatchStadiumProps): React.JSX.Element {
  const now = useMatchNow(match.phase === "LIVE", undefined, 500);
  const clock = displayClock(match.clock, now);

  const state = useMemo(
    () =>
      toPresentationState({
        match,
        connection,
        syncedAt,
        now,
        players,
      }),
    [match, connection, syncedAt, now, players],
  );

  const { playing, reducedMotion } = useMatchAnimation(state.events);

  const live = isInPlay(match.phase);
  const finished = isFinished(match.phase);
  const compact = density === "compact";

  const clockText =
    match.phase === "HALFTIME"
      ? "HT"
      : finished
        ? "FT"
        : match.phase !== "LIVE"
          ? ""
          : clock === undefined
            ? "LIVE"
            : match.clock?.minuteLengthMs === undefined
              ? clock.label
              : formatBroadcastClock(clock.minute, clock.second);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-surface",
        className,
      )}
    >
      <StadiumHeader
        home={match.home}
        away={match.away}
        score={match.score}
        phase={match.phase}
        clockText={clockText}
        connection={state.connection}
        compact={compact}
      />

      <div className="relative aspect-[16/10] w-full sm:aspect-video">
        <Pitch
          home={match.home}
          away={match.away}
          players={state.players}
          ball={state.ball}
          playing={playing}
          reducedMotion={reducedMotion}
          labelled={labelled ?? !compact}
          texture={texture}
          subdued={match.phase === "HALFTIME" || finished}
        />

        <EventOverlay
          event={playing}
          homeName={match.home.name}
          awayName={match.away.name}
          reducedMotion={reducedMotion}
        />

        {!live && !finished && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="type-body rounded-sm border border-border bg-surface-elevated px-4 py-2 text-center font-medium text-text-primary">
              {match.phase === "POSTPONED" ||
              match.phase === "CANCELLED" ||
              match.phase === "SUSPENDED"
                ? (match.statusReason ?? "This match is not being played.")
                : "The pitch comes alive at kick-off."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
