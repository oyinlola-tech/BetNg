import { ArrowLeft } from "lucide-react";
import {
  canBet,
  formatKickoffTime,
  isInPlay,
  routeMatchEvents,
  type ConnectionState,
  type MarketView,
  type MatchSummary,
  type MatchView,
  type SelectionView,
} from "@betng/ui-core";
import {
  Button,
  CommentaryPanel,
  ErrorState,
  MarketBoard,
  MatchStadium,
  MarketSuspendedState,
  MarketsEmpty,
  PhaseBadge,
  SkeletonRows,
  TeamBadge,
} from "@betng/ui-web";
import { useMarkets } from "../hooks/queries";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { usePinnedMarkets } from "../hooks/usePinnedMarkets";

/*
 * The cashier's market workspace. Selecting a match turns the middle column
 * into this rather than navigating away, so the competition list and the slip
 * both stay put and the cashier never loses their place.
 *
 * The match header is sticky because a long catalogue scrolls a long way, and
 * a cashier who cannot see which match they are pricing will eventually price
 * the wrong one.
 */

export interface MatchWorkspaceProps {
  readonly match: MatchSummary;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (
    match: MatchSummary,
    market: MarketView,
    selection: SelectionView,
  ) => void;
  readonly onBack: () => void;
}

export function MatchWorkspace({
  match,
  selectedIds,
  onToggle,
  onBack,
}: MatchWorkspaceProps): React.JSX.Element {
  const markets = useMarkets(match.id);
  const { pinned, togglePin } = usePinnedMarkets();
  const bettable = canBet(match.phase);
  const live = isInPlay(match.phase);
  /* Only a match in play is watched, so the terminal holds no stream it is not showing. */
  const stream = useLiveMatch(live ? match.id : undefined);
  const list = markets.data?.markets ?? [];
  const label = `${match.home.name} v ${match.away.name}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-sticky shrink-0 border-b border-border bg-surface">
        <div className="flex items-center gap-3 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            icon={<ArrowLeft className="size-4" />}
            aria-label="Back to matches"
          >
            Matches
          </Button>

          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-2 font-display text-md font-semibold">
              <TeamBadge team={match.home} size="xs" />
              <span className="truncate">{match.home.name}</span>
              <span className="shrink-0 text-text-muted">v</span>
              <span className="truncate">{match.away.name}</span>
              <TeamBadge team={match.away} size="xs" />
            </p>
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <span className="font-semibold text-text-secondary">
                {match.leagueName}
              </span>
              <span className="tabular">
                {formatKickoffTime(match.kickoffAt)}
              </span>
              {live ? (
                <span className="font-semibold text-live">In play</span>
              ) : (
                <PhaseBadge phase={match.phase} />
              )}
            </p>
          </div>

          <p className="shrink-0 text-sm text-text-muted">
            <span className="tabular font-semibold text-text-primary">
              {list.length}
            </span>{" "}
            {list.length === 1 ? "market" : "markets"}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        {live && stream.match !== undefined && (
          <LiveView match={stream.match} connection={stream.connection} syncedAt={stream.syncedAt} />
        )}
        {markets.isError && markets.data === undefined ? (
          <ErrorState
            error={markets.error}
            onRetry={() => void markets.refetch()}
          />
        ) : markets.isPending ? (
          <SkeletonRows rows={8} />
        ) : list.length === 0 ? (
          <MarketsEmpty />
        ) : (
          <>
            {!bettable && (
              <MarketSuspendedState
                title={
                  live
                    ? "This match is in play"
                    : "Betting is closed for this match"
                }
                reason="Only markets the platform reports as open can be added to a ticket."
                className="mb-3"
              />
            )}
            <MarketBoard
              markets={list}
              selectedIds={selectedIds}
              matchLabel={label}
              density="dense"
              pinned={pinned}
              onTogglePin={togglePin}
              onToggle={(market, selection) => {
                onToggle(match, market, selection);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/*
 * The cashier's view of a match in play: the same stadium and the same routed
 * event stream the web Match Centre draws, laid out to sit above the market
 * board rather than take the screen. The terminal observes the match; it has
 * no control over it.
 */
function LiveView({
  match,
  connection,
  syncedAt,
}: {
  readonly match: MatchView;
  readonly connection: ConnectionState;
  readonly syncedAt: number | undefined;
}): React.JSX.Element {
  const events = routeMatchEvents(match.events, match);

  return (
    <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(13rem,1fr)]">
      <MatchStadium
        match={match}
        connection={connection}
        syncedAt={syncedAt}
        density="compact"
        labelled={false}
      />
      <section
        aria-label="Live commentary"
        className="flex max-h-72 min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface"
      >
        <h3 className="caps-label shrink-0 border-b border-border px-3 py-2">
          Commentary
        </h3>
        <CommentaryPanel
          events={events}
          latestId={events[events.length - 1]?.id}
          limit={25}
          compact
          emptyMessage="Commentary appears as the platform reports events."
          className="min-h-0 flex-1"
        />
      </section>
    </div>
  );
}
