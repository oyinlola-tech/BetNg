import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Panel, Select } from "@betng/ui-web";
import { FilterBar } from "../components/Bits";
import { FixtureTable } from "../components/FixtureTable";
import { PageHeader } from "../components/PageHeader";
import { TeamsTable } from "../components/TeamsTable";
import { useFixtures, useLeagues } from "../hooks/queries";

export function TeamsPage(): React.JSX.Element {
  const { teamId } = useParams();

  return (
    <>
      <PageHeader title="Teams" description="Team records and the ratings the simulation reads. Select a team to see what each rating feeds." />
      <TeamsTable initialTeamId={teamId} />
    </>
  );
}

const MATCH_STATUSES = ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED", "IN_PLAY", "COMPLETED", "CANCELLED"] as const;
const STATUS_LABELS: Readonly<Record<string, string>> = { SCHEDULED: "Scheduled", BETTING_OPEN: "Betting open", BETTING_CLOSED: "Betting closed", IN_PLAY: "Live", COMPLETED: "Completed", CANCELLED: "Void" };

function FixtureBrowser({ title, description, defaultStatus }: { readonly title: string; readonly description: string; readonly defaultStatus: string }): React.JSX.Element {
  const leagues = useLeagues();
  const [leagueId, setLeagueId] = useState("ALL");
  const [matchday, setMatchday] = useState("ALL");
  const [status, setStatus] = useState(defaultStatus);
  const fixtures = useFixtures(leagueId === "ALL" ? {} : { leagueId });
  const matchdays = useMemo(() => [...new Set((fixtures.data ?? []).map((f) => f.matchday))].sort((a, b) => a - b), [fixtures.data]);
  const rows = useMemo(
    () => fixtures.data?.filter((f) => (matchday === "ALL" || f.matchday === Number(matchday)) && (status === "ALL" || (status === "ACTIVE" ? f.matchStatus === "IN_PLAY" || f.matchStatus === "BETTING_OPEN" || f.matchStatus === "BETTING_CLOSED" : f.matchStatus === status))),
    [fixtures.data, matchday, status],
  );

  return (
    <>
      <PageHeader title={title} description={description} />
      <Panel flush>
        <FilterBar>
          <Select
            label="Competition"
            size="sm"
            value={leagueId}
            onChange={(next) => {
              setLeagueId(next);
              setMatchday("ALL");
            }}
            options={[{ value: "ALL", label: "All competitions" }, ...(leagues.data ?? []).map((l) => ({ value: l.id, label: l.name }))]}
          />
          <Select label="Matchday" size="sm" value={matchday} onChange={setMatchday} options={[{ value: "ALL", label: "All matchdays" }, ...matchdays.map((md) => ({ value: String(md), label: `Matchday ${String(md)}` }))]} />
          <Select
            label="Match status"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[{ value: "ALL", label: "All statuses" }, { value: "ACTIVE", label: "Open or live" }, ...MATCH_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))]}
          />
          <span className="ml-auto text-sm tabular text-text-muted">{rows === undefined ? "" : `${String(rows.length)} fixtures`}</span>
        </FilterBar>
        <FixtureTable rows={rows} loading={fixtures.isLoading} error={fixtures.error} onRetry={() => void fixtures.refetch()} />
      </Panel>
    </>
  );
}

export const FixturesPage = (): React.JSX.Element => (
  <FixtureBrowser title="Fixtures" description="The schedule with its four pipelines side by side: betting, match, simulation and settlement. Select a fixture to operate it." defaultStatus="ALL" />
);

export const MatchesPage = (): React.JSX.Element => <FixtureBrowser title="Matches" description="Matches that are taking bets or in play right now. Select one to open match control." defaultStatus="ACTIVE" />;
