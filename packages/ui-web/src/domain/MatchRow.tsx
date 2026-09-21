import type { MatchSummary } from "@betng/ui-core";
import { MatchCard } from "../match/MatchCard";

export interface MatchRowProps {
  readonly match: MatchSummary;
  readonly showLeague?: boolean;
  readonly to?: string | undefined;
  readonly markets?: React.ReactNode;
  readonly stale?: boolean;
  readonly className?: string | undefined;
}

export function MatchRow({
  match,
  showLeague = false,
  to,
  markets,
  stale = false,
  className,
}: MatchRowProps): React.JSX.Element {
  return (
    <MatchCard
      variant="compact"
      match={match}
      to={to ?? `/matches/${match.id}`}
      showCompetition={showLeague}
      markets={markets}
      stale={stale}
      className={className}
    />
  );
}
