import { Radio } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LiveMatchCard,
  MatchCardSkeleton,
  SectionHeader,
  UpcomingMatchCard,
} from "@betng/ui-web";
import { useMatches } from "../hooks/queries";

export function LivePage(): React.JSX.Element {
  const live = useMatches(
    { phases: ["LIVE", "HALFTIME"] },
    { refetchMs: 3000 },
  );
  const next = useMatches({
    phases: ["BETTING_OPEN", "BETTING_CLOSED"],
    limit: 6,
  });

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader
          as="h1"
          eyebrow="In play"
          title="Live matches"
          className="mb-4"
        />
        {live.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : live.isError ? (
          <ErrorState error={live.error} onRetry={() => void live.refetch()} />
        ) : live.data.length === 0 ? (
          <EmptyState
            icon={<Radio className="size-5" />}
            title="No matches in play"
            description="The next matchday kicks off shortly."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {live.data.map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionHeader title="Up next" to="/virtuals" className="mb-4" />
        {next.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : next.isError ? (
          <ErrorState
            compact
            error={next.error}
            onRetry={() => void next.refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {next.data.map((m) => (
              <UpcomingMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
