import type { MarketKind, MatchMarketsView, Score } from "./types/index.js";

export interface LeadingCell {
  readonly key: string;
  readonly header: string;
  /** The winning selection as a board prints it: `1`, `2-0`, `1X`, `UN 2.5`, `GG`. */
  readonly label: string;
  readonly odds: number | undefined;
}

export const TOTAL_LINES: readonly number[] = [1.5, 2.5, 3.5];

function oddsOf(markets: MatchMarketsView | undefined, kind: MarketKind, codes: readonly string[], line?: number): { readonly code: string; readonly odds: number } | undefined {
  const market = markets?.markets.find((m) => m.kind === kind && (line === undefined || m.line === line));
  const winners = (market?.selections ?? []).filter((s) => codes.includes(s.code));

  // Where two selections are winning at once (double chance), the board shows the shorter price.
  return winners.sort((a, b) => a.odds - b.odds).map((s) => ({ code: s.code, odds: s.odds }))[0];
}

const DC_LABELS: Readonly<Record<string, string>> = { HOME_DRAW: "1X", HOME_AWAY: "12", DRAW_AWAY: "X2" };

export function leadingSelections(markets: MatchMarketsView | undefined, score: Score): readonly LeadingCell[] {
  const { home, away } = score;
  const total = home + away;
  const result = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
  const exact = home <= 3 && away <= 3;
  const doubleChance = oddsOf(markets, "DOUBLE_CHANCE", result === "HOME" ? ["HOME_DRAW", "HOME_AWAY"] : result === "AWAY" ? ["DRAW_AWAY", "HOME_AWAY"] : ["HOME_DRAW", "DRAW_AWAY"]);

  return [
    { key: "1x2", header: "1X2", label: result === "HOME" ? "1" : result === "AWAY" ? "2" : "X", odds: oddsOf(markets, "MATCH_RESULT", [result])?.odds },
    { key: "cs", header: "CS", label: exact ? `${String(home)}-${String(away)}` : "Other", odds: oddsOf(markets, "CORRECT_SCORE", [exact ? `CS_${String(home)}_${String(away)}` : "CS_OTHER"])?.odds },
    { key: "dc", header: "DC", label: doubleChance === undefined ? (result === "AWAY" ? "X2" : "1X") : (DC_LABELS[doubleChance.code] ?? "1X"), odds: doubleChance?.odds },
    ...TOTAL_LINES.map((line): LeadingCell => {
      const over = total > line;
      const tag = String(line).replace(".", "_");

      return { key: `ou${tag}`, header: `O/U ${String(line)}`, label: `${over ? "OV" : "UN"} ${String(line)}`, odds: oddsOf(markets, "OVER_UNDER", [`${over ? "OVER" : "UNDER"}_${tag}`], line)?.odds };
    }),
    { key: "btts", header: "GG/NG", label: home > 0 && away > 0 ? "GG" : "NG", odds: oddsOf(markets, "BOTH_TEAMS_TO_SCORE", [home > 0 && away > 0 ? "YES" : "NO"])?.odds },
  ];
}
