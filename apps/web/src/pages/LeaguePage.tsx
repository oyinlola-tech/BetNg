import { useId } from "react";
import { Link, useParams } from "react-router";
import type { LeagueId } from "@betng/contracts";
import { DataSourceError, formatMatchday } from "@betng/ui-core";
import {
  EmptyState,
  ErrorState,
  FormPips,
  LeagueMark,
  LeagueTable,
  NotFoundState,
  Skeleton,
  TabPanel,
  TableSkeleton,
  Tabs,
  TeamCrest,
  VirtualTeamCard,
} from "@betng/ui-web";
import { MatchList } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useIsStale } from "../hooks/useConnection";
import { useLeague, useMatches, useStandings, useTeams, useTopScorers } from "../hooks/queries";
import { paths } from "../lib/paths";
import { useTabParam } from "../lib/useTabParam";

const TABS = ["fixtures", "results", "table", "teams", "scorers"] as const;

type LeagueTab = (typeof TABS)[number];

const TAB_ITEMS: readonly { readonly value: LeagueTab; readonly label: string }[] = [
  { value: "fixtures", label: "Fixtures" },
  { value: "results", label: "Results" },
  { value: "table", label: "Table" },
  { value: "teams", label: "Teams" },
  { value: "scorers", label: "Top scorers" },
];

function Fixtures({ leagueId }: { readonly leagueId: string }): React.JSX.Element {
  const stale = useIsStale();
  const fixtures = useMatches({
    leagueId: leagueId as LeagueId,
    phases: ["LIVE", "HALFTIME", "BETTING_CLOSED", "BETTING_OPEN", "SCHEDULED", "DELAYED", "SUSPENDED"],
    limit: 40,
  });

  return <MatchList query={fixtures} withMarkets stale={stale} showCompetition={false} empty="noUpcomingMatches" skeletons={6} label="Fixtures" />;
}

function Results({ leagueId }: { readonly leagueId: string }): React.JSX.Element {
  const results = useMatches({ leagueId: leagueId as LeagueId, phases: ["FINISHED", "SETTLED"], limit: 30 }, { pace: "slow" });

  return (
    <MatchList
      query={results}
      withOutcome
      showCompetition={false}
      empty="noResults"
      skeletons={6}
      label="Results"
      emptyAction={
        <Link to={`${paths.results}?league=${encodeURIComponent(leagueId)}`} className="rounded-xs text-sm font-semibold text-brand hover:underline focus-ring">
          Browse the archive
        </Link>
      }
    />
  );
}

function Table({ leagueId }: { readonly leagueId: string }): React.JSX.Element {
  const standings = useStandings(leagueId);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {standings.isError && standings.data === undefined ? (
        <ErrorState compact error={standings.error} onRetry={() => void standings.refetch()} />
      ) : standings.data === undefined ? (
        <TableSkeleton rows={10} columns={8} />
      ) : standings.data.rows.length === 0 ? (
        <EmptyState compact title="No table yet" description="The table appears once the first matchday is complete." />
      ) : (
        <LeagueTable standings={standings.data} teamHref={(row) => paths.team(row.team.id)} />
      )}
    </div>
  );
}

function Teams({ leagueId, leagueName }: { readonly leagueId: string; readonly leagueName: string | undefined }): React.JSX.Element {
  const teams = useTeams(leagueId);
  const standings = useStandings(leagueId);

  if (teams.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" role="status" aria-label="Loading teams">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <Skeleton key={slot} className="h-24" />
        ))}
      </div>
    );
  }

  if (teams.isError) return <ErrorState compact error={teams.error} onRetry={() => void teams.refetch()} />;

  if (teams.data.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface">
        <EmptyState compact preset="noTeams" />
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {teams.data.map((team) => {
        const form = standings.data?.rows.find((row) => row.team.id === team.id)?.form;

        return (
          <li key={team.id} className="min-w-0">
            <VirtualTeamCard
              team={team}
              to={paths.team(team.id)}
              {...(leagueName === undefined ? {} : { leagueName })}
              {...(form === undefined || form.length === 0 ? {} : { form: <FormPips form={form} /> })}
            />
          </li>
        );
      })}
    </ul>
  );
}

function Scorers({ leagueId }: { readonly leagueId: string }): React.JSX.Element {
  const scorers = useTopScorers(leagueId);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {scorers.isError ? (
        <ErrorState compact error={scorers.error} onRetry={() => void scorers.refetch()} />
      ) : scorers.data === undefined ? (
        <TableSkeleton rows={8} columns={4} />
      ) : scorers.data.length === 0 ? (
        <EmptyState compact title="No goals yet" description="Scorers appear once the season's first goals are in." />
      ) : (
        <table className="w-full">
          <caption className="sr-only">Top scorers</caption>
          <thead>
            <tr className="type-caption border-b border-border bg-surface-sunken text-left">
              <th scope="col" className="w-10 py-2 pl-3">
                #
              </th>
              <th scope="col" className="py-2">
                Player
              </th>
              <th scope="col" className="w-16 py-2 text-right">
                Goals
              </th>
              <th scope="col" className="w-20 py-2 pr-3 text-right">
                Assists
              </th>
            </tr>
          </thead>
          <tbody>
            {scorers.data.map((scorer, index) => (
              <tr key={`${scorer.team.id}:${scorer.player}`} className="border-b border-border last:border-0">
                <td className="py-2 pl-3 type-data text-text-muted">{index + 1}</td>
                <td className="py-2">
                  <span className="block text-base font-medium">{scorer.player}</span>
                  <Link to={paths.team(scorer.team.id)} className="mt-0.5 inline-flex items-center gap-1.5 rounded-xs type-small text-text-secondary hover:text-brand focus-ring">
                    <TeamCrest team={scorer.team} size={16} decorative />
                    {scorer.team.name}
                  </Link>
                </td>
                <td className="py-2 text-right type-data font-bold">{scorer.goals}</td>
                <td className="py-2 pr-3 text-right type-data text-text-secondary">{scorer.assists}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function LeaguePage(): React.JSX.Element {
  const { leagueId } = useParams<{ leagueId: string }>();
  const tabsId = useId();
  const league = useLeague(leagueId);
  const [tab, setTab] = useTabParam(TABS, "fixtures");

  usePageMeta({
    title: league.data?.name ?? "Competition",
    ...(league.data === undefined ? {} : { description: `${league.data.name}: fixtures, results, table, teams and top scorers on BETNG.` }),
  });

  if (leagueId === undefined || (league.error instanceof DataSourceError && league.error.code === "NOT_FOUND")) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-border bg-surface">
        <h1 className="sr-only">Competition not found</h1>
        <NotFoundState
          title="Competition not found"
          description="This competition does not exist on the platform."
          action={
            <Link to={paths.leagues} className="rounded-xs text-base font-semibold text-brand hover:underline focus-ring">
              All competitions
            </Link>
          }
        />
      </div>
    );
  }

  if (league.isError) {
    return (
      <div className="rounded-md border border-border bg-surface">
        <h1 className="sr-only">Competition</h1>
        <ErrorState error={league.error} onRetry={() => void league.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        {league.data === undefined ? <Skeleton className="size-14" /> : <LeagueMark slug={league.data.slug} code={league.data.code} size={56} />}
        <div className="min-w-0">
          <h1 className="type-h1 truncate">{league.data?.name ?? <Skeleton className="h-8 w-56" />}</h1>
          {league.data !== undefined && (
            <p className="mt-1 type-data text-text-secondary">
              {league.data.country} · Season {league.data.currentSeason} · {formatMatchday(league.data.currentMatchday)} of {league.data.matchdays}
            </p>
          )}
        </div>
      </header>

      <Tabs id={tabsId} label="Competition sections" scrollable value={tab} onChange={setTab} items={TAB_ITEMS} />

      <TabPanel tabsId={tabsId} value="fixtures" active={tab}>
        <Fixtures leagueId={leagueId} />
      </TabPanel>
      <TabPanel tabsId={tabsId} value="results" active={tab}>
        <Results leagueId={leagueId} />
      </TabPanel>
      <TabPanel tabsId={tabsId} value="table" active={tab}>
        <Table leagueId={leagueId} />
      </TabPanel>
      <TabPanel tabsId={tabsId} value="teams" active={tab}>
        <Teams leagueId={leagueId} leagueName={league.data?.name} />
      </TabPanel>
      <TabPanel tabsId={tabsId} value="scorers" active={tab}>
        <Scorers leagueId={leagueId} />
      </TabPanel>
    </div>
  );
}
