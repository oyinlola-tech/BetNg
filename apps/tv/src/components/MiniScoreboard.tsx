import { formatKickoffTime, type MatchSummary } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { Countdown } from "./Countdown";
import { FavouriteMark } from "./FavouriteMark";
import { TeamMark } from "./TeamMark";

/* An upcoming match at a glance: teams, the platform's kick-off time and the time left to it. */
export function MiniScoreboard({ match, followed = false, className }: { readonly match: MatchSummary; readonly followed?: boolean; readonly className?: string }): React.JSX.Element {
  return (
    <div className={cn("flex items-center gap-[0.7rem] border border-border bg-surface px-[0.9rem] py-[0.55rem]", className)}>
      <span className="text-[0.75rem] font-bold uppercase tracking-caps text-text-muted">{match.leagueCode}</span>
      <TeamMark team={match.home} size="sm" />
      <span className="font-display text-[1.1rem] font-black">{match.home.code}</span>
      <span className="text-[0.9rem] text-text-muted">v</span>
      <span className="font-display text-[1.1rem] font-black">{match.away.code}</span>
      <TeamMark team={match.away} size="sm" />
      {followed && <FavouriteMark className="text-[0.9rem]" />}
      <span className="ml-auto text-right leading-tight">
        <Countdown to={match.kickoffAt} className="block font-display text-[1.2rem] font-black" />
        <span className="block text-[0.75rem] tabular text-text-muted">{formatKickoffTime(match.kickoffAt)}</span>
      </span>
    </div>
  );
}
