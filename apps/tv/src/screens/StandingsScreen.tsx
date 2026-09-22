import { useSearchParams } from "react-router";
import type { LeagueId } from "@betng/contracts";
import { formatMatchday, type FormResult, type StandingRow, type TopScorer } from "@betng/ui-core";
import { ErrorPanel, FavouriteMark, Focusable, Skeleton, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { cn } from "../lib/cn";
import { useFavourites } from "../lib/favourites";
import { goalDifferenceBar } from "../lib/fixtures";
import { reads } from "../lib/reads";

const FORM_WORD: Readonly<Record<FormResult, string>> = { W: "won", D: "drew", L: "lost" };

function Form({ form }: { readonly form: readonly FormResult[] }): React.JSX.Element {
  const last = form.slice(-5);

  return (
    <span role="img" className="inline-flex gap-[0.25rem]" aria-label={last.length === 0 ? "No matches yet" : `Last ${String(last.length)}, oldest first: ${last.map((r) => FORM_WORD[r]).join(", ")}`}>
      {last.map((r, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "inline-flex size-[1.4rem] items-center justify-center rounded-xs text-[0.75rem] font-black",
            r === "W" && "bg-success text-text-on-status",
            r === "D" && "bg-border-strong text-text-primary",
            r === "L" && "bg-danger text-text-on-status",
            i === last.length - 1 && "ring-[0.12rem] ring-text-primary",
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

function GoalDifference({ value, maxAbs }: { readonly value: number; readonly maxAbs: number }): React.JSX.Element {
  const bar = goalDifferenceBar(value, maxAbs);

  return (
    <span aria-hidden className="relative flex h-[0.6rem] w-full items-center">
      <span className="absolute left-1/2 top-[-0.2rem] h-[1rem] w-px bg-border-strong" />
      <span
        data-direction={bar.direction}
        className={cn("absolute h-full", bar.direction === "up" ? "left-1/2 bg-success" : "right-1/2 bg-danger")}
        style={{ width: `${String(bar.percent / 2)}%` }}
      />
    </span>
  );
}

function Scorers({ scorers, failed }: { readonly scorers: readonly TopScorer[] | undefined; readonly failed: boolean }): React.JSX.Element {
  if (scorers === undefined && failed) return <p className="text-[1rem] text-text-muted">Top scorers could not be loaded. The display keeps retrying.</p>;
  if (scorers === undefined) return <Skeleton className="h-[16rem]" />;
  if (scorers.length === 0) return <p className="text-[1rem] text-text-muted">The platform has not published scorers for this league yet.</p>;

  return (
    <table className="w-full text-[1.02rem]">
      <caption className="sr-only">Top scorers</caption>
      <thead>
        <tr className="caps-label text-left">
          <th scope="col" className="pb-[0.4rem]">Player</th>
          <th scope="col" className="w-[3rem] pb-[0.4rem] text-right">G</th>
          <th scope="col" className="w-[3rem] pb-[0.4rem] text-right">A</th>
        </tr>
      </thead>
      <tbody>
        {scorers.slice(0, 10).map((s, i) => (
          <tr key={`${s.player}:${s.team.id}`} className="border-t border-border">
            <td className="py-[0.35rem]">
              <span className="flex min-w-0 items-center gap-[0.5rem]">
                <span className="w-[1.4rem] font-display font-black tabular text-text-muted">{i + 1}</span>
                <TeamMark team={s.team} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{s.player}</span>
                  <span className="block truncate text-[0.8rem] text-text-muted">{s.team.shortName}</span>
                </span>
              </span>
            </td>
            <td className="py-[0.35rem] text-right font-display text-[1.2rem] font-black tabular">{s.goals}</td>
            <td className="py-[0.35rem] text-right tabular text-text-secondary">{s.assists}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({ row, maxAbs, followed }: { readonly row: StandingRow; readonly maxAbs: number; readonly followed: boolean }): React.JSX.Element {
  return (
    <tr className={cn("border-b border-border last:border-0", followed && "bg-warning-subtle")}>
      <td className="py-[0.4rem] pl-[1.2rem] font-display font-black tabular text-text-secondary">{row.position}</td>
      <th scope="row" className="py-[0.4rem] text-left font-normal">
        <span className="inline-flex items-center gap-[0.7rem] font-bold">
          <TeamMark team={row.team} size="sm" />
          {row.team.name}
          {followed && <FavouriteMark className="text-[0.95rem]" />}
        </span>
      </th>
      <td className="py-[0.4rem] text-right tabular text-text-secondary">{row.played}</td>
      <td className="py-[0.4rem] text-right tabular text-text-secondary">{row.won}</td>
      <td className="py-[0.4rem] text-right tabular text-text-secondary">{row.drawn}</td>
      <td className="py-[0.4rem] text-right tabular text-text-secondary">{row.lost}</td>
      <td className="py-[0.4rem] text-right tabular text-text-secondary">{row.goalDifference > 0 ? `+${String(row.goalDifference)}` : row.goalDifference}</td>
      <td className="px-[0.8rem] py-[0.4rem]">
        <GoalDifference value={row.goalDifference} maxAbs={maxAbs} />
      </td>
      <td className="py-[0.4rem] pr-[1rem] text-right font-display text-[1.35rem] font-black tabular">{row.points}</td>
      <td className="py-[0.4rem] pr-[1.2rem] text-right">
        <Form form={row.form} />
      </td>
    </tr>
  );
}

/* Only what the platform publishes: no qualification zones (leagues carry none) and no movement arrows (no standings history is served). */
export function StandingsScreen(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const favourites = useFavourites();
  const leagues = useAsync(() => reads.listLeagues(), [], 30_000);
  const leagueId = params.get("league") ?? leagues.data?.[0]?.id;
  const standings = useAsync(() => (leagueId === undefined ? Promise.resolve(undefined) : reads.getStandings(leagueId as LeagueId)), [leagueId], 10_000);
  const scorers = useAsync(() => (leagueId === undefined ? Promise.resolve(undefined) : reads.getTopScorers(leagueId as LeagueId)), [leagueId], 30_000);
  const league = leagues.data?.find((l) => l.id === leagueId);
  const maxAbs = Math.max(0, ...(standings.data?.rows ?? []).map((r) => Math.abs(r.goalDifference)));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between">
        <div>
          <p className="caps-label">
            League table
            {standings.data === undefined ? "" : ` · Season ${String(standings.data.season)} · after ${formatMatchday(standings.data.matchdaysPlayed)}`}
          </p>
          <h1 className="font-display text-[2.4rem] font-black tracking-tight">{league?.name ?? "Standings"}</h1>
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
              className={cn("px-[1rem] py-[0.5rem] text-[1rem] font-bold", l.id === leagueId ? "bg-brand text-text-on-brand" : "border border-border bg-surface text-text-secondary")}
            >
              {l.code}
            </Focusable>
          ))}
        </div>
      </div>
      <div className="mt-[1rem] grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem] gap-[1rem]">
        <div className="min-h-0 overflow-hidden border border-border bg-surface">
          {standings.data === undefined && standings.error !== undefined ? (
            <ErrorPanel title="The table could not be loaded" />
          ) : standings.data === undefined ? (
            <div className="space-y-[0.8rem] p-[1.5rem]" aria-busy>
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="h-[2rem]" />
              ))}
            </div>
          ) : (
            <table className="w-full text-[1.1rem]">
              <caption className="sr-only">{league?.name ?? "League"} table</caption>
              <thead>
                <tr className="caps-label border-b border-border text-left">
                  <th scope="col" className="w-[3.4rem] py-[0.55rem] pl-[1.2rem]">Pos</th>
                  <th scope="col" className="py-[0.55rem]">Team</th>
                  <th scope="col" className="w-[3.2rem] py-[0.55rem] text-right">P</th>
                  <th scope="col" className="w-[3.2rem] py-[0.55rem] text-right">W</th>
                  <th scope="col" className="w-[3.2rem] py-[0.55rem] text-right">D</th>
                  <th scope="col" className="w-[3.2rem] py-[0.55rem] text-right">L</th>
                  <th scope="col" className="w-[4rem] py-[0.55rem] text-right">GD</th>
                  <th scope="col" className="w-[8rem] py-[0.55rem] text-center">
                    <span className="sr-only">Goal difference bar</span>
                  </th>
                  <th scope="col" className="w-[4.5rem] py-[0.55rem] pr-[1rem] text-right">Pts</th>
                  <th scope="col" className="w-[9.5rem] py-[0.55rem] pr-[1.2rem] text-right">Last 5</th>
                </tr>
              </thead>
              <tbody>
                {standings.data.rows.map((row) => (
                  <Row key={row.team.id} row={row} maxAbs={maxAbs} followed={favourites.has(row.team.id)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
        <section aria-label="Top scorers" className="min-h-0 overflow-hidden border border-border bg-surface px-[1.1rem] py-[0.9rem]">
          <h2 className="caps-label mb-[0.5rem]">Top scorers</h2>
          <Scorers scorers={scorers.data} failed={scorers.error !== undefined} />
        </section>
      </div>
    </div>
  );
}
