import { Link } from "react-router";
import { CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { canBet, formatKickoffTime, isFinished, isInPlay, isSelected, matchClock, type MatchSummary } from "@betng/ui-core";
import { Badge, cn, Countdown, LiveDot, OddsButton, Skeleton, TeamBadge, useNow } from "@betng/ui-web";
import { useMarkets } from "../../hooks/queries";
import { toSlipSelection } from "../../lib/slip";
import { useBetSlip } from "../../stores/betslip.store";

const CLOSING_SOON_MS = 30_000;

function Status({ match, now }: { readonly match: MatchSummary; readonly now: number }): React.JSX.Element {
  const closing = match.phase === "BETTING_OPEN" && Date.parse(match.bettingClosesAt) - now <= CLOSING_SOON_MS;

  switch (match.phase) {
    case "BETTING_OPEN":
      return (
        <>
          <Badge tone={closing ? "warning" : "brand"} solid={closing}>
            {closing ? "Closing" : "Betting open"}
          </Badge>
          <span className={cn("text-xs tabular", closing ? "font-semibold text-warning" : "text-text-muted")}>
            Closes <Countdown to={match.bettingClosesAt} />
          </span>
        </>
      );
    case "BETTING_CLOSED":
      return (
        <>
          <Badge tone="neutral">
            <Lock className="size-2.5" aria-hidden />
            Betting closed
          </Badge>
          <span className="text-xs tabular text-text-muted">
            Kick-off <Countdown to={match.kickoffAt} />
          </span>
        </>
      );
    case "LIVE":
      return (
        <Badge tone="live" solid>
          <LiveDot className="bg-white" />
          Live <span className="tabular">{matchClock(match.kickoffAt, now).minute}'</span>
        </Badge>
      );
    case "HALFTIME":
      return <Badge tone="live">Half-time</Badge>;
    case "FINISHED":
      return (
        <>
          <Badge tone="neutral">Full time</Badge>
          <span className="text-xs text-text-muted">Settling bets…</span>
        </>
      );
    case "SETTLED":
      return (
        <>
          <Badge tone="muted">Full time</Badge>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3" aria-hidden />
            Settled
          </span>
        </>
      );
    case "CANCELLED":
      return <Badge tone="warning">Void</Badge>;
    case "SCHEDULED":
      return (
        <>
          <Badge tone="muted">Upcoming</Badge>
          <span className="text-xs tabular text-text-muted">{formatKickoffTime(match.kickoffAt)}</span>
        </>
      );
  }
}

function KeyMarket({ match }: { readonly match: MatchSummary }): React.JSX.Element | null {
  const markets = useMarkets(match.id);
  const selections = useBetSlip((s) => s.selections);
  const toggle = useBetSlip((s) => s.toggle);
  const market = markets.data?.markets.find((m) => m.kind === "MATCH_RESULT");

  if (markets.isPending) {
    return (
      <div className="grid grid-cols-3 gap-1.5" aria-busy>
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  if (market === undefined) return null;

  return (
    <div role="group" aria-label={`${market.name}: ${match.home.name} v ${match.away.name}`} className="grid grid-cols-3 gap-1.5">
      {market.selections.map((selection) => (
        <OddsButton
          key={selection.id}
          compact
          selection={selection}
          selected={isSelected(selections, selection.id)}
          disabled={market.status !== "OPEN"}
          onToggle={() => {
            toggle(toSlipSelection(match, market, selection));
          }}
        />
      ))}
    </div>
  );
}

function TeamLine({ team, score, showScore, strong }: { readonly team: MatchSummary["home"]; readonly score: number; readonly showScore: boolean; readonly strong: boolean }): React.JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <TeamBadge team={team} size="xs" />
      <span className={cn("min-w-0 flex-1 truncate text-base", strong ? "font-semibold text-text-primary" : "font-medium text-text-secondary")}>{team.name}</span>
      {showScore && <span className={cn("w-5 text-right text-md tabular", strong ? "font-bold text-text-primary" : "font-semibold text-text-secondary")}>{score}</span>}
    </span>
  );
}

/** The lobby's row: state and countdown, teams and score, and the match-result prices while betting is open. */
export function LobbyMatchRow({ match }: { readonly match: MatchSummary }): React.JSX.Element {
  const now = useNow(1000);
  const live = isInPlay(match.phase);
  const finished = isFinished(match.phase);
  const bettable = canBet(match.phase);
  const winner = finished ? (match.score.home > match.score.away ? "HOME" : match.score.away > match.score.home ? "AWAY" : undefined) : undefined;

  return (
    <div className={cn("grid items-center gap-x-4 gap-y-2.5 px-3 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,17rem)]", live && "bg-live-subtle/30")}>
      <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
        <Status match={match} now={now} />
      </div>
      <Link to={`/matches/${match.id}`} className="group flex min-w-0 items-center gap-2 rounded-sm focus-ring">
        <span className="min-w-0 flex-1 space-y-1">
          <TeamLine team={match.home} score={match.score.home} showScore={live || finished} strong={winner === "HOME" || live} />
          <TeamLine team={match.away} score={match.score.away} showScore={live || finished} strong={winner === "AWAY" || live} />
        </span>
        {!bettable && <ChevronRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </Link>
      {bettable ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <KeyMarket match={match} />
          </div>
          <Link to={`/matches/${match.id}`} aria-label={`All ${String(match.openMarkets)} markets for ${match.home.name} v ${match.away.name}`} className="shrink-0 rounded-sm px-1.5 py-2 text-xs font-semibold tabular text-brand hover:underline focus-ring">
            +{Math.max(0, match.openMarkets - 1)}
          </Link>
        </div>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}
