import { useMemo, useState } from "react";
import type { LeagueId } from "@betng/contracts";
import { formatKickoffTime, formatShortDate, type MatchSummary } from "@betng/ui-core";
import { EmptyState, ErrorState, LeagueMark, Panel, Select, SkeletonRows, TeamBadge, cn } from "@betng/ui-web";
import { PageHeader } from "../components/PageHeader";
import { useCompletedMatchdays, useLeagues, useMatches } from "../hooks/queries";

function ResultRow({ match }: { readonly match: MatchSummary }): React.JSX.Element {
  const homeWon = match.score.home > match.score.away;
  const awayWon = match.score.away > match.score.home;

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-2 text-base">
      <span className="text-sm tabular text-text-muted">{formatKickoffTime(match.kickoffAt)}</span>
      <span className={cn("flex items-center justify-end gap-2 truncate text-right", homeWon ? "font-semibold text-text-primary" : "text-text-secondary")}>
        <span className="truncate">{match.home.name}</span>
        <TeamBadge team={match.home} size="xs" />
      </span>
      <span className="rounded-xs bg-surface-sunken px-2.5 py-0.5 font-display text-md font-semibold tabular">
        {match.score.home} – {match.score.away}
      </span>
      <span className={cn("flex items-center gap-2 truncate", awayWon ? "font-semibold text-text-primary" : "text-text-secondary")}>
        <TeamBadge team={match.away} size="xs" />
        <span className="truncate">{match.away.name}</span>
      </span>
    </li>
  );
}

export function ResultsPage(): React.JSX.Element {
  const leagues = useLeagues();
  const [chosenLeague, setChosenLeague] = useState<string | undefined>();
  const leagueId = chosenLeague ?? leagues.data?.[0]?.id;
  const league = leagues.data?.find((l) => l.id === leagueId);
  const matchdays = useCompletedMatchdays(leagueId);
  const [chosenDay, setChosenDay] = useState<{ readonly league: string; readonly day: number } | undefined>();
  const latest = matchdays.data === undefined ? undefined : Math.max(0, ...matchdays.data);
  const matchday = chosenDay !== undefined && chosenDay.league === leagueId ? chosenDay.day : latest;
  const filter = useMemo(() => ({ ...(leagueId === undefined ? {} : { leagueId: leagueId as LeagueId }), ...(matchday === undefined || matchday === 0 ? {} : { matchday }), phases: ["FINISHED", "SETTLED"] as const }), [leagueId, matchday]);
  const results = useMatches(filter, { enabled: leagueId !== undefined && matchday !== undefined && matchday > 0, refetchMs: 10_000 });
  const days = [...(matchdays.data ?? [])].sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-5">
      <PageHeader title="Results" description="Finished simulated matches, for settling questions at the counter." />

      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Competition">
        {leagues.data?.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={l.id === leagueId}
            onClick={() => {
              setChosenLeague(l.id);
            }}
            className={cn("flex h-10 items-center gap-2 rounded-sm border px-3 text-base font-medium transition-colors focus-ring", l.id === leagueId ? "border-brand bg-brand-subtle text-brand" : "border-border bg-surface text-text-secondary hover:bg-surface-hover")}
          >
            <LeagueMark slug={l.slug} code={l.code} size={18} />
            {l.name}
          </button>
        ))}
      </div>

      <Panel
        flush
        title={league === undefined ? "Results" : `${league.name} · Matchday ${String(matchday ?? "")}`}
        {...(results.data?.[0] === undefined ? {} : { description: formatShortDate(results.data[0].kickoffAt) })}
        actions={
          days.length > 0 && matchday !== undefined ? (
            <Select
              label="Matchday"
              size="sm"
              value={String(matchday)}
              onChange={(value) => {
                if (leagueId !== undefined) setChosenDay({ league: leagueId, day: Number(value) });
              }}
              options={days.map((d) => ({ value: String(d), label: `Matchday ${String(d)}` }))}
            />
          ) : undefined
        }
      >
        {leagues.isError ? (
          <ErrorState compact error={leagues.error} onRetry={() => void leagues.refetch()} />
        ) : results.isError ? (
          <ErrorState compact error={results.error} onRetry={() => void results.refetch()} />
        ) : matchday === 0 ? (
          <EmptyState compact title="No results yet" description="This season's first matchday has not finished." />
        ) : results.data === undefined ? (
          <SkeletonRows rows={8} className="p-4" />
        ) : results.data.length === 0 ? (
          <EmptyState compact title="No finished matches" description="Results appear here as soon as a round reaches full time." />
        ) : (
          <ul className="divide-y divide-border">
            {results.data.map((m) => (
              <ResultRow key={m.id} match={m} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
