import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { formatMatchday } from "@betng/ui-core";
import { EmptyState, ErrorState, LeagueMark, Skeleton } from "@betng/ui-web";
import { usePageMeta } from "../features/seo";
import { useLeagues } from "../hooks/queries";
import { paths } from "../lib/paths";

export function LeaguesPage(): React.JSX.Element {
  const leagues = useLeagues();

  usePageMeta({ title: "Football competitions", description: "Every competition on BETNG: fixtures, results, tables, teams and top scorers." });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-h1">Football</h1>
        <p className="mt-1 text-base text-text-secondary">Competitions, with fixtures, results, tables, teams and scorers.</p>
      </header>
      {leagues.isPending ? (
        <div className="grid gap-3 md:grid-cols-2" role="status" aria-label="Loading competitions">
          {[0, 1, 2, 3].map((slot) => (
            <Skeleton key={slot} className="h-24" />
          ))}
        </div>
      ) : leagues.isError ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState error={leagues.error} onRetry={() => void leagues.refetch()} />
        </div>
      ) : leagues.data.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState title="No competitions" description="The platform has no competitions to show right now." />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {leagues.data.map((league) => (
            <li key={league.id}>
              <Link
                to={paths.league(league.id)}
                className="group flex items-center gap-4 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-ring"
              >
                <LeagueMark slug={league.slug} code={league.code} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-h3">{league.name}</span>
                  <span className="block truncate type-small text-text-muted">
                    {league.country} · {league.teamCount} teams · {league.matchdays} matchdays
                  </span>
                  <span className="mt-1 block type-data text-text-secondary">
                    Season {league.currentSeason} · {formatMatchday(league.currentMatchday)}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
