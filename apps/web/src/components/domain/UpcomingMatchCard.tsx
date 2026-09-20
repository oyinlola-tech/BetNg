import { Link } from "react-router";
import { type MatchSummary } from "@betng/ui-core";
import { cn } from "../../lib/cn";
import { Countdown } from "./Countdown";
import { PhaseBadge } from "./PhaseBadge";
import { TeamBadge } from "./TeamBadge";

export interface UpcomingMatchCardProps {
  readonly match: MatchSummary;
  readonly odds?: readonly { readonly label: string; readonly value: number }[];
  readonly className?: string;
}

export function UpcomingMatchCard({
  match,
  className,
}: UpcomingMatchCardProps): React.JSX.Element {
  return (
    <Link
      to={`/matches/${match.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-ring",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <PhaseBadge phase={match.phase} />
        <span className="text-xs font-medium text-text-muted">
          {match.leagueCode} · MD {String(match.matchday).padStart(2, "0")}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Team team={match.home} />
        <div className="text-center">
          <Countdown
            to={match.kickoffAt}
            className="font-display text-xl font-bold tracking-tight"
          />
          <p className="text-[10px] font-semibold uppercase tracking-caps text-text-muted">
            kick-off
          </p>
        </div>
        <Team team={match.away} />
      </div>
    </Link>
  );
}

function Team({
  team,
}: {
  readonly team: MatchSummary["home"];
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <TeamBadge team={team} size="md" />
      <span className="w-full truncate text-sm font-semibold">
        {team.shortName}
      </span>
    </div>
  );
}
