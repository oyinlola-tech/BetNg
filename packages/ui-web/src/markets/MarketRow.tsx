import type { MarketView, SelectionView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { MarketStatusTag } from "./MarketStatusTag";
import { SelectionButton } from "./SelectionButton";
import { marketTitle } from "./marketStatus";

export interface MarketRowProps {
  readonly market: MarketView;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (selection: SelectionView, market: MarketView) => void;
  readonly matchLabel?: string | undefined;
  readonly showName?: boolean;
  readonly className?: string | undefined;
}

export function MarketRow({
  market,
  selectedIds,
  onToggle,
  matchLabel,
  showName = true,
  className,
}: MarketRowProps): React.JSX.Element {
  const title = marketTitle(market);

  return (
    <div
      role="group"
      aria-label={matchLabel === undefined ? title : `${title}, ${matchLabel}`}
      data-status={market.status}
      className={cn("flex min-w-0 items-center gap-2", className)}
    >
      {showName && (
        <span className="type-small flex w-32 shrink-0 items-center gap-1.5 font-medium text-text-secondary">
          <span className="min-w-0 truncate">{title}</span>
          {market.status !== "OPEN" && (
            <MarketStatusTag status={market.status} />
          )}
        </span>
      )}
      <div
        className="grid min-w-0 flex-1 gap-1"
        style={{
          gridTemplateColumns: `repeat(${String(Math.max(1, market.selections.length))}, minmax(0, 1fr))`,
        }}
      >
        {market.selections.map((selection) => (
          <SelectionButton
            key={selection.id}
            selection={selection}
            market={market}
            size="sm"
            shortLabel
            matchLabel={matchLabel}
            selected={selectedIds.has(selection.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
