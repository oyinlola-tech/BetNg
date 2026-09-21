import type { MarketView, SelectionView } from "@betng/ui-core";
import { OddsButton } from "./OddsButton";
import { marketTitle, selectionState } from "./marketStatus";

export interface SelectionButtonProps {
  readonly selection: SelectionView;
  readonly market: MarketView;
  readonly selected: boolean;
  readonly onToggle: (selection: SelectionView, market: MarketView) => void;
  readonly size?: "sm" | "md";
  readonly shortLabel?: boolean;
  /** The match, for the accessible name. */
  readonly matchLabel?: string | undefined;
  readonly loading?: boolean;
  readonly className?: string | undefined;
}

export function SelectionButton({
  selection,
  market,
  selected,
  onToggle,
  size = "md",
  shortLabel = false,
  matchLabel,
  loading = false,
  className,
}: SelectionButtonProps): React.JSX.Element {
  const context = [matchLabel, marketTitle(market)]
    .filter((part) => part !== undefined)
    .join(", ");

  return (
    <OddsButton
      label={shortLabel ? selection.shortLabel : selection.label}
      odds={selection.odds}
      state={loading ? "loading" : selectionState(selection, market, selected)}
      change={
        selection.trend === "UP" || selection.trend === "DOWN"
          ? selection.trend
          : undefined
      }
      size={size}
      accessibleContext={context}
      onSelect={() => {
        onToggle(selection, market);
      }}
      className={className}
    />
  );
}
