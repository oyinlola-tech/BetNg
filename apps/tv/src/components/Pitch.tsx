import { isInPlay, routeMatchEvents, type MatchView } from "@betng/ui-core";
import { cn } from "../lib/cn";

/*
 * TV's pitch. The markings are drawn here because TV does not take a dependency
 * on the web component library, but where the ball is comes from the shared
 * event router in @betng/ui-core — the same routing the web Match Centre and
 * the Shop live view use. TV therefore cannot show the ball somewhere the other
 * surfaces would not, and it decides nothing about the match itself.
 *
 * Coordinates are the shared 0–100 pitch space, scaled here into a 16:9 frame.
 */
export function Pitch({
  match,
  className,
}: {
  readonly match: MatchView;
  readonly className?: string;
}): React.JSX.Element {
  const live = isInPlay(match.phase);
  const events = routeMatchEvents(match.events, match);
  const ball = [...events].reverse().find((event) => event.to !== undefined)?.to;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <pattern id="tv-stripes" width="12.5" height="100" patternUnits="userSpaceOnUse">
          <rect width="6.25" height="100" fill="rgba(255,255,255,0.03)" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="#0F2E20" />
      <rect width="100" height="100" fill="url(#tv-stripes)" />
      <g fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.35" vectorEffect="non-scaling-stroke">
        <rect x="0.6" y="0.6" width="98.8" height="98.8" />
        <line x1="50" y1="0.6" x2="50" y2="99.4" />
        <ellipse cx="50" cy="50" rx="8.7" ry="13.5" />
        <rect x="0.6" y="25.9" width="15.7" height="48.2" />
        <rect x="83.7" y="25.9" width="15.7" height="48.2" />
        <rect x="0.6" y="38.9" width="5.2" height="22.2" />
        <rect x="94.2" y="38.9" width="5.2" height="22.2" />
        <path d="M16.3 42.6 A 8.7 13.5 0 0 1 16.3 57.4" />
        <path d="M83.7 42.6 A 8.7 13.5 0 0 0 83.7 57.4" />
      </g>
      <g fill="rgba(255,255,255,0.5)">
        <circle cx="10.5" cy="50" r="0.5" />
        <circle cx="89.5" cy="50" r="0.5" />
        <circle cx="50" cy="50" r="0.5" />
      </g>
      {live && ball !== undefined && (
        <circle
          cx={ball.x}
          cy={ball.y}
          r="1.2"
          fill="white"
          style={{ transition: "cx 0.8s ease-out, cy 0.8s ease-out" }}
        />
      )}
    </svg>
  );
}
