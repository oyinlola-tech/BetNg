import { canBet, type MarketView, type MatchMarketsView, type MatchSummary, type SelectionView, type SlipSelection } from "@betng/ui-core";

/** The platform accepts this many matches in one odds read. */
export const QUICK_BET_LIMIT = 60;

const RESULT_CODES: readonly string[] = ["HOME", "DRAW", "AWAY"];
const SHORT_LABEL: Readonly<Record<string, string>> = { HOME: "1", DRAW: "X", AWAY: "2" };

export interface QuickBet {
  readonly market: MarketView;
  readonly selections: readonly SelectionView[];
  readonly otherMarkets: number;
}

/** The match result market as 1, X, 2. Nothing unless the platform has it open with all three prices. */
export function quickBetFor(markets: MatchMarketsView | undefined): QuickBet | undefined {
  const market = markets?.markets.find((m) => m.kind === "MATCH_RESULT");

  if (markets === undefined || market === undefined || market.status !== "OPEN") return undefined;

  const selections = RESULT_CODES.flatMap((code) => {
    const found = market.selections.find((s) => s.code === code);

    return found === undefined ? [] : [{ ...found, shortLabel: SHORT_LABEL[code] ?? found.shortLabel }];
  });

  return selections.length === RESULT_CODES.length ? { market, selections, otherMarkets: markets.markets.length - 1 } : undefined;
}

export function slipSelectionFor(match: MatchSummary, market: MarketView, selection: SelectionView): SlipSelection {
  return {
    selectionId: selection.id,
    marketId: market.id,
    matchId: match.id,
    marketKind: market.kind,
    marketName: market.name,
    selectionLabel: selection.label,
    odds: selection.odds,
    matchLabel: `${match.home.name} v ${match.away.name}`,
    leagueCode: match.leagueCode,
    kickoffAt: match.kickoffAt,
  };
}

export function bettable(matches: readonly MatchSummary[]): readonly MatchSummary[] {
  return matches.filter((m) => canBet(m.phase));
}

export function quickBetIds(matches: readonly MatchSummary[]): readonly MatchSummary["id"][] {
  return bettable(matches)
    .slice(0, QUICK_BET_LIMIT)
    .map((m) => m.id);
}

export function marketsByMatch(list: readonly MatchMarketsView[] | undefined): ReadonlyMap<string, MatchMarketsView> {
  return new Map((list ?? []).map((markets) => [markets.matchId, markets]));
}
