import { useSearchParams } from "react-router";
import type { LeagueId } from "@betng/contracts";
import { formatMatchday, type MatchSummary } from "@betng/ui-core";
import { ErrorPanel, Focusable, Skeleton, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { cn } from "../lib/cn";
import { dataSource } from "../services/dataSource";

function Board({ match }: { readonly match: MatchSummary }): React.JSX.Element {
  const hw = match.score.home > match.score.away;
  const aw = match.score.away > match.score.home;

  return (
    <Focusable
      to={`/live/${match.id}`}
      className="w-full border border-border bg-surface px-[1.4rem] py-[1rem] text-left"
    >
      <p className="caps-label mb-[0.5rem]">Final</p>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-[0.9rem] gap-y-[0.5rem]">
        <TeamMark team={match.home} size="md" />
        <span
          className={cn(
            "truncate font-display text-[1.6rem] font-bold",
            hw ? "text-text-primary" : "text-text-secondary",
          )}
        >
          {match.home.name}
        </span>
        <span
          className={cn(
            "font-display text-[2.4rem] font-black tabular",
            hw ? "text-text-primary" : "text-text-muted",
          )}
        >
          {match.score.home}
        </span>
        <TeamMark team={match.away} size="md" />
        <span
          className={cn(
            "truncate font-display text-[1.6rem] font-bold",
            aw ? "text-text-primary" : "text-text-secondary",
          )}
        >
          {match.away.name}
        </span>
        <span
          className={cn(
            "font-display text-[2.4rem] font-black tabular",
            aw ? "text-text-primary" : "text-text-muted",
          )}
        >
          {match.score.away}
        </span>
      </div>
    </Focusable>
  );
}

export function ResultsScreen(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const leagues = useAsync(() => dataSource.listLeagues(), [], 30_000);
  const leagueId = params.get("league") ?? leagues.data?.[0]?.id;
  const results = useAsync(
    () =>
      leagueId === undefined
        ? Promise.resolve([] as readonly MatchSummary[])
        : dataSource.listMatches({
            leagueId: leagueId as LeagueId,
            phases: ["FINISHED", "SETTLED"],
            limit: 12,
          }),
    [leagueId],
    6000,
  );
  const league = leagues.data?.find((l) => l.id === leagueId);
  const latest = results.data?.[0];
  const board =
    latest === undefined
      ? []
      : (results.data ?? []).filter(
          (m) => m.matchday === latest.matchday && m.season === latest.season,
        );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between">
        <div>
          <p className="caps-label">
            Results
            {latest === undefined
              ? ""
              : ` · Season ${String(latest.season)} · ${formatMatchday(latest.matchday)}`}
          </p>
          <h1 className="font-display text-[2.4rem] font-black tracking-tight">
            {league?.name ?? "Results"}
          </h1>
        </div>
        <div className="flex gap-[0.6rem]">
          {(leagues.data ?? []).map((l) => (
            <Focusable
              key={l.id}
              onClick={() => {
                setParams({ league: l.id });
              }}
              aria-pressed={l.id === leagueId}
              autoFocusOnMount={l.id === leagueId}
              className={cn(
                "px-[1rem] py-[0.5rem] text-[1rem] font-bold",
                l.id === leagueId
                  ? "bg-brand text-text-on-brand"
                  : "border border-border bg-surface text-text-secondary",
              )}
            >
              {l.code}
            </Focusable>
          ))}
        </div>
      </div>
      <div className="mt-[1rem] grid flex-1 grid-cols-3 content-start gap-[0.9rem]">
        {results.data === undefined && results.error !== undefined ? (
          <ErrorPanel title="Results could not be loaded" className="col-span-3" />
        ) : results.data === undefined ? (
          Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[8rem]" />
          ))
        ) : board.length === 0 ? (
          <p className="col-span-3 py-[4rem] text-center text-[1.3rem] text-text-muted">
            No completed matchday yet.
          </p>
        ) : (
          board.map((m) => <Board key={m.id} match={m} />)
        )}
      </div>
    </div>
  );
}
