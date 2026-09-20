import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { formatKickoffTime, isFinished, isInPlay, matchClock, type MatchSummary } from "@betng/ui-core";
import { useNow } from "../../hooks/useNow";
import { cn } from "../../lib/cn";
import { Countdown } from "./Countdown";
import { PhaseBadge } from "./PhaseBadge";
import { TeamBadge } from "./TeamBadge";

export interface MatchRowProps {
  readonly match: MatchSummary;
  readonly showLeague?: boolean;
  readonly className?: string;
}

export function MatchRow({ match, showLeague = false, className }: MatchRowProps): React.JSX.Element {
  const now = useNow(1000);
  const live = isInPlay(match.phase);
  const finished = isFinished(match.phase);
  const minute = matchClock(match.kickoffAt, now).minute;
  const winner = finished ? (match.score.home > match.score.away ? "HOME" : match.score.away > match.score.home ? "AWAY" : undefined) : undefined;

  return (
    <Link
      to={`/matches/${match.id}`}
      className={cn(
        "group grid grid-cols-[4.5rem_1fr_auto_1.25rem] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-hover focus-ring rounded-sm",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-0.5">
        <PhaseBadge phase={match.phase} minute={minute} />
        <span className="text-xs tabular text-text-muted">
          {showLeague ? match.leagueCode : live ? "" : finished ? formatKickoffTime(match.kickoffAt) : <Countdown to={match.kickoffAt} />}
        </span>
      </div>
      <div className="min-w-0 space-y-1">
        <TeamLine team={match.home} score={match.score.home} showScore={live || finished} strong={winner === "HOME"} />
        <TeamLine team={match.away} score={match.score.away} showScore={live || finished} strong={winner === "AWAY"} />
      </div>
      <div className="text-right text-xs text-text-muted">
        {match.phase === "BETTING_OPEN" && <span className="rounded-xs bg-brand-subtle px-1.5 py-0.5 font-semibold text-brand">{match.openMarkets} markets</span>}
      </div>
      <ChevronRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function TeamLine({ team, score, showScore, strong }: { readonly team: MatchSummary["home"]; readonly score: number; readonly showScore: boolean; readonly strong: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <TeamBadge team={team} size="xs" />
      <span className={cn("min-w-0 flex-1 truncate text-base", strong ? "font-semibold text-text-primary" : "font-medium text-text-secondary")}>{team.name}</span>
      {showScore && <span className={cn("w-4 text-right text-base tabular", strong ? "font-bold text-text-primary" : "font-semibold text-text-secondary")}>{score}</span>}
    </div>
  );
}
