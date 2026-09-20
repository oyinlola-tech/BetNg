import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { VIRTUAL_TIMING } from "@betng/ui-core";
import { EmptyState, ErrorState, LeagueMark, LeagueTable, LoadingState, Panel, SkeletonRows, Tabs } from "@betng/ui-web";
import { Field, Status } from "../components/Bits";
import { FixtureTable } from "../components/FixtureTable";
import { RequirePermission } from "../components/Guard";
import { MarketsBoard } from "../components/MarketsBoard";
import { PageHeader } from "../components/PageHeader";
import { TeamsTable } from "../components/TeamsTable";
import { useFixtures, useLeagues, useMarketOdds, useStandings } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";

const TABS = ["teams", "fixtures", "matchdays", "standings", "markets", "simulation", "odds"] as const;

type Tab = (typeof TABS)[number];

export function LeagueDetailPage(): React.JSX.Element {
  const { leagueId } = useParams();
  const { can } = useAdmin();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t === params.get("tab")) ?? "teams";
  const leagues = useLeagues();
  const league = leagues.data?.find((l) => l.id === leagueId);
  const fixtures = useFixtures(leagueId === undefined ? {} : { leagueId }, (tab === "fixtures" || tab === "matchdays") && can("fixtures:read"));
  const standings = useStandings(tab === "standings" ? leagueId : undefined);
  const odds = useMarketOdds(undefined, (tab === "markets" || tab === "odds") && can("odds:read"));
  const leagueMarkets = useMemo(() => odds.data?.filter((m) => m.leagueName === league?.name), [odds.data, league?.name]);

  const matchdays = useMemo(() => {
    const groups = new Map<number, { matchday: number; total: number; live: number; completed: number; kickoffAt: string }>();

    for (const f of fixtures.data ?? []) {
      const g = groups.get(f.matchday) ?? { matchday: f.matchday, total: 0, live: 0, completed: 0, kickoffAt: f.kickoffAt };

      g.total += 1;
      if (f.matchStatus === "IN_PLAY") g.live += 1;
      if (f.matchStatus === "COMPLETED") g.completed += 1;
      groups.set(f.matchday, g);
    }

    return [...groups.values()].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  }, [fixtures.data]);

  if (league === undefined) {
    if (leagues.error !== null) return <ErrorState error={leagues.error} onRetry={() => void leagues.refetch()} />;

    return leagues.isLoading ? <LoadingState label="Loading competition" /> : <EmptyState title="Competition not found" description="It may have been archived." />;
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/leagues" className="inline-flex items-center gap-1 rounded-xs hover:text-text-primary focus-ring">
            <ChevronLeft className="size-3.5" /> Leagues
          </Link>
        }
        title={league.name}
        description={`${league.country} · Season ${String(league.currentSeason)}, matchday ${String(league.currentMatchday)} of ${String(league.matchdays)}`}
        actions={
          <>
            <Status value={league.status} />
            <LeagueMark slug={league.slug} code={league.code} size={32} />
          </>
        }
      />
      <Tabs<Tab>
        label="Competition sections"
        className="mb-4"
        value={tab}
        onChange={(next) => setParams(next === "teams" ? {} : { tab: next }, { replace: true })}
        items={[
          { value: "teams", label: "Teams", count: league.teamCount },
          { value: "fixtures", label: "Fixtures" },
          { value: "matchdays", label: "Matchdays" },
          { value: "standings", label: "Standings" },
          { value: "markets", label: "Markets" },
          { value: "simulation", label: "Simulation configuration" },
          { value: "odds", label: "Odds" },
        ]}
      />

      {tab === "teams" && (
        <RequirePermission permission="catalogue:read">
          <TeamsTable leagueId={league.id} />
        </RequirePermission>
      )}

      {tab === "fixtures" && (
        <RequirePermission permission="fixtures:read">
          <Panel flush>
            <FixtureTable rows={fixtures.data} loading={fixtures.isLoading} error={fixtures.error} onRetry={() => void fixtures.refetch()} showLeague={false} />
          </Panel>
        </RequirePermission>
      )}

      {tab === "matchdays" && (
        <RequirePermission permission="fixtures:read">
          <Panel title="Matchdays in the operating window" description="Recent, current and upcoming rounds" flush>
            {fixtures.data === undefined ? (
              <SkeletonRows rows={5} className="p-4" />
            ) : (
              <ul className="divide-y divide-border">
                {matchdays.map((md) => (
                  <li key={md.matchday} className="flex items-center gap-4 px-4 py-2.5 text-base">
                    <span className="w-28 font-display font-semibold">Matchday {md.matchday}</span>
                    <span className="w-24 tabular text-text-secondary">{new Date(md.kickoffAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    <span className="flex-1 text-text-muted">
                      {md.completed} of {md.total} completed{md.live > 0 ? `, ${String(md.live)} in play` : ""}
                    </span>
                    <Status value={md.live > 0 ? "IN_PLAY" : md.completed === md.total ? "COMPLETED" : "SCHEDULED"} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </RequirePermission>
      )}

      {tab === "standings" && (
        <Panel flush>{standings.data === undefined ? standings.error !== null ? <ErrorState error={standings.error} compact onRetry={() => void standings.refetch()} /> : <SkeletonRows rows={8} className="p-4" /> : <LeagueTable standings={standings.data} />}</Panel>
      )}

      {(tab === "markets" || tab === "odds") && (
        <RequirePermission permission="odds:read">
          <MarketsBoard markets={leagueMarkets} loading={odds.isLoading} error={odds.error} onRetry={() => void odds.refetch()} mode={tab === "odds" ? "odds" : "markets"} />
        </RequirePermission>
      )}

      {tab === "simulation" && (
        <Panel title="Simulation configuration" description="Read from the platform. The console displays these; the simulation service owns them.">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <Field label="Matchday cycle">{league.cycleSeconds}s between kick-offs</Field>
            <Field label="Match speed">{VIRTUAL_TIMING.secondsPerMinute}s per match minute</Field>
            <Field label="Half-time">{VIRTUAL_TIMING.halfTimeSeconds}s</Field>
            <Field label="Betting closes">{VIRTUAL_TIMING.bettingCloseLeadSeconds}s before kick-off</Field>
            <Field label="Settlement">{VIRTUAL_TIMING.settlementDelaySeconds}s after full time</Field>
            <Field label="Format">Double round robin, {league.matchdays} matchdays</Field>
            <Field label="Inputs">Team ratings and recent form</Field>
            <Field label="Model">Poisson goals, seeded per fixture</Field>
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-sm text-text-muted">
            Team ratings are edited under{" "}
            <Link to="/teams" className="font-medium text-brand hover:underline">
              Teams
            </Link>
            . They shift probabilities for future fixtures only; a fixture whose run is prepared keeps the inputs it was prepared with.
          </p>
        </Panel>
      )}
    </>
  );
}
