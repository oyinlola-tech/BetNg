import { Link } from "react-router";
import { EmptyState, ErrorBoundary, ErrorState, LeagueMark, MatchCard, SectionHeading, StaleBadge } from "@betng/ui-web";
import { LiveCard, MatchList } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useIsStale, useLastSyncedAt } from "../hooks/useConnection";
import { useLeagues, useMatches } from "../hooks/queries";
import { groupByCompetition } from "../lib/matchGroups";
import { paths } from "../lib/paths";

const GRID = "grid gap-3 sm:grid-cols-2 2xl:grid-cols-3";

/* Each streamed card reads its match and holds a subscription, so only the leading cards follow their own stream. */
const STREAMED_CARDS = 6;

export function LivePage(): React.JSX.Element {
  const stale = useIsStale();
  const lastSyncedAt = useLastSyncedAt();
  const leagues = useLeagues();
  const live = useMatches({ phases: ["LIVE", "HALFTIME"] });
  const next = useMatches({ phases: ["BETTING_OPEN", "BETTING_CLOSED"], limit: 6 });
  const groups = groupByCompetition(live.data ?? []);
  const streamed = new Set((live.data ?? []).slice(0, STREAMED_CARDS).map((match) => match.id));

  usePageMeta({ title: "Live matches", description: "Virtual football matches in play on BETNG, with scores, events and statistics as the platform reports them." });

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="type-h1">Live</h1>
          <p className="mt-1 text-base text-text-secondary">Matches in play and at half time, by competition.</p>
        </div>
        {stale && <StaleBadge updatedAt={lastSyncedAt} />}
      </header>

      {live.isPending ? (
        <div className={GRID} role="status" aria-label="Loading live matches">
          {[0, 1, 2, 3].map((slot) => (
            <MatchCard.Skeleton key={slot} variant="live" />
          ))}
        </div>
      ) : live.isError && live.data === undefined ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState error={live.error} onRetry={() => void live.refetch()} />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState preset="noLiveMatches" />
        </div>
      ) : (
        groups.map((group) => {
          const league = leagues.data?.find((entry) => entry.id === group.leagueId);

          return (
            <section key={group.leagueId} aria-labelledby={`live-${group.leagueId}`}>
              <SectionHeading
                id={`live-${group.leagueId}`}
                action={
                  <Link to={paths.league(group.leagueId)} className="rounded-xs text-sm font-semibold text-brand hover:underline focus-ring">
                    Competition
                  </Link>
                }
              >
                <span className="inline-flex items-center gap-2">
                  <LeagueMark slug={league?.slug} code={group.leagueCode} size={20} />
                  {group.leagueName}
                </span>
              </SectionHeading>
              <ErrorBoundary scope="feature">
                <ul className={`${GRID} mt-3`} aria-label={`${group.leagueName} live matches`}>
                  {group.matches.map((match) => (
                    <li key={match.id} className="min-w-0">
                      {streamed.has(match.id) ? (
                        <LiveCard summary={match} stale={stale} />
                      ) : (
                        <MatchCard match={match} variant="live" to={paths.match(match.id)} stale={stale} showCompetition={false} />
                      )}
                    </li>
                  ))}
                </ul>
              </ErrorBoundary>
            </section>
          );
        })
      )}

      <section aria-labelledby="live-next">
        <SectionHeading id="live-next">Up next</SectionHeading>
        <MatchList query={next} withMarkets empty="noUpcomingMatches" label="Matches up next" className="mt-3" />
      </section>
    </div>
  );
}
