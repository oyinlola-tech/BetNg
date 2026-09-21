import type { MatchSummary } from "@betng/ui-core";
import { MatchCard } from "../match/MatchCard";

export interface UpcomingMatchCardProps {
  readonly match: MatchSummary;
  readonly to?: string | undefined;
  readonly markets?: React.ReactNode;
  readonly className?: string | undefined;
}

export function UpcomingMatchCard({
  match,
  to,
  markets,
  className,
}: UpcomingMatchCardProps): React.JSX.Element {
  return (
    <MatchCard
      variant="standard"
      match={match}
      to={to ?? `/matches/${match.id}`}
      markets={markets}
      className={className}
    />
  );
}
