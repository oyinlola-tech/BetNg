/**
 * Original marks for the four simulation categories. Each is a simple geometric
 * glyph on a rounded badge — deliberately unlike any real competition logo. The
 * league names are used only as category labels for simulated matches.
 */

export interface LeagueMark {
  readonly slug: string;
  readonly code: string;
  readonly color: string;
  readonly ink: string;
  readonly glyph: string;
}

export const LEAGUE_MARK_VIEWBOX = "0 0 48 48";
export const LEAGUE_BADGE_PATH = "M12 2h24c5.5 0 10 4.5 10 10v24c0 5.5-4.5 10-10 10H12C6.5 46 2 41.5 2 36V12C2 6.5 6.5 2 12 2z";

export const LEAGUE_MARKS: readonly LeagueMark[] = [
  { slug: "premier-league", code: "EPL", color: "#3B4A8C", ink: "#FFFFFF", glyph: "M24 9l13 7.5v15L24 39l-13-7.5v-15L24 9zm0 6.2l-7.6 4.4v8.8l7.6 4.4 7.6-4.4v-8.8L24 15.2zM21 20h6v8h-6z" },
  { slug: "laliga", code: "LAL", color: "#D9483B", ink: "#FFFFFF", glyph: "M10 32L24 10l14 22H10zm14-13.6L17.2 29h13.6L24 18.4zM14 36h20v3H14z" },
  { slug: "serie-a", code: "SEA", color: "#1F7A78", ink: "#FFFFFF", glyph: "M24 9a15 15 0 110 30 15 15 0 010-30zm0 5.4a9.6 9.6 0 100 19.2 9.6 9.6 0 000-19.2zM21.4 19h5.2v10h-5.2z" },
  { slug: "ligue-1", code: "LG1", color: "#B98A1F", ink: "#111111", glyph: "M12 12h24v5H12zm0 9.5h24v5H12zM12 31h15v5H12zm18 0h6v5h-6z" },
];

export function leagueMarkFor(slug: string): LeagueMark | undefined {
  return LEAGUE_MARKS.find((m) => m.slug === slug);
}

export function leagueMarkSvg(mark: LeagueMark, size = 48): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="${LEAGUE_MARK_VIEWBOX}" role="img" aria-label="${mark.code}"><path d="${LEAGUE_BADGE_PATH}" fill="${mark.color}"/><path d="${mark.glyph}" fill="${mark.ink}"/></svg>`;
}
