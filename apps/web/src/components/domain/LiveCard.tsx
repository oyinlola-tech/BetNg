import type { MatchSummary } from "@betng/ui-core";
import { MatchCard } from "@betng/ui-web";
import { useLiveMatch } from "../../hooks/useLiveMatch";
import { paths } from "../../lib/paths";

/** A live card follows its own match stream, so the score, clock, last event and stats are the platform's latest. */
export function LiveCard({ summary, stale }: { readonly summary: MatchSummary; readonly stale: boolean }): React.JSX.Element {
  const live = useLiveMatch(summary.id);
  const match = live.match ?? summary;

  return (
    <MatchCard
      match={match}
      variant="live"
      to={paths.match(summary.id)}
      lastEvent={live.lastEvent ?? live.match?.events.at(-1)}
      stats={live.match?.stats}
      stale={stale}
      showCompetition={false}
    />
  );
}
