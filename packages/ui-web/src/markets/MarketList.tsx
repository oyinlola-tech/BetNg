import type { MarketView, SelectionView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { Skeleton } from "../ui";
import { MarketCard } from "./MarketCard";
import { MarketGroup } from "./MarketGroup";
import { MarketRow } from "./MarketRow";
import { MarketTabs } from "./MarketTabs";
import { MarketsEmpty } from "./MarketsEmpty";
import { groupMarkets } from "./marketStatus";

const WIDE_COLUMNS = 4;

export interface MarketListProps {
  readonly markets: readonly MarketView[] | undefined;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (selection: SelectionView, market: MarketView) => void;
  /** `tabs` groups by the platform's `group`; `groups` stacks titled groups; `rows` is the dense shop layout. */
  readonly layout?: "tabs" | "groups" | "rows";
  readonly loading?: boolean;
  readonly matchLabel?: string | undefined;
  readonly now?: number | undefined;
  readonly className?: string | undefined;
}

export function MarketList({
  markets,
  selectedIds,
  onToggle,
  layout = "tabs",
  loading = false,
  matchLabel,
  now,
  className,
}: MarketListProps): React.JSX.Element {
  if (loading || markets === undefined) {
    return (
      <div
        role="status"
        aria-busy
        aria-label="Loading markets"
        className={cn("grid gap-3 md:grid-cols-2", className)}
      >
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
    );
  }

  if (markets.length === 0) return <MarketsEmpty className={className} />;

  if (layout === "rows") {
    return (
      <div className={cn("divide-y divide-border", className)}>
        {markets.map((market) => (
          <MarketRow
            key={market.id}
            market={market}
            selectedIds={selectedIds}
            onToggle={onToggle}
            matchLabel={matchLabel}
            className="py-1.5"
          />
        ))}
      </div>
    );
  }

  const cards = (list: readonly MarketView[]): React.ReactNode =>
    list.map((market) => (
      <MarketCard
        key={market.id}
        market={market}
        selectedIds={selectedIds}
        matchLabel={matchLabel}
        now={now}
        onToggle={(m, s) => {
          onToggle(s, m);
        }}
        className={market.columns >= WIDE_COLUMNS ? "md:col-span-2" : undefined}
      />
    ));

  if (layout === "groups") {
    return (
      <div className={cn("space-y-6", className)}>
        {groupMarkets(markets).map((group) => (
          <MarketGroup
            key={group.key}
            title={group.label}
            count={group.markets.length}
          >
            {cards(group.markets)}
          </MarketGroup>
        ))}
      </div>
    );
  }

  return (
    <MarketTabs markets={markets} className={className}>
      {(active) => <div className="grid gap-3 md:grid-cols-2">{cards(active)}</div>}
    </MarketTabs>
  );
}
