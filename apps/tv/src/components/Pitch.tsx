import { isInPlay, type MatchEventKind, type MatchView } from "@betng/ui-core";
import { cn } from "../lib/cn";

function ballSpot(
  kind: MatchEventKind,
  side?: "HOME" | "AWAY",
): { readonly x: number; readonly y: number } | undefined {
  const right = side === "HOME";

  switch (kind) {
    case "KICK_OFF":
    case "SECOND_HALF":
    case "OWN_GOAL":
      return { x: 80, y: 45 };
    case "GOAL":
      return side === undefined ? undefined : { x: right ? 150 : 10, y: 45 };
    case "PENALTY_GOAL":
    case "PENALTY_MISSED":
      return side === undefined ? undefined : { x: right ? 138 : 22, y: 45 };
    case "CORNER":
      return side === undefined ? undefined : { x: right ? 151 : 9, y: 7 };
    default:
      return undefined;
  }
}

export function Pitch({
  match,
  className,
}: {
  readonly match: MatchView;
  readonly className?: string;
}): React.JSX.Element {
  const live = isInPlay(match.phase);

  const ball = [...match.events]
    .sort((a, b) => b.sequence - a.sequence)
    .map((e) => ballSpot(e.kind, e.side))
    .find((spot) => spot !== undefined);

  return (
    <svg
      viewBox="0 0 160 90"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <pattern
          id="tv-stripes"
          width="16"
          height="90"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="90" fill="rgba(255,255,255,0.03)" />
        </pattern>
      </defs>
      <rect width="160" height="90" fill="#0F2E20" />
      <rect width="160" height="90" fill="url(#tv-stripes)" />
      <g fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6">
        <rect x="8" y="6" width="144" height="78" />
        <line x1="80" y1="6" x2="80" y2="84" />
        <circle cx="80" cy="45" r="9" />
        <rect x="8" y="24" width="20" height="42" />
        <rect x="132" y="24" width="20" height="42" />
        <rect x="8" y="35" width="7" height="20" />
        <rect x="145" y="35" width="7" height="20" />
        <path d="M28 37 A9 9 0 0 1 28 53" />
        <path d="M132 37 A9 9 0 0 0 132 53" />
      </g>
      {live && ball !== undefined && (
        <circle
          cx={ball.x}
          cy={ball.y}
          r="1.7"
          fill="white"
          style={{ transition: "cx 0.8s ease-out, cy 0.8s ease-out" }}
        />
      )}
    </svg>
  );
}
