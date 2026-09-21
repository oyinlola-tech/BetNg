import type {
  MatchEventView,
  MatchStats,
  MatchSummary,
} from "@betng/ui-core";
import { MatchCard } from "../match/MatchCard";

export interface LiveMatchCardProps {
  readonly match: MatchSummary;
  readonly to?: string | undefined;
  readonly lastEvent?: MatchEventView | undefined;
  readonly stats?: MatchStats | undefined;
  readonly stale?: boolean;
  readonly className?: string | undefined;
}

export function LiveMatchCard({
  match,
  to,
  lastEvent,
  stats,
  stale = false,
  className,
}: LiveMatchCardProps): React.JSX.Element {
  return (
    <MatchCard
      variant="live"
      match={match}
      to={to ?? `/matches/${match.id}?view=watch`}
      lastEvent={lastEvent}
      stats={stats}
      stale={stale}
      className={className}
    />
  );
}
