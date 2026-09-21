import { useParams } from "react-router";
import { Panel } from "@betng/ui-web";
import { FixtureList } from "../components/FixtureList";
import { PageHeader } from "../components/PageHeader";
import { TeamList } from "../components/TeamList";

export function TeamsPage(): React.JSX.Element {
  const { teamId } = useParams();

  return (
    <>
      <PageHeader title="Teams" description="Team records and the ratings the simulation reads. Select a team to see what each rating feeds." />
      <Panel flush>
        <TeamList initialTeamId={teamId} />
      </Panel>
    </>
  );
}

export function FixturesPage(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Fixtures" description="The schedule with its four pipelines side by side: betting, match, simulation and settlement. Select a fixture to open match control." />
      <Panel flush>
        <FixtureList />
      </Panel>
    </>
  );
}

export function MatchesPage(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Matches" description="Matches by trading state, opening on those taking bets. Select one to open match control." />
      <Panel flush>
        <FixtureList pipelines={false} defaults={{ sort: "kickoffAt", direction: "asc", filters: { matchStatus: "BETTING_OPEN" } }} />
      </Panel>
    </>
  );
}
