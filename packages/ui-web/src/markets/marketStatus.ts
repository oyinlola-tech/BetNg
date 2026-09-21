import type { StateTone } from "@betng/design-tokens";
import type {
  MarketGroupKey,
  MarketView,
  SelectionView,
} from "@betng/ui-core";
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

export const MARKET_GROUP_ORDER: readonly MarketGroupKey[] = [
  "MAIN",
  "GOALS",
  "SCORE",
  "HANDICAP",
  "OTHER",
];

export const MARKET_GROUP_LABEL: Readonly<Record<MarketGroupKey, string>> = {
  MAIN: "Main",
  GOALS: "Goals",
  SCORE: "Correct score",
  HANDICAP: "Handicap",
  OTHER: "More",
};

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

/** A market the platform did not place in a group goes under "More". */
export function groupMarkets(
  markets: readonly MarketView[],
): readonly {
  readonly key: MarketGroupKey;
  readonly label: string;
  readonly markets: readonly MarketView[];
}[] {
  return MARKET_GROUP_ORDER.flatMap((key) => {
    const members = markets.filter((m) => (m.group ?? "OTHER") === key);

    return members.length === 0
      ? []
      : [{ key, label: MARKET_GROUP_LABEL[key], markets: members }];
  });
}

export function marketTitle(market: Pick<MarketView, "name" | "line">): string {
  return market.line === undefined || market.name.includes(String(market.line))
    ? market.name
    : `${market.name} ${String(market.line)}`;
}
