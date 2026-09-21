import { canBet, type MatchSummary } from "@betng/ui-core";
import { Countdown, ErrorBoundary, ErrorState, MarketList, MarketSuspendedState } from "@betng/ui-web";
import { Clock } from "lucide-react";
import { useSlipSelection } from "../../features/betslip";
import { useMarkets } from "../../hooks/queries";

export function MarketsPanel({ match, className }: { readonly match: MatchSummary; readonly className?: string }): React.JSX.Element {
  const bettable = canBet(match.phase);
  const markets = useMarkets(match.id);
  const { selectedIds, toggle } = useSlipSelection();

  if (markets.isError) {
    return <ErrorState compact error={markets.error} onRetry={() => void markets.refetch()} className={className} />;
  }

  return (
    <div className={className}>
      {bettable ? (
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted">
          <Clock className="size-3.5" aria-hidden />
          Betting closes in <Countdown to={match.bettingClosesAt} className="font-semibold text-text-primary" />
        </p>
      ) : (
        markets.data !== undefined &&
        markets.data.markets.length > 0 && (
          <MarketSuspendedState
            title="Betting is closed for this match"
            reason="Prices are shown as the platform last reported them."
            className="mb-3"
          />
        )
      )}
      <ErrorBoundary scope="feature">
        <MarketList
          markets={markets.data?.markets}
          loading={markets.isPending}
          layout="tabs"
          selectedIds={selectedIds}
          matchLabel={`${match.home.name} v ${match.away.name}`}
          onToggle={(selection, market) => {
            toggle(selection, market, match);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
