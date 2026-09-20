import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { ErrorState, SectionHeader, SkeletonRows } from "../components/ui";
import { useLeagues } from "../hooks/queries";

export function LeaguesPage(): React.JSX.Element {
  const leagues = useLeagues();

  return (
    <div className="space-y-5">
      <SectionHeader as="h1" eyebrow="Competitions" title="Leagues" />
      {leagues.isPending ? (
        <SkeletonRows rows={2} />
      ) : leagues.isError ? (
        <ErrorState
          error={leagues.error}
          onRetry={() => void leagues.refetch()}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {leagues.data.map((l) => (
            <Link
              key={l.id}
              to={`/leagues/${l.id}`}
              className="group flex items-center gap-4 rounded-md border border-border bg-surface p-5 transition-colors hover:border-border-strong focus-ring"
            >
              <span className="flex size-14 items-center justify-center rounded-md bg-surface-sunken font-display text-md font-bold text-text-secondary">
                {l.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold">
                  {l.name}
                </span>
                <span className="block text-sm text-text-muted">
                  {l.country} · {l.teamCount} clubs · {l.matchdays} matchdays a
                  season
                </span>
                <span className="mt-1 block text-sm font-medium text-text-secondary">
                  Season {l.currentSeason} · Matchday{" "}
                  {String(l.currentMatchday).padStart(2, "0")}
                </span>
              </span>
              <ChevronRight className="size-5 text-text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
