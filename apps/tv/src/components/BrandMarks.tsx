import { LEAGUE_BADGE_PATH, LEAGUE_MARK_VIEWBOX, LOGO_B_PATH, LOGO_CUT_PATH, LOGO_TILE_PATH, LOGO_VIEWBOX, leagueMarkFor } from "@betng/brand";

export function LogoMark({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox={LOGO_VIEWBOX} role="img" aria-label="BETNG" className={className}>
      <path d={LOGO_TILE_PATH} fill="var(--bn-brand)" />
      <path d={LOGO_B_PATH} fill="var(--bn-text-on-brand)" />
      <path d={LOGO_CUT_PATH} fill="var(--bn-brand)" opacity={0.92} />
    </svg>
  );
}

export function LeagueMark({ slug, code, className }: { readonly slug: string; readonly code: string; readonly className?: string }): React.JSX.Element {
  const mark = leagueMarkFor(slug);

  return (
    <svg viewBox={LEAGUE_MARK_VIEWBOX} role="img" aria-label={code} className={className}>
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
