import { memo } from "react";
import { ChevronDown, Lock, Timer } from "lucide-react";
import { canBet, formatKickoffTime, isInPlay, matchClock, type MarketKind, type MarketView, type MatchMarketsView, type MatchSummary, type SelectionView } from "@betng/ui-core";
import { Countdown, MarketCard, OddsButton, PhaseBadge, Skeleton, TeamBadge, cn, useNow } from "@betng/ui-web";

export interface MatchOddsRowProps {
  readonly match: MatchSummary;
  readonly markets: MatchMarketsView | undefined;
  readonly expanded: boolean;
  /** Names the competition on the row, for lists that are not grouped by league. */
  readonly showLeague?: boolean;
  readonly onExpand: (matchId: string) => void;
  readonly isSelected: (selectionId: string) => boolean;
  readonly onToggle: (match: MatchSummary, market: MarketView, selection: SelectionView) => void;
}

/* Markets whose selection labels carry team names need the full row to stay readable. */
const WIDE: ReadonlySet<MarketKind> = new Set(["DOUBLE_CHANCE", "GOAL_SPREAD", "CORRECT_SCORE"]);

function LiveMinute({ kickoffAt }: { readonly kickoffAt: string }): React.JSX.Element {
  const now = useNow(1000);

  return <span className="tabular">{matchClock(kickoffAt, now).minute}'</span>;
}

export const MatchOddsRow = memo(function MatchOddsRow({ match, markets, expanded, showLeague = false, onExpand, isSelected, onToggle }: MatchOddsRowProps): React.JSX.Element {
  const bettable = canBet(match.phase);
  const live = isInPlay(match.phase);
  const result = markets?.markets.find((m) => m.kind === "MATCH_RESULT");
  const others = markets?.markets.filter((m) => m.kind !== "MATCH_RESULT") ?? [];
  const label = `${match.home.name} v ${match.away.name}`;

  return (
    <li className={cn("border-b border-border last:border-b-0", expanded && "bg-surface-sunken/40")}>
      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-1.5 lg:grid-cols-[4.25rem_minmax(0,1fr)_minmax(15rem,19rem)_2.25rem]">
        <div className="text-sm leading-tight">
          {live ? (
            <p className="flex items-center gap-1 font-semibold text-live">
              <span className="size-1.5 rounded-full bg-live animate-pulse-live" aria-hidden />
              {match.phase === "HALFTIME" ? "HT" : <LiveMinute kickoffAt={match.kickoffAt} />}
            </p>
          ) : (
            <p className="font-semibold tabular text-text-primary">{formatKickoffTime(match.kickoffAt)}</p>
          )}
          {bettable ? (
            <p className="flex items-center gap-1 text-xs text-text-muted" title="Betting closes in">
              {showLeague ? <span className="font-semibold text-text-secondary">{match.leagueCode}</span> : <Timer className="size-3" aria-hidden />}
              <span className="sr-only">Betting closes in</span>
              <Countdown to={match.bettingClosesAt} />
            </p>
          ) : (
            !live && <PhaseBadge phase={match.phase} />
          )}
        </div>

        <div className="min-w-0 space-y-0.5">
          {([match.home, match.away] as const).map((team, index) => (
            <p key={team.id} className="flex items-center gap-2">
              <TeamBadge team={team} size="xs" />
              <span className="truncate text-base font-medium text-text-primary">{team.name}</span>
              {(live || match.phase === "FINISHED" || match.phase === "SETTLED") && <span className="ml-auto font-display text-md font-semibold tabular">{index === 0 ? match.score.home : match.score.away}</span>}
            </p>
          ))}
        </div>

        <div className="col-span-3 mt-1.5 grid grid-cols-3 gap-1 lg:col-span-1 lg:mt-0" role="group" aria-label={`Match result, ${label}`}>
          {result !== undefined ? (
            result.selections.map((selection) => (
              <OddsButton
                key={selection.id}
                compact
                selection={selection}
                selected={isSelected(selection.id)}
                disabled={!bettable || result.status !== "OPEN"}
                onToggle={(s) => {
                  onToggle(match, result, s);
                }}
                className="pointer-coarse:h-11"
              />
            ))
          ) : bettable ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)
          ) : (
            <p className="col-span-3 flex h-10 items-center justify-center gap-1.5 rounded-sm bg-surface-sunken text-sm text-text-muted">
              <Lock className="size-3.5" aria-hidden />
              {live ? "In play: markets suspended" : "Markets closed"}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`More markets, ${label}`}
          disabled={!bettable || others.length === 0}
          onClick={() => {
            onExpand(match.id);
          }}
          className="col-start-3 row-start-1 flex h-9 items-center justify-center gap-0.5 rounded-sm border border-border px-2 text-sm font-semibold tabular text-text-secondary transition-colors hover:bg-surface-hover focus-ring disabled:opacity-40 lg:col-start-4 lg:h-10 lg:px-0 pointer-coarse:h-11"
        >
          <span className="lg:hidden">+{others.length}</span>
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>

      {expanded && bettable && (
        <div className="grid gap-2 px-3 pb-3 pt-1 md:grid-cols-2">
          {others.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              isSelected={isSelected}
              onToggle={(m, s) => {
                onToggle(match, m, s);
              }}
              className={WIDE.has(market.kind) ? "md:col-span-2" : undefined}
            />
          ))}
        </div>
      )}
    </li>
  );
});
