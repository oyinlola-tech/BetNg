import { Lock } from "lucide-react";
import type { MarketView, SelectionView } from "@betng/ui-core";
import { cn } from "../../lib/cn";
import { OddsButton } from "./OddsButton";

export interface MarketCardProps {
  readonly market: MarketView;
  readonly isSelected: (selectionId: string) => boolean;
  readonly onToggle: (market: MarketView, selection: SelectionView) => void;
  readonly className?: string | undefined;
}

export function MarketCard({
  market,
  isSelected,
  onToggle,
  className,
}: MarketCardProps): React.JSX.Element {
  const locked = market.status !== "OPEN";
  const columns = Math.min(market.columns, 4);

  return (
    <section
      className={cn("rounded-md border border-border bg-surface", className)}
      aria-labelledby={`market-${market.id}`}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 id={`market-${market.id}`} className="text-sm font-semibold">
          {market.name}
        </h3>
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
            <Lock className="size-3" aria-hidden />
            {market.status === "SETTLED" ? "Settled" : "Suspended"}
          </span>
        )}
      </header>
      <div
        className="grid gap-1.5 p-3"
        style={{
          gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
        }}
      >
        {market.selections.map((s) => (
          <OddsButton
            key={s.id}
            selection={s}
            selected={isSelected(s.id)}
            disabled={locked}
            compact={market.kind === "CORRECT_SCORE"}
            onToggle={(selection) => {
              onToggle(market, selection);
            }}
          />
        ))}
      </div>
    </section>
  );
}
