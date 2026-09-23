import { useId } from "react";

/*
 * The markings of a football pitch, drawn once in the shared 0–100 coordinate
 * space that @betng/ui-core's pitch geometry uses: x=0 is the home goal line,
 * x=100 the away goal line, y=0 the near touchline. Every proportion below is
 * the real one scaled to a 105m x 68m pitch, so the penalty area, the D and
 * the centre circle sit where a viewer expects them.
 *
 * Nothing here is interactive or stateful; it renders identically on web,
 * shop and TV and is the reason those surfaces cannot drift apart visually.
 */

/** Pitch proportions, as percentages of the 105m x 68m playing area. */
const AREA_DEPTH = 15.7;
const AREA_HALF_HEIGHT = 24.1;
const GOAL_AREA_DEPTH = 5.2;
const GOAL_AREA_HALF_HEIGHT = 11.1;
const PENALTY_SPOT = 10.5;
const CENTRE_RADIUS_X = 8.7;
const CENTRE_RADIUS_Y = 13.5;
const GOAL_DEPTH = 1.7;
const GOAL_HALF_HEIGHT = 5.4;
const CORNER_ARC = 1.4;

export interface PitchLinesProps {
  /** Adds mown stripes and a vignette. Off for the flattest, densest surfaces. */
  readonly texture?: boolean;
  readonly className?: string | undefined;
}

export function PitchLines({
  texture = true,
  className,
}: PitchLinesProps): React.JSX.Element {
  const id = useId();
  const stripes = `${id}-stripes`;
  const vignette = `${id}-vignette`;

  return (
    <g className={className}>
      <defs>
        <pattern
          id={stripes}
          width="12.5"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <rect width="6.25" height="100" className="fill-pitch-stripe" />
        </pattern>
        <radialGradient id={vignette} cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="rgb(0 0 0 / 0)" />
          <stop offset="100%" stopColor="rgb(0 0 0 / 0.28)" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" className="fill-pitch" />
      {texture && <rect width="100" height="100" fill={`url(#${stripes})`} />}

      <g
        className="fill-none stroke-pitch-line"
        strokeWidth="0.35"
        vectorEffect="non-scaling-stroke"
      >
        {/* Touchlines and goal lines */}
        <rect x="0.6" y="0.6" width="98.8" height="98.8" />

        {/* Halfway line and centre circle. The circle is an ellipse because the
            coordinate space is square while the pitch is not. */}
        <line x1="50" y1="0.6" x2="50" y2="99.4" />
        <ellipse
          cx="50"
          cy="50"
          rx={CENTRE_RADIUS_X}
          ry={CENTRE_RADIUS_Y}
        />

        {/* Penalty areas */}
        <rect
          x="0.6"
          y={50 - AREA_HALF_HEIGHT}
          width={AREA_DEPTH}
          height={AREA_HALF_HEIGHT * 2}
        />
        <rect
          x={99.4 - AREA_DEPTH}
          y={50 - AREA_HALF_HEIGHT}
          width={AREA_DEPTH}
          height={AREA_HALF_HEIGHT * 2}
        />

        {/* Goal areas */}
        <rect
          x="0.6"
          y={50 - GOAL_AREA_HALF_HEIGHT}
          width={GOAL_AREA_DEPTH}
          height={GOAL_AREA_HALF_HEIGHT * 2}
        />
        <rect
          x={99.4 - GOAL_AREA_DEPTH}
          y={50 - GOAL_AREA_HALF_HEIGHT}
          width={GOAL_AREA_DEPTH}
          height={GOAL_AREA_HALF_HEIGHT * 2}
        />

        {/* The D: the arc of the centre circle's radius outside each area */}
        <path
          d={`M ${String(AREA_DEPTH + 0.6)} ${String(50 - 7.4)} A ${String(CENTRE_RADIUS_X)} ${String(CENTRE_RADIUS_Y)} 0 0 1 ${String(AREA_DEPTH + 0.6)} ${String(50 + 7.4)}`}
        />
        <path
          d={`M ${String(99.4 - AREA_DEPTH)} ${String(50 - 7.4)} A ${String(CENTRE_RADIUS_X)} ${String(CENTRE_RADIUS_Y)} 0 0 0 ${String(99.4 - AREA_DEPTH)} ${String(50 + 7.4)}`}
        />

        {/* Corner arcs */}
        <path d={`M 0.6 ${String(0.6 + CORNER_ARC * 1.5)} A ${String(CORNER_ARC)} ${String(CORNER_ARC * 1.5)} 0 0 0 ${String(0.6 + CORNER_ARC)} 0.6`} />
        <path d={`M ${String(99.4 - CORNER_ARC)} 0.6 A ${String(CORNER_ARC)} ${String(CORNER_ARC * 1.5)} 0 0 0 99.4 ${String(0.6 + CORNER_ARC * 1.5)}`} />
        <path d={`M 0.6 ${String(99.4 - CORNER_ARC * 1.5)} A ${String(CORNER_ARC)} ${String(CORNER_ARC * 1.5)} 0 0 1 ${String(0.6 + CORNER_ARC)} 99.4`} />
        <path d={`M ${String(99.4 - CORNER_ARC)} 99.4 A ${String(CORNER_ARC)} ${String(CORNER_ARC * 1.5)} 0 0 1 99.4 ${String(99.4 - CORNER_ARC * 1.5)}`} />
      </g>

      {/* Penalty and centre spots */}
      <g className="fill-pitch-line">
        <circle cx={PENALTY_SPOT} cy="50" r="0.5" />
        <circle cx={100 - PENALTY_SPOT} cy="50" r="0.5" />
        <circle cx="50" cy="50" r="0.5" />
      </g>

      {/* Goals, drawn outside the goal line */}
      <g
        className="fill-none stroke-pitch-line"
        strokeWidth="0.3"
        vectorEffect="non-scaling-stroke"
      >
        <rect
          x={0.6 - GOAL_DEPTH}
          y={50 - GOAL_HALF_HEIGHT}
          width={GOAL_DEPTH}
          height={GOAL_HALF_HEIGHT * 2}
        />
        <rect
          x="99.4"
          y={50 - GOAL_HALF_HEIGHT}
          width={GOAL_DEPTH}
          height={GOAL_HALF_HEIGHT * 2}
        />
      </g>

      {texture && (
        <rect
          width="100"
          height="100"
          fill={`url(#${vignette})`}
          pointerEvents="none"
        />
      )}
    </g>
  );
}
