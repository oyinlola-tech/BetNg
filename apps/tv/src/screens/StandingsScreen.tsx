import { useSearchParams } from "react-router";
import type { LeagueId } from "@betng/contracts";
import { formatMatchday } from "@betng/ui-core";
import { ErrorPanel, Focusable, Skeleton, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { cn } from "../lib/cn";
import { dataSource } from "../services/dataSource";

export function StandingsScreen(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const leagues = useAsync(() => dataSource.listLeagues(), [], 30_000);
  const leagueId = params.get("league") ?? leagues.data?.[0]?.id;
  const standings = useAsync(
    () =>
      leagueId === undefined
        ? Promise.resolve(undefined)
        : dataSource.getStandings(leagueId as LeagueId),
    [leagueId],
    10_000,
  );
  const league = leagues.data?.find((l) => l.id === leagueId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between">
        <div>
          <p className="caps-label">
            League table
            {standings.data === undefined
              ? ""
              : ` · Season ${String(standings.data.season)} · after ${formatMatchday(standings.data.matchdaysPlayed)}`}
          </p>
          <h1 className="font-display text-[2.4rem] font-black tracking-tight">
            {league?.name ?? "Standings"}
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
      <div className="mt-[1rem] min-h-0 flex-1 overflow-hidden border border-border bg-surface">
        {standings.data === undefined && standings.error !== undefined ? (
          <ErrorPanel title="The table could not be loaded" />
        ) : standings.data === undefined ? (
          <div className="space-y-[0.8rem] p-[1.5rem]" aria-busy>
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-[2rem]" />
            ))}
          </div>
        ) : (
          <table className="w-full text-[1.15rem]">
            <thead>
              <tr className="caps-label border-b border-border text-left">
                <th className="w-[3.5rem] py-[0.6rem] pl-[1.4rem]">Pos</th>
                <th className="py-[0.6rem]">Team</th>
                <th className="w-[4rem] py-[0.6rem] text-right">P</th>
                <th className="w-[4rem] py-[0.6rem] text-right">W</th>
                <th className="w-[4rem] py-[0.6rem] text-right">D</th>
                <th className="w-[4rem] py-[0.6rem] text-right">L</th>
                <th className="w-[4.5rem] py-[0.6rem] text-right">GD</th>
                <th className="w-[5rem] py-[0.6rem] pr-[1.4rem] text-right">
                  Pts
                </th>
                <th className="w-[9rem] py-[0.6rem] pr-[1.4rem] text-right">
                  Form
                </th>
              </tr>
            </thead>
            <tbody>
              {standings.data.rows.map((row) => (
                <tr
                  key={row.team.id}
                  className={cn(
                    "border-b border-border last:border-0",
                    row.position <= 2 && "bg-brand-subtle/40",
                  )}
                >
                  <td className="py-[0.45rem] pl-[1.4rem] font-display font-black tabular text-text-secondary">
                    {row.position}
                  </td>
                  <td className="py-[0.45rem]">
                    <span className="inline-flex items-center gap-[0.8rem] font-bold">
                      <TeamMark team={row.team} size="sm" />
                      {row.team.name}
                    </span>
                  </td>
                  <td className="py-[0.45rem] text-right tabular text-text-secondary">
                    {row.played}
                  </td>
                  <td className="py-[0.45rem] text-right tabular text-text-secondary">
                    {row.won}
                  </td>
                  <td className="py-[0.45rem] text-right tabular text-text-secondary">
                    {row.drawn}
                  </td>
                  <td className="py-[0.45rem] text-right tabular text-text-secondary">
                    {row.lost}
                  </td>
                  <td className="py-[0.45rem] text-right tabular text-text-secondary">
                    {row.goalDifference > 0
                      ? `+${String(row.goalDifference)}`
                      : row.goalDifference}
                  </td>
                  <td className="py-[0.45rem] pr-[1.4rem] text-right font-display text-[1.4rem] font-black tabular">
                    {row.points}
                  </td>
                  <td className="py-[0.45rem] pr-[1.4rem] text-right">
                    <span className="inline-flex gap-[0.25rem]">
                      {row.form.map((r, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex size-[1.4rem] items-center justify-center rounded-xs text-[0.75rem] font-black",
                            r === "W" && "bg-success text-text-on-status",
                            r === "D" && "bg-border-strong",
                            r === "L" && "bg-danger text-text-on-status",
                          )}
                        >
                          {r}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
