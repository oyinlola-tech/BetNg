import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import type { LeagueId } from "@betng/contracts";
import { formatOdds, displayClock, isInPlay, leadingSelections, type LeadingCell, type MatchMarketsView, type MatchPhase, type MatchSummary } from "@betng/ui-core";
import { LeagueMark } from "../components/BrandMarks";
import { Countdown, ErrorPanel, Focusable, Skeleton, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";
import { polledClockNow, useDataHealth } from "../lib/dataHealth";
import { reads } from "../lib/reads";

const PHASES: readonly MatchPhase[] = ["BETTING_OPEN", "BETTING_CLOSED", "LIVE", "HALFTIME"];
const HIGHLIGHT_MS = 14_000;

interface Week {
  readonly matchday: number;
  readonly kickoffAt: string;
  readonly matches: readonly MatchSummary[];
  readonly live: boolean;
}

function toWeeks(matches: readonly MatchSummary[]): readonly Week[] {
  const map = new Map<string, MatchSummary[]>();

  for (const m of matches) map.set(`${String(m.season)}:${String(m.matchday)}`, [...(map.get(`${String(m.season)}:${String(m.matchday)}`) ?? []), m]);

  return [...map.values()]
    .map((list): Week => {
      const sorted = [...list].sort((a, b) => a.home.name.localeCompare(b.home.name));
      const first = sorted[0] as MatchSummary;

      return { matchday: first.matchday, kickoffAt: first.kickoffAt, matches: sorted, live: sorted.some((m) => isInPlay(m.phase)) };
    })
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

const PREVIEW: readonly { readonly key: string; readonly header: string; readonly kind: string; readonly code: string; readonly line?: number }[] = [
  { key: "1", header: "1", kind: "MATCH_RESULT", code: "HOME" },
  { key: "x", header: "X", kind: "MATCH_RESULT", code: "DRAW" },
  { key: "2", header: "2", kind: "MATCH_RESULT", code: "AWAY" },
  { key: "gg", header: "GG", kind: "BOTH_TEAMS_TO_SCORE", code: "YES" },
  { key: "ng", header: "NG", kind: "BOTH_TEAMS_TO_SCORE", code: "NO" },
  { key: "o25", header: "OV 2.5", kind: "OVER_UNDER", code: "OVER_2_5", line: 2.5 },
  { key: "u25", header: "UN 2.5", kind: "OVER_UNDER", code: "UNDER_2_5", line: 2.5 },
];

function previewCells(markets: MatchMarketsView | undefined): readonly LeadingCell[] {
  return PREVIEW.map((column) => {
    const market = markets?.markets.find((m) => m.kind === column.kind && (column.line === undefined || m.line === column.line));

    return { key: column.key, header: column.header, label: "", odds: market?.selections.find((s) => s.code === column.code)?.odds };
  });
}

export function BoardScreen(): React.JSX.Element {
  const [params] = useSearchParams();
  const now = useNow(1000);
  const health = useDataHealth();
  const leagues = useAsync(() => reads.listLeagues(), [], 30_000);
  const inPlay = useAsync(() => reads.listMatches({ phases: ["LIVE", "HALFTIME"] }), [], 4000);
  const requested = params.get("league") ?? undefined;
  const leagueId = requested ?? [...(inPlay.data ?? [])].sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt))[0]?.leagueId ?? leagues.data?.[0]?.id;
  const league = leagues.data?.find((l) => l.id === leagueId);

  const matches = useAsync(() => (leagueId === undefined ? Promise.resolve([] as readonly MatchSummary[]) : reads.listMatches({ leagueId: leagueId as LeagueId, phases: PHASES })), [leagueId], 2000);
  const weeks = useMemo(() => toWeeks(matches.data ?? []), [matches.data]);
  const week = weeks.find((w) => w.live) ?? weeks[0];
  const ids = (week?.matches ?? []).map((m) => m.id).join(",");

  const markets = useAsync(
    async () => {
      const list = await Promise.all((week?.matches ?? []).map((m) => reads.getMatchMarkets(m.id).catch(() => undefined)));

      return new Map<string, MatchMarketsView>(list.flatMap((view) => (view === undefined ? [] : [[view.matchId, view] as const])));
    },
    [ids],
    12_000,
  );

  const seen = useRef(new Map<string, { label: string; at: number }>());
  const rows = (week?.matches ?? []).map((match) => {
    const view = markets.data?.get(match.id);
    const cells = week?.live === true ? leadingSelections(view, match.score) : previewCells(view);

    return { match, cells };
  });

  useEffect(() => {
    if (week?.live !== true) {
      seen.current.clear();

      return;
    }

    for (const { match, cells } of rows) {
      for (const cell of cells) {
        const key = `${match.id}:${cell.key}`;
        const previous = seen.current.get(key);

        // Prices arriving can change which double chance is shown; only a change after that is news.
        if (cell.odds === undefined) continue;
        if (previous === undefined) seen.current.set(key, { label: cell.label, at: 0 });
        else if (previous.label !== cell.label) seen.current.set(key, { label: cell.label, at: Date.now() });
      }
    }
  });

  const changed = (matchId: string, key: string): boolean => now - (seen.current.get(`${matchId}:${key}`)?.at ?? 0) < HIGHLIGHT_MS;
  const clock = displayClock(week?.matches.find((m) => isInPlay(m.phase))?.clock, polledClockNow(health, now));
  const halftime = week?.matches.every((m) => m.phase === "HALFTIME") ?? false;
  const headers = rows[0]?.cells ?? (week?.live === true ? leadingSelections(undefined, { home: 0, away: 0 }) : previewCells(undefined));

  return (
    <div className="flex h-full min-h-0 flex-col gap-[0.7rem]">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-[1.5rem] border border-border bg-surface px-[1.4rem] py-[0.5rem]">
        <div className="flex min-w-0 items-center gap-[0.9rem]">
          {league !== undefined && <LeagueMark slug={league.slug} code={league.code} className="size-[2.8rem] shrink-0" />}
          <div className="min-w-0">
            <p className="caps-label">League</p>
            <h1 className="truncate font-display text-[1.9rem] font-black uppercase leading-none tracking-tight">{league?.name ?? "—"}</h1>
          </div>
        </div>

        <div className="text-center" aria-live="off">
          {week === undefined ? (
            <p className="font-display text-[2.4rem] font-black text-text-muted">—</p>
          ) : week.live ? (
            <p className="flex items-baseline gap-[0.8rem] font-display font-black leading-none text-live">
              <span className="flex items-center gap-[0.5rem] text-[1.5rem] uppercase tracking-wider">
                <span className="size-[0.7rem] rounded-full bg-live animate-pulse-live" aria-hidden />
                {halftime ? "Half time" : "Live"}
              </span>
              {!halftime && clock !== undefined && <span className="text-[3.4rem] tabular">{clock.label}</span>}
            </p>
          ) : (
            <div>
              <p className="caps-label">Next week starts in</p>
              <p className="font-display text-[3rem] font-black leading-none tabular text-text-primary">
                <Countdown to={week.kickoffAt} />
              </p>
            </div>
          )}
        </div>

        <div className="text-right">
          <p className="caps-label">Week</p>
          <p className="font-display text-[2.6rem] font-black leading-none tabular">{week?.matchday ?? "—"}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden border border-border bg-surface">
        {week === undefined && matches.error !== undefined ? (
          <ErrorPanel title="The board could not be loaded" />
        ) : week === undefined ? (
          <div className="space-y-[0.5rem] p-[1rem]">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-[2.5rem]" />
            ))}
          </div>
        ) : (
          <table className="h-full w-full border-collapse">
            <caption className="sr-only">
              {league?.name} week {week.matchday}: {week.live ? "live scores and the winning outcome in each market" : "odds for the next week"}
            </caption>
            <thead>
              <tr className="bg-surface-sunken">
                <th scope="col" className="w-[3rem] py-[0.35rem] text-center caps-label">
                  #
                </th>
                <th scope="col" className="py-[0.35rem] pl-[0.4rem] text-left caps-label">
                  Event
                </th>
                {headers.map((cell) => (
                  <th key={cell.key} scope="col" className="py-[0.35rem] text-center text-[0.8rem] font-bold uppercase tracking-wider text-text-secondary">
                    {cell.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ match, cells }, index) => (
                <tr key={match.id} className={cn("border-t border-border", index % 2 === 1 && "bg-surface-hover")}>
                  <td className="text-center font-display text-[1.1rem] font-black tabular text-text-muted">{index + 1}</td>
                  <th scope="row" className="pl-[0.4rem] text-left font-normal">
                    <span className="flex items-center gap-[0.6rem]">
                      <TeamMark team={match.home} size="sm" />
                      <span className="w-[3.2rem] font-display text-[1.25rem] font-black tracking-wide">{match.home.code}</span>
                      {week.live ? (
                        <span className="min-w-[4.2rem] bg-text-primary px-[0.5rem] py-[0.1rem] text-center font-display text-[1.35rem] font-black tabular text-background">
                          {match.score.home}-{match.score.away}
                        </span>
                      ) : (
                        <span className="min-w-[4.2rem] text-center text-[1rem] font-semibold text-text-muted">v</span>
                      )}
                      <span className="w-[3.2rem] text-right font-display text-[1.25rem] font-black tracking-wide">{match.away.code}</span>
                      <TeamMark team={match.away} size="sm" />
                    </span>
                  </th>
                  {cells.map((cell) => {
                    const hot = week.live && changed(match.id, cell.key);

                    return (
                      <td key={cell.key} className="px-[0.2rem] text-center">
                        <span className={cn("mx-auto flex w-full max-w-[7.5rem] flex-col items-center justify-center py-[0.15rem] leading-none transition-colors duration-[var(--bn-duration-slow)]", hot && "bg-warning text-black")}>
                          {cell.label !== "" && <span className={cn("text-[0.72rem] font-bold uppercase tracking-wider", hot ? "text-black/70" : "text-text-muted")}>{cell.label}</span>}
                          <span className="font-display text-[1.2rem] font-bold tabular">{cell.odds === undefined ? "–" : formatOdds(cell.odds)}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <nav aria-label="Leagues" className="flex items-center gap-[0.5rem]">
        {(leagues.data ?? []).map((l) => (
          <Focusable
            key={l.id}
            to={`/board?league=${l.id}`}
            aria-current={l.id === leagueId ? "page" : undefined}
            autoFocusOnMount={l.id === leagueId}
            className={cn("flex shrink-0 items-center gap-[0.5rem] whitespace-nowrap border px-[0.9rem] py-[0.4rem] text-[0.95rem] font-bold uppercase tracking-wider", l.id === leagueId ? "border-brand bg-brand-subtle text-text-primary" : "border-border bg-surface text-text-secondary")}
          >
            <LeagueMark slug={l.slug} code={l.code} className="size-[1.4rem]" />
            {l.name}
          </Focusable>
        ))}
        {week?.live === true && <p className="ml-auto min-w-0 truncate text-[0.85rem] text-text-muted">Winning outcome and price per market. Highlighted = just changed.</p>}
      </nav>
    </div>
  );
}
