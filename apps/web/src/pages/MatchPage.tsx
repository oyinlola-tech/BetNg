import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import {
  formatMatchday,
  isFinished,
  isInPlay,
  type MatchPhase,
} from "@betng/ui-core";
import {
  LeagueTable,
  MarketsPanel,
  MatchTimeline,
  PitchView,
  Scoreboard,
  StatsPanel,
} from "../components/domain";
import {
  Button,
  ErrorState,
  SectionHeader,
  Skeleton,
  SkeletonRows,
  Tabs,
} from "../components/ui";
import { useMatches, useStandings } from "../hooks/queries";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { cn } from "../lib/cn";
import { dataSource } from "../services/dataSource";

type Panel = "EVENTS" | "STATS" | "STANDINGS";

function subtitle(phase: MatchPhase): string {
  if (isInPlay(phase)) return "Live match";
  if (isFinished(phase)) return "Match report";
  return "Match preview";
}

export function MatchPage(): React.JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const [params, setParams] = useSearchParams();
  const watch = params.get("view") === "watch";
  const { match, connection, error, lastEvent, resyncing } =
    useLiveMatch(matchId);
  const [panel, setPanel] = useState<Panel>("EVENTS");
  const standings = useStandings(match?.leagueId);
  const others = useMatches(
    { phases: ["LIVE", "HALFTIME"] },
    { refetchMs: 4000 },
  );

  useEffect(() => {
    if (matchId !== undefined) dataSource.recordView(matchId as never);
  }, [matchId]);

  if (error !== undefined && match === undefined) {
    return (
      <ErrorState
        error={new Error(error)}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (match === undefined) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-4 w-40" />
        <div className="rounded-md border border-border bg-surface p-6">
          <Skeleton className="h-24" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="aspect-video" />
          <SkeletonRows rows={6} />
        </div>
      </div>
    );
  }

  const live = isInPlay(match.phase);

  return (
    <div className={cn("space-y-5", watch && "xl:-mx-6")}>
      <div className="flex items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-text-muted"
        >
          <Link
            to={isFinished(match.phase) ? "/results" : "/virtuals"}
            className="inline-flex items-center gap-0.5 rounded-xs hover:text-text-primary focus-ring"
          >
            <ChevronLeft className="size-4" />
            {isFinished(match.phase) ? "Results" : "Virtual Football"}
          </Link>
          <span aria-hidden>/</span>
          <Link
            to={`/leagues/${match.leagueId}`}
            className="rounded-xs hover:text-text-primary focus-ring"
          >
            {match.leagueName}
          </Link>
          <span aria-hidden>/</span>
          <span>{formatMatchday(match.matchday)}</span>
        </nav>
        <Button
          variant="secondary"
          size="sm"
          icon={
            watch ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )
          }
          onClick={() => {
            setParams(watch ? {} : { view: "watch" }, { replace: true });
          }}
        >
          {watch ? "Exit theatre" : "Theatre mode"}
        </Button>
      </div>

      <header className="rounded-md border border-border bg-surface px-4 py-5 md:px-8 md:py-6">
        <p className="caps-label mb-3 text-center">
          {subtitle(match.phase)} · Season {match.season} · {match.home.stadium}
        </p>
        <Scoreboard match={match} />
        {resyncing && (
          <p role="status" className="mt-3 text-center text-xs text-text-muted">
            Resynchronising with the platform…
          </p>
        )}
      </header>

      <div
        className={cn(
          "grid gap-4",
          watch
            ? "xl:grid-cols-[minmax(0,3fr)_minmax(20rem,1fr)]"
            : "lg:grid-cols-[minmax(0,5fr)_minmax(18rem,2fr)]",
        )}
      >
        <PitchView
          match={match}
          lastEvent={lastEvent}
          connection={connection}
        />
        <aside
          className="flex min-h-0 flex-col rounded-md border border-border bg-surface"
          aria-label="Match information"
        >
          <Tabs
            label="Match information"
            value={panel}
            onChange={setPanel}
            className="px-3"
            items={[
              {
                value: "EVENTS",
                label: "Events",
                count: match.events.filter((e) => e.kind === "GOAL").length,
              },
              { value: "STATS", label: "Stats" },
              { value: "STANDINGS", label: "Table" },
            ]}
          />
          <div className="max-h-[32rem] min-h-[18rem] overflow-y-auto px-3 py-2 scrollbar-thin">
            {panel === "EVENTS" && (
              <MatchTimeline
                match={match}
                events={match.events}
                keyEventsOnly
              />
            )}
            {panel === "STATS" && (
              <StatsPanel match={match} stats={match.stats} className="py-2" />
            )}
            {panel === "STANDINGS" &&
              (standings.data === undefined ? (
                <SkeletonRows rows={6} className="py-2" />
              ) : (
                <LeagueTable
                  standings={standings.data}
                  compact
                  highlightTeamIds={[match.home.id, match.away.id]}
                  className="-mx-3"
                />
              ))}
          </div>
        </aside>
      </div>

      {live && others.data !== undefined && others.data.length > 1 && (
        <nav
          aria-label="Other live matches"
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
        >
          {others.data.map((m) => (
            <Link
              key={m.id}
              to={`/matches/${m.id}${watch ? "?view=watch" : ""}`}
              aria-current={m.id === match.id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium focus-ring",
                m.id === match.id
                  ? "border-brand bg-brand-subtle text-text-primary"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
              )}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-live animate-pulse-live"
              />
              {m.home.code}{" "}
              <span className="tabular font-bold text-text-primary">
                {m.score.home}–{m.score.away}
              </span>{" "}
              {m.away.code}
            </Link>
          ))}
        </nav>
      )}

      <section aria-labelledby="markets">
        <SectionHeader
          title="Markets"
          eyebrow={match.phase === "BETTING_OPEN" ? "Open" : "Closed"}
          className="mb-4"
        />
        <MarketsPanel match={match} />
      </section>

      <section aria-labelledby="full-timeline">
        <SectionHeader title="Full timeline" className="mb-2" />
        <div className="rounded-md border border-border bg-surface px-3">
          <MatchTimeline match={match} events={match.events} />
        </div>
      </section>
    </div>
  );
}
