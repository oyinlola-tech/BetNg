import { useEffect, useId } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, Info, MapPin } from "lucide-react";
import {
  DataSourceError,
  canBet,
  formatDateTime,
  formatMatchday,
  isFinished,
  isInPlay,
  isInterrupted,
  isUpcoming,
  phaseDescription,
  type MatchView,
} from "@betng/ui-core";
import {
  Breadcrumbs,
  Countdown,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  HeadToHead,
  LeagueTable,
  MatchLineups,
  MatchSkeleton,
  MatchTimeline,
  NotFoundState,
  PitchView,
  Scoreboard,
  SectionHeading,
  StaleBadge,
  StatsPanel,
  TabPanel,
  TableSkeleton,
  Tabs,
} from "@betng/ui-web";
import { MarketsPanel } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useHeadToHead, useLineups, useMatchProbe, useStandings } from "../hooks/queries";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { keys } from "../lib/queryKeys";
import { paths } from "../lib/paths";
import { useTabParam } from "../lib/useTabParam";
import { dataSource } from "../services/runtime";

const TABS = ["overview", "timeline", "stats", "lineups", "markets", "h2h", "table"] as const;

type MatchTab = (typeof TABS)[number];

function isUnavailable(error: unknown): boolean {
  return error instanceof DataSourceError && (error.code === "NOT_IMPLEMENTED" || error.code === "NOT_FOUND");
}

function Notice({ icon, children }: { readonly icon: React.ReactNode; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text-secondary">
      <span className="mt-0.5 shrink-0 text-text-muted" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function PhaseNotice({ match }: { readonly match: MatchView }): React.JSX.Element | null {
  if (isInterrupted(match.phase) || match.phase === "CANCELLED") {
    return <Notice icon={<Info className="size-4" />}>{match.statusReason ?? phaseDescription(match.phase)}</Notice>;
  }

  if (match.phase === "SETTLED") {
    return <Notice icon={<CheckCircle2 className="size-4" />}>Full time. Bets on this match have been settled by the platform.</Notice>;
  }

  if (match.phase === "FINISHED") {
    return <Notice icon={<Clock className="size-4" />}>Full time. Settlement is in progress; bets update when the platform completes it.</Notice>;
  }

  if (match.phase === "HALFTIME") return <Notice icon={<Clock className="size-4" />}>Half time. The second half starts shortly.</Notice>;

  return null;
}

function KickoffPanel({ match }: { readonly match: MatchView }): React.JSX.Element {
  return (
    <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
      <div className="bg-surface p-4">
        <dt className="type-caption">Kick-off</dt>
        <dd className="mt-1 type-data font-semibold">{formatDateTime(match.kickoffAt)}</dd>
        <dd className="type-small text-text-muted">
          In <Countdown to={match.kickoffAt} />
        </dd>
      </div>
      <div className="bg-surface p-4">
        <dt className="type-caption">Betting</dt>
        <dd className="mt-1 type-data font-semibold">{phaseDescription(match.phase)}</dd>
        {canBet(match.phase) && (
          <dd className="type-small text-text-muted">
            Closes in <Countdown to={match.bettingClosesAt} />
          </dd>
        )}
      </div>
      <div className="bg-surface p-4">
        <dt className="type-caption">Venue</dt>
        <dd className="mt-1 flex items-center gap-1.5 type-data font-semibold">
          <MapPin className="size-3.5 text-text-muted" aria-hidden />
          {match.home.stadium === "" ? "Not announced" : match.home.stadium}
        </dd>
        {match.home.city !== "" && <dd className="type-small text-text-muted">{match.home.city}</dd>}
      </div>
    </dl>
  );
}

function Overview({
  match,
  lastEvent,
  connection,
  onOpenTab,
}: {
  readonly match: MatchView;
  readonly lastEvent: ReturnType<typeof useLiveMatch>["lastEvent"];
  readonly connection: ReturnType<typeof useLiveMatch>["connection"];
  readonly onOpenTab: (tab: MatchTab) => void;
}): React.JSX.Element {
  const upcoming = isUpcoming(match.phase);
  const more = (tab: MatchTab, label: string): React.JSX.Element => (
    <button
      type="button"
      onClick={() => {
        onOpenTab(tab);
      }}
      className="inline-flex items-center gap-0.5 rounded-xs text-sm font-semibold text-brand hover:underline focus-ring"
    >
      {label}
      <ChevronRight className="size-3.5" aria-hidden />
    </button>
  );

  return (
    <div className="space-y-6">
      <PhaseNotice match={match} />
      {upcoming && <KickoffPanel match={match} />}
      {isInPlay(match.phase) && (
        <ErrorBoundary scope="feature">
          <PitchView match={match} lastEvent={lastEvent} connection={connection === "FAILED" ? "OFFLINE" : connection} />
        </ErrorBoundary>
      )}
      {upcoming ? (
        <section aria-labelledby="overview-markets">
          <SectionHeading id="overview-markets" action={more("markets", "All markets")}>
            Markets
          </SectionHeading>
          <MarketsPanel match={match} className="mt-3" />
        </section>
      ) : (
        <div className="grid gap-6 2xl:grid-cols-2">
          <section aria-labelledby="overview-events" className="min-w-0">
            <SectionHeading id="overview-events" action={more("timeline", "Full timeline")}>
              Key events
            </SectionHeading>
            <div className="mt-3 rounded-md border border-border bg-surface px-3">
              <MatchTimeline match={match} events={match.events} keyEventsOnly limit={8} label="Key events" />
            </div>
          </section>
          <section aria-labelledby="overview-stats" className="min-w-0">
            <SectionHeading id="overview-stats" action={more("stats", "All statistics")}>
              Statistics
            </SectionHeading>
            <div className="mt-3 rounded-md border border-border bg-surface p-3">
              <StatsPanel match={match} stats={match.stats} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/** History back when the visit started inside the app; a deep link gets a plain way to the list instead. */
function MatchBack({ finished }: { readonly finished: boolean }): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const className = "inline-flex shrink-0 items-center gap-1 rounded-xs text-sm font-semibold text-text-secondary hover:text-text-primary focus-ring";

  if (location.key !== "default") {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          void navigate(-1);
        }}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </button>
    );
  }

  return (
    <Link to={finished ? paths.results : paths.virtuals} className={className}>
      <ArrowLeft className="size-4" aria-hidden />
      Back to matches
    </Link>
  );
}

export function MatchPage(): React.JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const tabsId = useId();
  const client = useQueryClient();
  const live = useLiveMatch(matchId);
  const { match, connection, lastEvent, resyncing, syncedAt } = live;
  const failed = live.error !== undefined && match === undefined;
  const probe = useMatchProbe(matchId, failed);
  const [tab, setTab] = useTabParam(TABS, "overview");
  const standings = useStandings(tab === "table" ? match?.leagueId : undefined, match?.season);
  const lineups = useLineups(matchId, tab === "lineups" && match !== undefined);
  const headToHead = useHeadToHead(matchId, tab === "h2h" && match !== undefined);
  const stale = connection === "RECONNECTING" || connection === "OFFLINE" || connection === "FAILED";
  const loadedId = match?.id;
  const marketsVersion = `${match?.updatedAt ?? ""}|${match?.lifecycle ?? ""}|${match?.phase ?? ""}`;

  usePageMeta({
    title: match === undefined ? "Match" : `${match.home.name} v ${match.away.name} — ${match.leagueName}`,
    ...(match === undefined
      ? {}
      : { description: `${match.home.name} v ${match.away.name}, ${match.leagueName} ${formatMatchday(match.matchday).toLowerCase()}: score, timeline, statistics, lineups and markets.` }),
    ...(matchId === undefined ? {} : { path: paths.match(matchId) }),
  });

  useEffect(() => {
    if (loadedId !== undefined) dataSource.recordView(loadedId);
  }, [loadedId]);

  useEffect(() => {
    if (loadedId === undefined) return;

    void client.invalidateQueries({ queryKey: keys.markets(loadedId) });
  }, [client, loadedId, marketsVersion]);

  if (matchId === undefined || (probe.error instanceof DataSourceError && probe.error.code === "NOT_FOUND")) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-border bg-surface">
        <h1 className="sr-only">Match not found</h1>
        <NotFoundState
          title="Match not found"
          description="This match does not exist on the platform, or it is no longer listed."
          action={
            <Link to={paths.virtuals} className="rounded-xs text-base font-semibold text-brand hover:underline focus-ring">
              See fixtures
            </Link>
          }
        />
      </div>
    );
  }

  if (failed && probe.isError) {
    return (
      <div className="rounded-md border border-border bg-surface">
        <h1 className="sr-only">Match</h1>
        <ErrorState
          error={probe.error}
          onRetry={() => {
            live.resync();
            void probe.refetch();
          }}
        />
      </div>
    );
  }

  if (match === undefined) {
    return (
      <div>
        <h1 className="sr-only">Loading match</h1>
        <MatchSkeleton markets />
      </div>
    );
  }

  const finished = isFinished(match.phase);
  const label = `${match.home.name} v ${match.away.name}`;

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <MatchBack finished={finished} />
        <Breadcrumbs
          className="text-text-muted"
          items={[
            { label: finished ? "Results" : "Fixtures", to: finished ? paths.results : paths.virtuals },
            { label: match.leagueName, to: paths.league(match.leagueId) },
            { label: formatMatchday(match.matchday) },
            { label },
          ]}
        />
      </div>

      <header className="rounded-md border border-border bg-surface px-3 py-5 md:px-8 md:py-6">
        <h1 className="sr-only">{label}</h1>
        <Scoreboard
          match={match}
          stale={stale}
          staleIndicator={<StaleBadge updatedAt={syncedAt} />}
        />
        <nav aria-label="Team pages" className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 type-small">
          <span className="type-caption">Team pages</span>
          <Link to={paths.team(match.home.id)} className="rounded-xs text-text-secondary hover:text-brand focus-ring">
            {match.home.name}
          </Link>
          <span aria-hidden className="text-text-muted">
            ·
          </span>
          <Link to={paths.team(match.away.id)} className="rounded-xs text-text-secondary hover:text-brand focus-ring">
            {match.away.name}
          </Link>
        </nav>
        {resyncing && (
          <p role="status" className="mt-2 text-center type-small text-text-muted">
            Checking the latest state with the platform
          </p>
        )}
      </header>

      <Tabs
        id={tabsId}
        label="Match sections"
        scrollable
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Overview" },
          { value: "timeline", label: "Timeline", ...(match.events.length > 0 ? { count: match.events.length } : {}) },
          { value: "stats", label: "Stats" },
          { value: "lineups", label: "Lineups" },
          { value: "markets", label: "Markets", ...(match.openMarkets > 0 ? { count: match.openMarkets } : {}) },
          { value: "h2h", label: "Head to Head" },
          { value: "table", label: "Table" },
        ]}
      />

      <TabPanel tabsId={tabsId} value="overview" active={tab}>
        <Overview match={match} lastEvent={lastEvent} connection={connection} onOpenTab={setTab} />
      </TabPanel>

      <TabPanel tabsId={tabsId} value="timeline" active={tab}>
        <div className="rounded-md border border-border bg-surface px-3">
          {match.events.length === 0 ? (
            <EmptyState compact title={isUpcoming(match.phase) ? "The match has not started" : "No events reported"} description="Events appear here as the platform reports them." />
          ) : (
            <MatchTimeline match={match} events={match.events} />
          )}
        </div>
      </TabPanel>

      <TabPanel tabsId={tabsId} value="stats" active={tab}>
        <div className="rounded-md border border-border bg-surface p-3 md:p-5">
          <StatsPanel match={match} stats={match.stats} />
        </div>
      </TabPanel>

      <TabPanel tabsId={tabsId} value="lineups" active={tab}>
        <ErrorBoundary scope="feature">
          <div className="rounded-md border border-border bg-surface p-3 md:p-5">
            {lineups.isError && !isUnavailable(lineups.error) ? (
              <ErrorState compact error={lineups.error} onRetry={() => void lineups.refetch()} />
            ) : (
              <MatchLineups lineups={lineups.data} home={match.home} away={match.away} loading={lineups.isPending} />
            )}
          </div>
        </ErrorBoundary>
      </TabPanel>

      <TabPanel tabsId={tabsId} value="markets" active={tab}>
        <MarketsPanel match={match} />
      </TabPanel>

      <TabPanel tabsId={tabsId} value="h2h" active={tab}>
        <ErrorBoundary scope="feature">
          <div className="rounded-md border border-border bg-surface p-3 md:p-5">
            {headToHead.isError && isUnavailable(headToHead.error) ? (
              <EmptyState compact title="Head to head not available" description="The platform has not published previous meetings for this match." />
            ) : headToHead.isError ? (
              <ErrorState compact error={headToHead.error} onRetry={() => void headToHead.refetch()} />
            ) : (
              <HeadToHead
                headToHead={headToHead.data}
                home={match.home}
                away={match.away}
                loading={headToHead.isPending}
                meetingHref={(meeting) => paths.match(meeting.matchId)}
              />
            )}
          </div>
        </ErrorBoundary>
      </TabPanel>

      <TabPanel tabsId={tabsId} value="table" active={tab}>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          {standings.isError && standings.data === undefined ? (
            <ErrorState compact error={standings.error} onRetry={() => void standings.refetch()} />
          ) : standings.data === undefined ? (
            <TableSkeleton rows={10} columns={8} />
          ) : standings.data.rows.length === 0 ? (
            <EmptyState compact title="No table yet" description="The table appears once the first matchday is complete." />
          ) : (
            <LeagueTable standings={standings.data} highlightTeamIds={[match.home.id, match.away.id]} teamHref={(row) => paths.team(row.team.id)} />
          )}
        </div>
      </TabPanel>
    </div>
  );
}
