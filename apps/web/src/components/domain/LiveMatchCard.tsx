import { Link } from "react-router";
import { Play } from "lucide-react";
import { formatBroadcastClock, matchClock, type MatchSummary } from "@betng/ui-core";
import { useNow } from "../../hooks/useNow";
import { cn } from "../../lib/cn";
import { PhaseBadge } from "./PhaseBadge";
import { TeamBadge } from "./TeamBadge";

export interface LiveMatchCardProps {
  readonly match: MatchSummary;
  readonly className?: string;
}

export function LiveMatchCard({ match, className }: LiveMatchCardProps): React.JSX.Element {
  const now = useNow(500);
  const clock = matchClock(match.kickoffAt, now);
  const progress = Math.min(100, (clock.minute / 90) * 100);

  return (
    <article className={cn("group relative overflow-hidden rounded-md border border-border bg-surface", className)}>
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          <PhaseBadge phase={match.phase} solid />
          <span className="text-xs font-medium text-text-muted">
            {match.leagueCode} · MD {String(match.matchday).padStart(2, "0")}
          </span>
        </div>
        <span className="text-sm font-semibold tabular text-live">
          {match.phase === "HALFTIME" ? "HT" : formatBroadcastClock(clock.minute, clock.second)}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 pb-4 pt-3">
        <div className="space-y-2.5">
          <Line team={match.home} score={match.score.home} />
          <Line team={match.away} score={match.score.away} />
        </div>
        <div className="flex items-end">
          <Link
            to={`/matches/${match.id}?view=watch`}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-surface-sunken px-3 text-sm font-semibold text-text-primary transition-colors group-hover:bg-brand group-hover:text-text-on-brand focus-ring"
          >
            <Play className="size-3.5" aria-hidden />
            Watch
          </Link>
        </div>
      </div>
      <div className="h-0.5 w-full bg-surface-sunken">
        <div className="h-full bg-live transition-[width] duration-1000 ease-linear" style={{ width: `${String(progress)}%` }} />
      </div>
    </article>
  );
}

function Line({ team, score }: { readonly team: MatchSummary["home"]; readonly score: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge team={team} size="sm" />
      <span className="min-w-0 flex-1 truncate font-display text-md font-semibold">{team.name}</span>
      <span className="w-6 text-right font-display text-2xl font-black tabular tracking-tight">{score}</span>
    </div>
  );
}
