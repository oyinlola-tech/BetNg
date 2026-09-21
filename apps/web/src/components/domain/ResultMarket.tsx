import { canBet, type MatchSummary } from "@betng/ui-core";
import { SelectionButton, Skeleton } from "@betng/ui-web";
import { useSlipSelection } from "../../features/betslip";
import { useMarkets } from "../../hooks/queries";

/** The match-result prices for a list row. Rendered only while the platform says the match can be bet on. */
export function ResultMarket({ match, className }: { readonly match: MatchSummary; readonly className?: string }): React.JSX.Element | null {
  const bettable = canBet(match.phase);
  const markets = useMarkets(match.id, { poll: true, enabled: bettable });
  const { selectedIds, toggle } = useSlipSelection();

  if (!bettable) return null;

  if (markets.isPending) {
    return (
      <div className={className} role="status" aria-label="Loading prices">
        <div className="grid grid-cols-3 gap-1.5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
    );
  }

  const market = markets.data?.markets.find((entry) => entry.kind === "MATCH_RESULT");

  if (market === undefined) return null;

  const matchLabel = `${match.home.name} v ${match.away.name}`;

  return (
    <div className={className}>
      <div role="group" aria-label={`${market.name}, ${matchLabel}`} className="grid grid-cols-3 gap-1.5">
        {market.selections.map((selection) => (
          <SelectionButton
            key={selection.id}
            selection={selection}
            market={market}
            shortLabel
            selected={selectedIds.has(selection.id)}
            matchLabel={matchLabel}
            onToggle={(picked, inMarket) => {
              toggle(picked, inMarket, match);
            }}
          />
        ))}
      </div>
    </div>
  );
}
