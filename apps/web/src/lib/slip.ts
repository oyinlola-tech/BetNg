import type { MarketView, MatchSummary, SelectionView, SlipSelection } from "@betng/ui-core";

export function toSlipSelection(match: MatchSummary, market: MarketView, selection: SelectionView): SlipSelection {
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
