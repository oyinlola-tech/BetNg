import type { StateTone } from "@betng/design-tokens";
import type { MarketView, SelectionView } from "@betng/ui-core";
import type { OddsButtonState } from "./OddsButton";

type Status = MarketView["status"];

export const MARKET_STATUS_WORD: Readonly<Record<Status, string>> = {
  OPEN: "Open",
  SUSPENDED: "Suspended",
  CLOSED: "Closed",
  SETTLED: "Settled",
  VOID: "Void",
};

export const MARKET_STATUS_TONE: Readonly<Record<Status, StateTone>> = {
  OPEN: "success",
  SUSPENDED: "suspended",
  CLOSED: "muted",
  SETTLED: "muted",
  VOID: "void",
};

/*
 * Grouping, ordering, naming and titles live in @betng/ui-core so that web,
 * shop, mobile and TV present the same catalogue. Re-exported here because
 * every market component already imports from this module.
 */
export {
  MARKET_GROUP_LABEL,
  MARKET_GROUP_ORDER,
  groupMarkets,
  marketShape,
  marketTitle,
  sortMarkets,
} from "@betng/ui-core";
export type { MarketGroupView } from "@betng/ui-core";

export function selectionState(
  selection: Pick<SelectionView, "status">,
  market: Pick<MarketView, "status">,
  selected: boolean,
): OddsButtonState {
  if (market.status === "SUSPENDED" || selection.status === "SUSPENDED") {
    return "suspended";
  }

  if (market.status !== "OPEN" || selection.status === "UNAVAILABLE") {
    return "unavailable";
  }

  return selected ? "selected" : "default";
}

/** A market the user must not be able to add to a slip. */
export function isMarketPlayable(market: Pick<MarketView, "status">): boolean {
  return market.status === "OPEN";
}
