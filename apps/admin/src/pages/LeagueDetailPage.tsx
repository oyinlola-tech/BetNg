import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { AdminSkeleton, EmptyState, ErrorBoundary, ErrorState, LeagueMark, LeagueTable, Panel, SkeletonRows, Tabs } from "@betng/ui-web";
import { DetailItem, Status, Unavailable } from "../components/Bits";
import { FixtureList } from "../components/FixtureList";
import { RequirePermission } from "../components/Guard";
import { MarketsBoard } from "../components/MarketsBoard";
import { PageHeader } from "../components/PageHeader";
import { TeamList } from "../components/TeamList";
import { useLeagues, useMarketOdds, useStandings } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";

const TABS = ["teams", "fixtures", "standings", "markets", "odds", "simulation"] as const;

type Tab = (typeof TABS)[number];

export function LeagueDetailPage(): React.JSX.Element {
  const { leagueId } = useParams();
  const { can } = useAdmin();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t === params.get("tab")) ?? "teams";
  const leagues = useLeagues();
  const league = leagues.data?.find((l) => l.id === leagueId);
  const standings = useStandings(tab === "standings" ? leagueId : undefined);
  const odds = useMarketOdds(undefined, (tab === "markets" || tab === "odds") && can("odds:read"));
  const leagueMarkets = useMemo(() => odds.data?.filter((m) => m.leagueName === league?.name), [odds.data, league?.name]);

  if (league === undefined) {
    if (leagues.error !== null) return <ErrorState error={leagues.error} onRetry={() => void leagues.refetch()} />;

    return leagues.isPending ? <AdminSkeleton kpis={0} /> : <EmptyState title="Competition not found" description="The platform does not list a competition with this id." />;
  }

  return (
    <>
      <PageHeader
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
          { value: "standings", label: "Standings" },
          { value: "markets", label: "Markets" },
          { value: "odds", label: "Odds" },
          { value: "simulation", label: "Simulation configuration" },
        ]}
      />

      {tab === "teams" && (
        <Panel flush>
          <TeamList leagueId={league.id} />
        </Panel>
      )}

      {tab === "fixtures" && (
        <RequirePermission permission="fixtures:read">
          <Panel flush>
            <FixtureList leagueId={league.id} />
          </Panel>
        </RequirePermission>
      )}

      {tab === "standings" && (
        <Panel flush>
          <ErrorBoundary scope="feature">
            {standings.data === undefined ? standings.error !== null ? <ErrorState error={standings.error} compact onRetry={() => void standings.refetch()} /> : <SkeletonRows rows={8} className="p-4" /> : <LeagueTable standings={standings.data} />}
          </ErrorBoundary>
        </Panel>
      )}

      {(tab === "markets" || tab === "odds") && (
        <RequirePermission permission="odds:read">
          <MarketsBoard markets={leagueMarkets} loading={odds.isPending} error={odds.error} onRetry={() => void odds.refetch()} mode={tab === "odds" ? "odds" : "markets"} />
        </RequirePermission>
      )}

      {tab === "simulation" && (
        <Panel title="Simulation configuration" description="Owned by the simulation service. This console shows what the platform publishes and cannot change it.">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <DetailItem label="Matchday cycle">{league.cycleSeconds}s between kick-offs</DetailItem>
            <DetailItem label="Matchdays per season">{league.matchdays}</DetailItem>
            <DetailItem label="Teams">{league.teamCount}</DetailItem>
            <DetailItem label="Model version">
              <Unavailable what="The model version" />
            </DetailItem>
            <DetailItem label="Configuration version">
              <Unavailable what="The configuration version" />
            </DetailItem>
            <DetailItem label="Match pacing">
              <Unavailable what="Match pacing" />
            </DetailItem>
            <DetailItem label="Betting close lead">
              <Unavailable what="The betting close lead" />
            </DetailItem>
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-sm text-text-muted">
            Team ratings are edited under{" "}
            <Link to="/teams" className="rounded-xs font-medium text-brand hover:underline focus-ring">
              Teams
            </Link>
            . They shift probabilities for future fixtures only; a fixture whose run is prepared keeps the inputs it was prepared with.
          </p>
        </Panel>
      )}
    </>
  );
}
