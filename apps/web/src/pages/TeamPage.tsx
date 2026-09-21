import { Link, useParams } from "react-router";
import type { TeamId } from "@betng/contracts";
import { DataSourceError, type Player, type StandingRow } from "@betng/ui-core";
import { EmptyState, ErrorState, FormPips, LeagueMark, NotFoundState, ProfileSkeleton, SectionHeading, TeamHeader } from "@betng/ui-web";
import { MatchList } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useIsStale } from "../hooks/useConnection";
import { useLeague, useMatches, useStandings, useTeam } from "../hooks/queries";
import { paths } from "../lib/paths";

const POSITION_LABEL: Readonly<Record<Player["position"], string>> = {
  GK: "Goalkeepers",
  DF: "Defenders",
  MF: "Midfielders",
  FW: "Forwards",
};

const POSITIONS = Object.keys(POSITION_LABEL) as readonly Player["position"][];

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}

function SeasonFigures({ row, strength }: { readonly row: StandingRow | undefined; readonly strength: number }): React.JSX.Element {
  const figures: readonly (readonly [string, string | number | undefined])[] = [
    ["Position", row?.position],
    ["Points", row?.points],
    ["Played", row?.played],
    ["Won", row?.won],
    ["Drawn", row?.drawn],
    ["Lost", row?.lost],
    ["Goals", row === undefined ? undefined : `${String(row.goalsFor)}:${String(row.goalsAgainst)}`],
    ["Difference", row === undefined ? undefined : signed(row.goalDifference)],
  ];

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <dl className="grid grid-cols-4 gap-px bg-border">
        {figures.map(([label, value]) => (
          <div key={label} className="bg-surface p-3">
            <dt className="type-caption">{label}</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular">{value ?? "–"}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
        <span className="type-caption">Form</span>
        {row === undefined || row.form.length === 0 ? <span className="type-small text-text-muted">No matches played</span> : <FormPips form={row.form} />}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
        <span className="type-caption">Simulated strength</span>
        <span className="type-data font-semibold">{strength}</span>
      </div>
    </div>
  );
}

function Squad({ squad }: { readonly squad: readonly Player[] }): React.JSX.Element {
  if (squad.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface">
        <EmptyState compact title="Squad not available" description="The platform has not published a squad for this team." />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {POSITIONS.map((position) => {
        const players = squad.filter((player) => player.position === position);

        if (players.length === 0) return null;

        return (
          <div key={position} className="overflow-hidden rounded-md border border-border bg-surface">
            <h3 className="type-caption border-b border-border bg-surface-sunken px-3 py-2">{POSITION_LABEL[position]}</h3>
            <ul className="divide-y divide-border">
              {players.map((player) => (
                <li key={player.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-6 text-right type-data text-text-muted">{player.shirt}</span>
                  <span className="min-w-0 truncate text-base font-medium">{player.name}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function TeamPage(): React.JSX.Element {
  const { teamId } = useParams<{ teamId: string }>();
  const stale = useIsStale();
  const team = useTeam(teamId);
  const league = useLeague(team.data?.leagueId);
  const standings = useStandings(team.data?.leagueId);
  const fixtures = useMatches(
    { teamId: teamId as TeamId, phases: ["LIVE", "HALFTIME", "BETTING_CLOSED", "BETTING_OPEN", "SCHEDULED"], limit: 5 },
    { enabled: teamId !== undefined },
  );
  const results = useMatches({ teamId: teamId as TeamId, phases: ["FINISHED", "SETTLED"], limit: 8 }, { enabled: teamId !== undefined, pace: "slow" });

  usePageMeta({
    title: team.data?.name ?? "Team",
    ...(team.data === undefined ? {} : { description: `${team.data.name}: squad, fixtures, results and season figures on BETNG.` }),
  });

  if (team.error instanceof DataSourceError && team.error.code === "NOT_FOUND") {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-border bg-surface">
        <h1 className="sr-only">Team not found</h1>
        <NotFoundState title="Team not found" description="This team does not exist on the platform." />
      </div>
    );
  }

  if (team.isError) {
    return (
      <div className="rounded-md border border-border bg-surface">
        <h1 className="sr-only">Team</h1>
        <ErrorState error={team.error} onRetry={() => void team.refetch()} />
      </div>
    );
  }

  if (team.data === undefined) return <ProfileSkeleton />;

  const row = standings.data?.rows.find((entry) => entry.team.id === team.data.id);

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-border bg-surface p-4 md:p-6">
        <TeamHeader
          team={team.data}
          leagueMark={
            league.data === undefined ? undefined : (
              <Link to={paths.league(league.data.id)} className="inline-flex items-center gap-2 rounded-xs hover:text-text-primary focus-ring">
                <LeagueMark slug={league.data.slug} code={league.data.code} size={20} />
                {league.data.name}
              </Link>
            )
          }
        />
        <p className="mt-4 border-t border-border pt-3 type-small text-text-secondary">
          Manager {team.data.manager} · Founded {team.data.founded}
        </p>
      </div>

      <div className="grid gap-8 2xl:grid-cols-2">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="team-season">
            <SectionHeading id="team-season">Season</SectionHeading>
            <div className="mt-3">
              <SeasonFigures row={row} strength={team.data.strength} />
            </div>
          </section>
          <section aria-labelledby="team-squad">
            <SectionHeading id="team-squad">Squad</SectionHeading>
            <div className="mt-3">
              <Squad squad={team.data.squad} />
            </div>
          </section>
        </div>
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="team-fixtures">
            <SectionHeading id="team-fixtures">Fixtures</SectionHeading>
            <MatchList query={fixtures} withMarkets stale={stale} empty="noUpcomingMatches" skeletons={3} label="Fixtures" className="mt-3" />
          </section>
          <section aria-labelledby="team-results">
            <SectionHeading id="team-results">Results</SectionHeading>
            <MatchList query={results} withOutcome empty="noResults" skeletons={4} label="Results" className="mt-3" />
          </section>
        </div>
      </div>
    </div>
  );
}
