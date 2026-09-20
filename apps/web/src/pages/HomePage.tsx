import { Link } from "react-router";
import { Radio, Trophy } from "lucide-react";
import { toLocalDateKey } from "@betng/ui-core";
import {
  EmptyState,
  ErrorState,
  LeagueTable,
  LiveMatchCard,
  MatchCardSkeleton,
  MatchRow,
  SectionHeader,
  SkeletonRows,
  UpcomingMatchCard,
} from "@betng/ui-web";
import { useLeagues, useMatches, useStandings } from "../hooks/queries";

export function HomePage(): React.JSX.Element {
  const live = useMatches(
    { phases: ["LIVE", "HALFTIME"] },
    { refetchMs: 3000 },
  );
  const soon = useMatches({
    phases: ["BETTING_OPEN", "BETTING_CLOSED"],
    limit: 6,
  });
  const recent = useMatches({ phases: ["FINISHED", "SETTLED"], limit: 8 });
  const today = useMatches({ date: toLocalDateKey(new Date()), limit: 10 });
  const leagues = useLeagues();
  const firstLeague = leagues.data?.[0];
  const standings = useStandings(firstLeague?.id);

  return (
    <div className="space-y-10">
      <section aria-labelledby="live-now">
        <SectionHeader
          as="h1"
          eyebrow="Virtual football"
          title="Live now"
          to="/live"
          linkLabel="All live"
          className="mb-4"
        />
        {live.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : live.isError ? (
          <ErrorState
            compact
            error={live.error}
            onRetry={() => void live.refetch()}
          />
        ) : live.data.length === 0 ? (
          <EmptyState
            compact
            icon={<Radio className="size-5" />}
            title="No matches in play"
            description="The next matchday kicks off shortly — see what's starting soon."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {live.data.slice(0, 6).map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="starting-soon">
        <SectionHeader
          title="Starting soon"
          to="/virtuals"
          linkLabel="Open lobby"
          className="mb-4"
        />
        {soon.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : soon.isError ? (
          <ErrorState
            compact
            error={soon.error}
            onRetry={() => void soon.refetch()}
          />
        ) : soon.data.length === 0 ? (
          <EmptyState
            compact
            title="Nothing scheduled"
            description="Fixtures for the next matchday will appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {soon.data.map((m) => (
              <UpcomingMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,22rem)] xl:grid-cols-[1fr_minmax(0,26rem)]">
        <div className="space-y-10">
          <section aria-labelledby="featured-leagues">
            <SectionHeader
              title="Competitions"
              to="/leagues"
              className="mb-4"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {(leagues.data ?? []).map((l) => (
                <Link
                  key={l.id}
                  to={`/leagues/${l.id}`}
                  className="flex items-center gap-4 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-ring"
                >
                  <span className="flex size-11 items-center justify-center rounded-md bg-surface-sunken font-display text-sm font-bold text-text-secondary">
                    {l.code}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-md font-semibold">
                      {l.name}
                    </span>
                    <span className="block text-sm text-text-muted">
                      {l.teamCount} clubs · Season {l.currentSeason} · Matchday{" "}
                      {String(l.currentMatchday).padStart(2, "0")} of{" "}
                      {l.matchdays}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="todays-matches">
            <SectionHeader
              title="Today's matches"
              to="/virtuals"
              className="mb-2"
            />
            <div className="rounded-md border border-border bg-surface">
              {today.isPending ? (
                <SkeletonRows rows={5} className="p-4" />
              ) : today.isError ? (
                <ErrorState
                  compact
                  error={today.error}
                  onRetry={() => void today.refetch()}
                />
              ) : today.data.length === 0 ? (
                <EmptyState compact title="No matches today" />
              ) : (
                <div className="divide-y divide-border">
                  {today.data
                    .slice(-8)
                    .reverse()
                    .map((m) => (
                      <MatchRow key={m.id} match={m} showLeague />
                    ))}
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="recent-results">
            <SectionHeader
              title="Recent results"
              to="/results"
              className="mb-2"
            />
            <div className="rounded-md border border-border bg-surface">
              {recent.isPending ? (
                <SkeletonRows rows={5} className="p-4" />
              ) : recent.isError ? (
                <ErrorState
                  compact
                  error={recent.error}
                  onRetry={() => void recent.refetch()}
                />
              ) : recent.data.length === 0 ? (
                <EmptyState
                  compact
                  title="No results yet"
                  description="Results land here as matches finish."
                />
              ) : (
                <div className="divide-y divide-border">
                  {recent.data.map((m) => (
                    <MatchRow key={m.id} match={m} showLeague />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <section
          aria-labelledby="standings-preview"
          className="lg:sticky lg:top-20"
        >
          <SectionHeader
            title={firstLeague?.code ?? "Standings"}
            eyebrow="League table"
            to="/standings"
            className="mb-2"
          />
          <div className="rounded-md border border-border bg-surface">
            {standings.isPending ? (
              <SkeletonRows rows={8} className="p-4" />
            ) : standings.isError ? (
              <ErrorState
                compact
                error={standings.error}
                onRetry={() => void standings.refetch()}
              />
            ) : standings.data.rows.length === 0 ? (
              <EmptyState
                compact
                icon={<Trophy className="size-5" />}
                title="Season just started"
              />
            ) : (
              <LeagueTable standings={standings.data} compact />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
