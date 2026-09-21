import { useId } from "react";
import {
  formatAge,
  type MarketView,
  type SelectionView,
} from "@betng/ui-core";
import { cn } from "../lib/cn";
import { MarketStatusTag } from "./MarketStatusTag";
import { MarketSuspendedState } from "./MarketSuspendedState";
import { SelectionButton } from "./SelectionButton";
import { marketTitle } from "./marketStatus";

const MAX_COLUMNS = 6;

export interface MarketCardProps {
  readonly market: MarketView;
  readonly selectedIds?: ReadonlySet<string> | undefined;
  /** @deprecated Use `selectedIds`. */
  readonly isSelected?: ((selectionId: string) => boolean) | undefined;
  readonly onToggle: (market: MarketView, selection: SelectionView) => void;
  readonly matchLabel?: string | undefined;
  readonly now?: number | undefined;
  /** Inside another card: no border or surface of its own. */
  readonly flush?: boolean;
  readonly className?: string | undefined;
}

export function MarketCard({
  market,
  selectedIds,
  isSelected,
  onToggle,
  matchLabel,
  now,
  flush = false,
  className,
}: MarketCardProps): React.JSX.Element {
  const headingId = useId();
  const columns = Math.max(1, Math.min(market.columns, MAX_COLUMNS));
  const dense = columns > 3;

  return (
    <section
      aria-labelledby={headingId}
      data-status={market.status}
      className={cn(
        !flush && "rounded-md border border-border bg-surface",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border py-2.5",
          !flush && "px-4",
        )}
      >
        <h3 id={headingId} className="type-h3 min-w-0 truncate text-base">
          {marketTitle(market)}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {market.updatedAt !== undefined && (
            <span className="type-small text-text-muted max-sm:hidden">
              Updated {formatAge(market.updatedAt, now)}
            </span>
          )}
          {market.status !== "OPEN" && (
            <MarketStatusTag status={market.status} />
          )}
        </div>
      </header>
      <div className={cn("space-y-2 py-3", !flush && "px-3")}>
        {market.status === "SUSPENDED" && (
          <MarketSuspendedState reason={market.suspensionReason} />
        )}
        {market.selections.length === 0 ? (
          <p className="type-small text-text-muted">No selections.</p>
        ) : (
          <div
            role="group"
            aria-labelledby={headingId}
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
            }}
          >
            {market.selections.map((selection) => (
              <SelectionButton
                key={selection.id}
                selection={selection}
                market={market}
                shortLabel={dense}
                matchLabel={matchLabel}
                selected={
                  selectedIds?.has(selection.id) ??
                  isSelected?.(selection.id) ??
                  false
                }
                onToggle={(s, m) => {
                  onToggle(m, s);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
