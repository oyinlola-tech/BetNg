import { Clock } from "lucide-react";
import { canBet, type MatchSummary } from "@betng/ui-core";
import {
  Countdown,
  ErrorBoundary,
  ErrorState,
  MarketBoard,
  MarketSuspendedState,
  MarketsEmpty,
  Skeleton,
} from "@betng/ui-web";
import { useSlipSelection } from "../../features/betslip";
import { usePinnedMarkets } from "../../features/markets";
import { useMarkets } from "../../hooks/queries";

/*
 * Every market the platform publishes for a match, grouped and searchable.
 * The same board the Shop workspace and the mobile market sheet use, so a
 * market type only ever has to be taught to the frontend once.
 *
 * The countdown is a courtesy, not a gate: whether betting is open comes from
 * the phase the platform reported, and a market's own status can close it even
 * while the match is open.
 */
export function MarketsPanel({
  match,
  className,
}: {
  readonly match: MatchSummary;
  readonly className?: string;
}): React.JSX.Element {
  const bettable = canBet(match.phase);
  const markets = useMarkets(match.id);
  const { selectedIds, toggle } = useSlipSelection();
  const { pinned, togglePin } = usePinnedMarkets();

  if (markets.isError) {
    return (
      <ErrorState
        compact
        error={markets.error}
        onRetry={() => void markets.refetch()}
        className={className}
      />
    );
  }

  const list = markets.data?.markets ?? [];

  return (
    <div className={className}>
      {bettable ? (
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted">
          <Clock className="size-3.5" aria-hidden />
          Betting closes in{" "}
          <Countdown
            to={match.bettingClosesAt}
            className="font-semibold text-text-primary"
          />
        </p>
      ) : (
        list.length > 0 && (
          <MarketSuspendedState
            title="Betting is closed for this match"
            reason="Prices are shown as the platform last reported them."
            className="mb-3"
          />
        )
      )}

      <ErrorBoundary scope="feature">
        {markets.isPending ? (
          <div
            role="status"
            aria-busy
            aria-label="Loading markets"
            className="grid gap-3 md:grid-cols-2"
          >
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
          </div>
        ) : list.length === 0 ? (
          <MarketsEmpty />
        ) : (
          <>
            <p className="type-small mb-2 text-text-muted">
              <span className="tabular font-semibold text-text-primary">
                {list.length}
              </span>{" "}
              {list.length === 1 ? "market" : "markets"}
            </p>
            <MarketBoard
              markets={list}
              selectedIds={selectedIds}
              matchLabel={`${match.home.name} v ${match.away.name}`}
              pinned={pinned}
              onTogglePin={togglePin}
              onToggle={(market, selection) => {
                toggle(selection, market, match);
              }}
            />
          </>
        )}
      </ErrorBoundary>
    </div>
  );
}
