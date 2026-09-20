import { Link, useParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import type { TeamId } from "@betng/contracts";
import { FormPips, MatchRow, TeamBadge } from "../components/domain";
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  SkeletonRows,
} from "../components/ui";
import { useMatches, useStandings, useTeam } from "../hooks/queries";

export function TeamPage(): React.JSX.Element {
  const { teamId } = useParams<{ teamId: string }>();
  const team = useTeam(teamId);
  const standings = useStandings(team.data?.leagueId);
  const row = standings.data?.rows.find((r) => r.team.id === teamId);
  const recent = useMatches(
    { teamId: teamId as TeamId, phases: ["FINISHED", "SETTLED"], limit: 6 },
    { enabled: teamId !== undefined },
  );
  const upcoming = useMatches(
    {
      teamId: teamId as TeamId,
      phases: [
        "LIVE",
        "HALFTIME",
        "BETTING_OPEN",
        "BETTING_CLOSED",
        "SCHEDULED",
      ],
      limit: 3,
    },
    { enabled: teamId !== undefined },
  );

  if (team.isError)
    return (
      <ErrorState error={team.error} onRetry={() => void team.refetch()} />
    );

  if (team.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32" />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  const t = team.data;

  return (
    <div className="space-y-6">
      <Link
        to={`/leagues/${t.leagueId}`}
        className="inline-flex items-center gap-0.5 text-sm text-text-muted hover:text-text-primary focus-ring rounded-xs"
      >
        <ChevronLeft className="size-4" /> League
      </Link>
      <header className="flex flex-wrap items-center gap-5 rounded-md border border-border bg-surface p-5">
        <TeamBadge team={t} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t.name}
          </h1>
          <p className="text-sm text-text-muted">
            {t.city} · {t.stadium} · Founded {t.founded} · Manager {t.manager}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-center">
          <div>
            <dt className="caps-label">Position</dt>
            <dd className="font-display text-2xl font-bold tabular">
              {row?.position ?? "–"}
            </dd>
          </div>
          <div>
            <dt className="caps-label">Points</dt>
            <dd className="font-display text-2xl font-bold tabular">
              {row?.points ?? "–"}
            </dd>
          </div>
          <div>
            <dt className="caps-label">Form</dt>
            <dd className="mt-2">
              <FormPips form={row?.form ?? []} />
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Season statistics" className="mb-2" />
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {[
              ["Played", row?.played],
              ["Won", row?.won],
              ["Drawn", row?.drawn],
              ["Lost", row?.lost],
              ["Goals for", row?.goalsFor],
              ["Goals against", row?.goalsAgainst],
              [
                "Goal difference",
                row === undefined
                  ? undefined
                  : row.goalDifference > 0
                    ? `+${String(row.goalDifference)}`
                    : row.goalDifference,
              ],
              ["Strength", t.strength],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-surface p-3">
                <dt className="caps-label">{label}</dt>
                <dd className="mt-1 font-display text-xl font-bold tabular">
                  {value ?? "–"}
                </dd>
              </div>
            ))}
          </dl>
          <SectionHeader title="Squad" className="mb-2 mt-6" />
          <div className="rounded-md border border-border bg-surface">
            {t.squad.length === 0 ? (
              <EmptyState compact title="Squad not available" />
            ) : (
              <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                {t.squad.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="w-6 text-right tabular text-text-muted">
                      {p.shirt}
                    </span>
                    <span className="w-7 rounded-xs bg-surface-sunken px-1 text-center text-[10px] font-bold text-text-secondary">
                      {p.position}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="space-y-6">
          <div>
            <SectionHeader title="Next matches" className="mb-2" />
            <div className="divide-y divide-border rounded-md border border-border bg-surface">
              {upcoming.isPending ? (
                <SkeletonRows rows={2} className="p-4" />
              ) : (upcoming.data ?? []).length === 0 ? (
                <EmptyState compact title="No upcoming fixtures" />
              ) : (
                upcoming.data?.map((m) => <MatchRow key={m.id} match={m} />)
              )}
            </div>
          </div>
          <div>
            <SectionHeader title="Recent results" className="mb-2" />
            <div className="divide-y divide-border rounded-md border border-border bg-surface">
              {recent.isPending ? (
                <SkeletonRows rows={4} className="p-4" />
              ) : (recent.data ?? []).length === 0 ? (
                <EmptyState compact title="No results yet" />
              ) : (
                recent.data?.map((m) => <MatchRow key={m.id} match={m} />)
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
