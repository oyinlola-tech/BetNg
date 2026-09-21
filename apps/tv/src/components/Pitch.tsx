import { isInPlay, type MatchView } from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";

export function Pitch({
  match,
  className,
}: {
  readonly match: MatchView;
  readonly className?: string;
}): React.JSX.Element {
  const now = useNow(250);
  const live = isInPlay(match.phase);
  const possession = match.stats?.home.possession ?? 50;
  const t = (now / 1000) % 3600;
  const x = 50 + ((possession - 50) / 50) * 22 + Math.sin(t * 5.6) * 22;
  const y = 50 + Math.cos(t * 3.8) * 26;

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
      {live && (
        <circle
          cx={8 + (x / 100) * 144}
          cy={6 + (y / 100) * 78}
          r="1.7"
          fill="white"
          style={{ transition: "cx 250ms linear, cy 250ms linear" }}
        />
      )}
    </svg>
  );
}
