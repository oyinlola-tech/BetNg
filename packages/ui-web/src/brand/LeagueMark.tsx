import { LEAGUE_BADGE_PATH, LEAGUE_MARK_VIEWBOX, leagueMarkFor } from "@betng/brand";

export interface LeagueMarkProps {
  readonly slug: string | undefined;
  readonly code: string;
  readonly size?: number;
  readonly className?: string;
}

export function LeagueMark({ slug, code, size = 24, className }: LeagueMarkProps): React.JSX.Element {
  const mark = slug === undefined ? undefined : leagueMarkFor(slug);

  return (
    <svg width={size} height={size} viewBox={LEAGUE_MARK_VIEWBOX} role="img" aria-label={code} className={className}>
      <path d={LEAGUE_BADGE_PATH} fill={mark?.color ?? "var(--bn-surface-sunken)"} />
      {mark !== undefined ? (
        <path d={mark.glyph} fill={mark.ink} />
      ) : (
        <text x="24" y="29" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--bn-text-secondary)">
          {code.slice(0, 3)}
        </text>
      )}
    </svg>
  );
}
