import { memo } from "react";
import type {
  BallView,
  PlayerMarkerView,
  PresentationEvent,
  TeamView,
} from "@betng/ui-core";
import { cn } from "../../lib/cn";
import { Ball } from "./Ball";
import { PitchLines } from "./PitchLines";
import { PlayerMarker } from "./PlayerMarker";

/*
 * The playing surface: markings, players, ball. Memoised and given only what
 * it draws, so a ball moving does not re-render the scoreboard, the commentary
 * or the market list beside it.
 */

export interface PitchProps {
  readonly home: TeamView;
  readonly away: TeamView;
  readonly players: readonly PlayerMarkerView[];
  readonly ball: BallView;
  /** The event being animated, for the trail and the ball's travel time. */
  readonly playing: PresentationEvent | undefined;
  readonly reducedMotion?: boolean;
  /** Names and shirt numbers beside players. Off on small and dense surfaces. */
  readonly labelled?: boolean;
  readonly texture?: boolean;
  /** Dims the surface between halves and after full time. */
  readonly subdued?: boolean;
  readonly className?: string | undefined;
}

/** Long travel earns a trail; an ordinary restart does not. */
const TRAILED = new Set(["SHOT", "GOAL"]);

export const Pitch = memo(function Pitch({
  home,
  away,
  players,
  ball,
  playing,
  reducedMotion = false,
  labelled = false,
  texture = true,
  subdued = false,
  className,
}: PitchProps): React.JSX.Element {
  const travelMs = reducedMotion ? 0 : (playing?.animation === "SHOT" ? 700 : 850);
  const trail =
    !reducedMotion &&
    playing !== undefined &&
    TRAILED.has(playing.animation) &&
    playing.from !== undefined &&
    playing.to !== undefined
      ? { from: playing.from, to: playing.to }
      : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn(
        "size-full transition-opacity duration-[var(--bn-duration-slow)]",
        subdued && "opacity-55",
        className,
      )}
      aria-hidden
    >
      <PitchLines texture={texture} />

      {trail !== undefined && (
        <line
          key={playing?.id}
          x1={trail.from.x}
          y1={trail.from.y}
          x2={trail.to.x}
          y2={trail.to.y}
          stroke="rgb(255 255 255 / 0.55)"
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeDasharray="1.5 1.5"
          className="animate-fade-in"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {players.map((player) => (
        <PlayerMarker
          key={player.id}
          player={player}
          team={player.side === "HOME" ? home : away}
          labelled={labelled}
          durationMs={reducedMotion ? 0 : 700}
        />
      ))}

      <Ball
        at={ball.position}
        visible={ball.visible}
        durationMs={travelMs}
        moving={playing?.animation === "SHOT" || playing?.animation === "GOAL"}
      />
    </svg>
  );
});
