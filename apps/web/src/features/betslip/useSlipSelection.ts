import { useCallback, useMemo } from "react";
import type {
  MarketView,
  MatchSummary,
  SelectionView,
  SlipSelection,
} from "@betng/ui-core";
import { useBetSlip } from "../../stores/betslip.store";

export function toSlipSelection(
  selection: SelectionView,
  market: MarketView,
  match: MatchSummary,
): SlipSelection {
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
    ...(market.oddsVersion === undefined
      ? {}
      : { oddsVersion: market.oddsVersion }),
  };
}

export interface SlipSelectionApi {
  readonly selectedIds: ReadonlySet<string>;
  readonly toggle: (
    selection: SelectionView,
    market: MarketView,
    match: MatchSummary,
  ) => void;
}

export function useSlipSelection(): SlipSelectionApi {
  const selections = useBetSlip((s) => s.selections);
  const toggleInStore = useBetSlip((s) => s.toggle);

  const selectedIds = useMemo(
    () => new Set<string>(selections.map((s) => s.selectionId)),
    [selections],
  );

  const toggle = useCallback(
    (selection: SelectionView, market: MarketView, match: MatchSummary) => {
      toggleInStore(toSlipSelection(selection, market, match));
    },
    [toggleInStore],
  );

  return { selectedIds, toggle };
}

export function useBetSlipCount(): number {
  return useBetSlip((s) => s.selections.length);
}

/** Lets the shell open or close the mobile slip sheet, e.g. from a header button. */
export function useBetSlipSheet(): { readonly open: boolean; readonly setOpen: (open: boolean) => void } {
  const open = useBetSlip((s) => s.open);
  const setOpen = useBetSlip((s) => s.setOpen);

  return { open, setOpen };
}
