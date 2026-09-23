import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CircleHelp, ListOrdered, Radio, Search, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatKickoffTime, formatMatchday, formatShortDate, type LeagueView } from "@betng/ui-core";
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  FeatureGate,
  Football,
  LeagueMark,
  LeagueTable,
  LiveDot,
  MatchCard,
  SectionHeading,
  Select,
  Skeleton,
  TableSkeleton,
  useFeatureFlags,
} from "@betng/ui-web";
import { MatchList, ResultMarket } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useSearchDialog } from "../features/search";
import { useIsStale } from "../hooks/useConnection";
import { useLeagues, useMatches, useStandings } from "../hooks/queries";
import { paths } from "../lib/paths";

const LIVE_PHASES = ["LIVE", "HALFTIME"] as const;
/* Open for play means open: a match the platform has closed cannot be acted on, so it belongs under "starting soon", never here. */
const OPEN_PHASES = ["BETTING_OPEN"] as const;
const STARTING_PHASES = ["BETTING_CLOSED", "DELAYED"] as const;
const FINISHED_PHASES = ["FINISHED", "SETTLED"] as const;

function More({ to, children }: { readonly to: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <Link to={to} className="inline-flex items-center gap-1 rounded-xs text-sm font-semibold text-brand hover:underline focus-ring">
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function ContextHero({ live }: { readonly live: ReturnType<typeof useMatches> }): React.JSX.Element {
  const stale = useIsStale();
  const next = useMatches({ phases: [...OPEN_PHASES, ...STARTING_PHASES, "SCHEDULED"], limit: 1 });
  const liveMatch = live.data?.[0];
  const match = liveMatch ?? next.data?.[0];

  if (match === undefined) {
    if ((live.isPending && live.fetchStatus !== "idle") || next.isPending) return <MatchCard.Skeleton variant="featured" />;
    if (live.isError && next.isError) return <MatchCard.Error variant="featured" onRetry={() => void next.refetch()} />;

    return (
      <div className="rounded-md border border-border bg-surface">
        <EmptyState preset="noUpcomingMatches" />
      </div>
    );
  }

  return (
    <div>
      <p className="type-caption mb-2">{liveMatch === undefined ? "Next kick-off" : "Live now"}</p>
      <MatchCard
        match={match}
        variant="featured"
        to={paths.match(match.id)}
        stale={stale && liveMatch !== undefined}
        markets={<ResultMarket match={match} className="max-w-md" />}
      />
    </div>
  );
}

function CompetitionCard({ league }: { readonly league: LeagueView }): React.JSX.Element {
  const live = useMatches({ leagueId: league.id, phases: LIVE_PHASES }, { pace: "slow" });
  const next = useMatches({ leagueId: league.id, phases: [...OPEN_PHASES, ...STARTING_PHASES, "SCHEDULED"], limit: 1 }, { pace: "slow" });
  const liveCount = live.data?.length ?? 0;
  const upcoming = next.data?.[0];

  return (
    <Link
      to={`${paths.virtuals}?league=${encodeURIComponent(league.id)}`}
      className="group flex flex-col gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-ring"
    >
      <span className="flex items-center gap-3">
        <LeagueMark slug={league.slug} code={league.code} size={32} />
        <span className="min-w-0">
          <span className="block truncate type-h3">{league.name}</span>
          <span className="block truncate type-small text-text-muted">
            {league.country} · {formatMatchday(league.currentMatchday)} of {league.matchdays}
          </span>
        </span>
      </span>
      <span className="flex items-center justify-between gap-2 border-t border-border pt-3 type-small">
        <span className="text-text-secondary">
          {next.isPending ? (
            <Skeleton className="h-3.5 w-24" />
          ) : upcoming === undefined ? (
            "No kick-off scheduled"
          ) : (
            <>
              Next kick-off <span className="tabular font-semibold text-text-primary">{formatKickoffTime(upcoming.kickoffAt)}</span>
            </>
          )}
        </span>
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-live">
            <LiveDot />
            <span className="tabular">{liveCount}</span> live
          </span>
        )}
      </span>
    </Link>
  );
}

function Competitions(): React.JSX.Element {
  const leagues = useLeagues();

  if (leagues.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Loading competitions">
        {[0, 1, 2, 3].map((slot) => (
          <Skeleton key={slot} className="h-28" />
        ))}
      </div>
    );
  }

  if (leagues.isError) return <ErrorState compact error={leagues.error} onRetry={() => void leagues.refetch()} />;

  if (leagues.data.length === 0) return <EmptyState compact title="No competitions" description="The platform has no active competitions right now." />;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {leagues.data.map((league) => (
        <li key={league.id}>
          <CompetitionCard league={league} />
        </li>
      ))}
    </ul>
  );
}

function StandingsPreview(): React.JSX.Element {
  const leagues = useLeagues();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const leagueId = picked ?? leagues.data?.[0]?.id;
  const standings = useStandings(leagueId);

  return (
    <section aria-labelledby="home-standings">
      <SectionHeading id="home-standings" action={<More to={leagueId === undefined ? paths.standings : `${paths.standings}?league=${encodeURIComponent(leagueId)}`}>Full table</More>}>
        Standings
      </SectionHeading>
      <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface">
        {leagues.data !== undefined && leagueId !== undefined && leagues.data.length > 1 && (
          <div className="border-b border-border p-2">
            <Select
              label="Competition"
              size="sm"
              value={leagueId}
              onChange={setPicked}
              options={leagues.data.map((league) => ({ value: league.id, label: league.name }))}
              className="w-full"
            />
          </div>
        )}
        {standings.isError ? (
          <ErrorState compact error={standings.error} onRetry={() => void standings.refetch()} />
        ) : standings.data === undefined ? (
          <TableSkeleton rows={6} columns={4} />
        ) : standings.data.rows.length === 0 ? (
          <EmptyState compact title="No table yet" description="The table appears once the first matchday is complete." />
        ) : (
          <LeagueTable
            standings={{ ...standings.data, rows: standings.data.rows.slice(0, 8) }}
            density="compact"
            responsive={false}
            teamHref={(row) => paths.team(row.team.id)}
          />
        )}
      </div>
    </section>
  );
}

interface QuickLink {
  readonly to: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: LucideIcon | typeof Football;
}

function QuickNavigation(): React.JSX.Element {
  const flags = useFeatureFlags();
  const showSearch = useSearchDialog((s) => s.show);
  const links: readonly QuickLink[] = [
    ...(flags.liveEnabled ? [{ to: paths.live, label: "Live", hint: "Matches in play", icon: Radio }] : []),
    ...(flags.virtualFootballEnabled ? [{ to: paths.virtuals, label: "Virtuals", hint: "Fixtures and prices", icon: Football }] : []),
    { to: paths.results, label: "Results", hint: "Full-time scores", icon: ListOrdered },
    { to: paths.standings, label: "Standings", hint: "League tables", icon: Trophy },
    { to: paths.help(), label: "Help", hint: "How BETNG works", icon: CircleHelp },
  ];
  const tile = "flex min-h-14 items-center gap-3 rounded-md border border-border bg-surface px-3 text-left transition-colors hover:border-border-strong focus-ring";

  return (
    <section aria-labelledby="home-quick">
      <SectionHeading id="home-quick">Quick navigation</SectionHeading>
      <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1 2xl:grid-cols-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={tile}>
              <link.icon className="size-5 shrink-0 text-text-muted" aria-hidden />
              <span className="min-w-0">
                <span className="block text-base font-semibold">{link.label}</span>
                <span className="block truncate type-small text-text-muted">{link.hint}</span>
              </span>
            </Link>
          </li>
        ))}
        {flags.searchEnabled && (
          <li>
            <button type="button" onClick={showSearch} className={`${tile} w-full`}>
              <Search className="size-5 shrink-0 text-text-muted" aria-hidden />
              <span className="min-w-0">
                <span className="block text-base font-semibold">Search</span>
                <span className="block truncate type-small text-text-muted">Teams, matches, players</span>
              </span>
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

export function HomePage(): React.JSX.Element {
  const stale = useIsStale();
  const flags = useFeatureFlags();
  const live = useMatches({ phases: LIVE_PHASES, limit: 5 }, { enabled: flags.liveEnabled });
  const soon = useMatches({ phases: OPEN_PHASES, limit: 4 });
  const starting = useMatches({ phases: STARTING_PHASES, limit: 4 });
  const upcoming = useMatches({ phases: ["SCHEDULED"], limit: 6 }, { pace: "slow" });
  const results = useMatches({ phases: FINISHED_PHASES, limit: 6 }, { pace: "slow" });

  usePageMeta({ title: "BETNG", path: "/" });

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="type-h1">Football today</h1>
        <p className="type-data text-text-muted">{formatShortDate(new Date().toISOString())}</p>
      </header>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <ErrorBoundary scope="feature">
            <ContextHero live={live} />
          </ErrorBoundary>

          <FeatureGate flag="liveEnabled">
            <section aria-labelledby="home-live">
              <SectionHeading id="home-live" action={<More to={paths.live}>All live</More>}>
                Live matches
              </SectionHeading>
              {live.data?.length === 1 ? (
                <p className="type-small mt-3 text-text-muted">The match above is the only one in play right now.</p>
              ) : (
                <MatchList query={live} skip={1} limit={4} variant="live" layout="grid" empty="noLiveMatches" stale={stale} skeletons={2} label="Live matches" className="mt-3" />
              )}
            </section>
          </FeatureGate>

          <section aria-labelledby="home-soon">
            <SectionHeading id="home-soon" action={<More to={paths.football}>All football</More>}>
              Open for play
            </SectionHeading>
            <MatchList query={soon} variant="standard" layout="grid" withMarkets empty="noUpcomingMatches" label="Matches open for play" className="mt-3" />
          </section>

          {(starting.data?.length ?? 0) > 0 && (
            <section aria-labelledby="home-starting">
              <SectionHeading id="home-starting">Starting soon</SectionHeading>
              <p className="type-small mt-1 text-text-muted">Betting has closed. These matches kick off shortly.</p>
              <MatchList query={starting} variant="compact" empty="noUpcomingMatches" label="Matches starting soon" className="mt-3" />
            </section>
          )}

          <FeatureGate flag="virtualFootballEnabled">
            <section aria-labelledby="home-competitions">
              <SectionHeading id="home-competitions" action={<More to={paths.leagues}>All competitions</More>}>
                Virtual football
              </SectionHeading>
              <div className="mt-3">
                <Competitions />
              </div>
            </section>
          </FeatureGate>

          <section aria-labelledby="home-upcoming">
            <SectionHeading id="home-upcoming" action={<More to={`${paths.virtuals}?state=upcoming`}>Fixtures</More>}>
              Upcoming
            </SectionHeading>
            <MatchList query={upcoming} variant="standard" layout="grid" limit={4} empty="noUpcomingMatches" label="Upcoming matches" className="mt-3" />
          </section>

          <section aria-labelledby="home-results">
            <SectionHeading id="home-results" action={<More to={paths.results}>All results</More>}>
              Latest results
            </SectionHeading>
            <MatchList query={results} empty="noResults" label="Latest results" className="mt-3" />
          </section>
        </div>

        <div className="min-w-0 space-y-10">
          <ErrorBoundary scope="feature">
            <StandingsPreview />
          </ErrorBoundary>
          <QuickNavigation />
        </div>
      </div>
    </div>
  );
}
