import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { EmptyState, ErrorState, LeagueMark, SkeletonRows } from "@betng/ui-web";
import { Status } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useLeagues } from "../hooks/queries";

export function LeaguesPage(): React.JSX.Element {
  const leagues = useLeagues();

  return (
    <>
      <PageHeader title="Leagues" description="The competition catalogue as the platform serves it. League names are simulation categories; every fixture and result is simulated." />
      {leagues.data === undefined ? (
        leagues.error !== null ? (
          <ErrorState error={leagues.error} onRetry={() => void leagues.refetch()} />
        ) : (
          <SkeletonRows rows={4} />
        )
      ) : leagues.data.length === 0 ? (
        <EmptyState title="No competitions configured" description="The match service returned an empty catalogue." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {leagues.data.map((league) => (
            <li key={league.id}>
              <Link to={`/leagues/${league.id}`} className="group flex items-center gap-4 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover focus-ring">
                <LeagueMark slug={league.slug} code={league.code} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-display text-lg font-bold">{league.name}</h2>
                    <Status value={league.status} />
                  </div>
                  <p className="text-sm text-text-muted">
                    {league.country} · <span className="mono-id">{league.code}</span>
                  </p>
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {[
                      ["Teams", league.teamCount],
                      ["Season", league.currentSeason],
                      ["Matchday", `${String(league.currentMatchday)} / ${String(league.matchdays)}`],
                      ["Cycle", `${String(league.cycleSeconds)}s`],
                    ].map(([term, value]) => (
                      <div key={term} className="flex gap-1.5">
                        <dt className="text-text-muted">{term}</dt>
                        <dd className="font-medium tabular text-text-primary">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <ChevronRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
