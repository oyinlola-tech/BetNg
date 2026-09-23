import { useId } from "react";
import type { PitchPoint } from "@betng/ui-core";

/*
 * The match ball, in pitch coordinates. It is drawn as a small sphere with
 * shaded panels rather than a plain dot, so it still reads as a football at TV
 * distance, and it travels by CSS transform so that moving it never costs a
 * React render of anything around it.
 *
 * It animates towards wherever the caller puts it; it never decides where to
 * go. Reduced motion removes the travel, not the ball.
 */

export interface BallProps {
  readonly at: PitchPoint;
  readonly visible: boolean;
  /** Travel time in ms. 0 places the ball instantly. */
  readonly durationMs?: number;
  /** A hint that the ball is in flight, for the trail. */
  readonly moving?: boolean;
  readonly radius?: number;
  readonly className?: string | undefined;
}

export function Ball({
  at,
  visible,
  durationMs = 800,
  moving = false,
  radius = 1.5,
  className,
}: BallProps): React.JSX.Element {
  const id = useId();
  const shade = `${id}-shade`;

  return (
    <g
      className={className}
      style={{
        transform: `translate(${String(at.x)}px, ${String(at.y)}px)`,
        transition:
          durationMs <= 0
            ? "none"
            : `transform ${String(durationMs)}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms linear`,
        opacity: visible ? 1 : 0,
      }}
      aria-hidden
    >
      <defs>
        <radialGradient id={shade} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f2f2f2" />
          <stop offset="100%" stopColor="#c8ccd1" />
        </radialGradient>
      </defs>

      {/* Shadow on the turf, slightly offset and flattened */}
      <ellipse
        cx={radius * 0.25}
        cy={radius * 0.95}
        rx={radius * 0.95}
        ry={radius * 0.42}
        fill="rgb(0 0 0 / 0.3)"
      />

      {moving && (
        <circle
          r={radius * 2.1}
          fill="none"
          stroke="rgb(255 255 255 / 0.28)"
          strokeWidth={radius * 0.22}
        />
      )}

      <circle r={radius} fill={`url(#${shade})`} />

      {/* Panels: the centre pentagon and three of its neighbours, enough to
          read as a football without turning into mush at small sizes. */}
      <g fill="#14181d" transform={`scale(${String(radius / 1.5)})`}>
        <path d="M0 -0.62 L0.59 -0.19 L0.36 0.5 L-0.36 0.5 L-0.59 -0.19 Z" />
        <path d="M0 -1.5 L0.5 -1.16 L0 -0.72 L-0.5 -1.16 Z" opacity="0.85" />
        <path d="M1.32 0.3 L1.02 0.92 L0.46 0.62 L0.7 0.02 Z" opacity="0.85" />
        <path d="M-1.32 0.3 L-0.7 0.02 L-0.46 0.62 L-1.02 0.92 Z" opacity="0.85" />
      </g>
    </g>
  );
}
