import { useState } from "react";
import type { LeagueId, MatchId } from "@betng/contracts";
import { formatKickoffTime, formatMatchday, formatOdds, type HeadToHeadView, type MatchMarketsView, type MatchSummary, type StandingsView } from "@betng/ui-core";
import { Countdown, ErrorPanel, FavouriteMark, Focusable, LiveTag, Skeleton, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { cn } from "../lib/cn";
import { follows, useFavourites } from "../lib/favourites";
import { featuredMatch, ordinal, rowFor, type Featured } from "../lib/fixtures";
import { quotesFor, type Quote } from "../lib/odds";
import { reads } from "../lib/reads";

function Position({ standings, teamId }: { readonly standings: StandingsView | undefined; readonly teamId: string }): React.JSX.Element | null {
  const row = rowFor(standings, teamId);

  return row === undefined ? null : <span className="text-[0.85rem] font-semibold text-text-muted">{ordinal(row.position)}</span>;
}

function OddsLine({ quotes }: { readonly quotes: readonly Quote[] }): React.JSX.Element {
  if (quotes.length === 0) return <p className="text-[0.85rem] text-text-muted">Prices not open</p>;

  return (
    <p className="flex items-center justify-center gap-[1rem] text-[0.95rem]">
      {quotes.map((q) => (
        <span key={q.key} className="inline-flex items-center gap-[0.3rem]">
          <span className="font-bold text-text-muted">{q.label}</span>
          <span className="font-display font-black tabular">{formatOdds(q.odds)}</span>
        </span>
      ))}
    </p>
  );
}

function Card({
  match,
  standings,
  markets,
  featured,
  followed,
  autoFocus,
  onFocus,
}: {
  readonly match: MatchSummary;
  readonly standings: StandingsView | undefined;
  readonly markets: MatchMarketsView | undefined;
  readonly featured: boolean;
  readonly followed: boolean;
  readonly autoFocus: boolean;
  readonly onFocus: () => void;
}): React.JSX.Element {
  return (
    <Focusable
      to={`/live/${match.id}`}
      autoFocusOnMount={autoFocus}
      onFocus={onFocus}
      data-card={match.id}
      className={cn("w-full border bg-surface px-[1.2rem] py-[0.9rem] text-left", featured ? "border-brand" : "border-border")}
    >
      <div className="flex items-center gap-[0.6rem]">
        <LiveTag phase={match.phase} />
        {featured && <span className="rounded-xs bg-brand px-[0.5rem] py-[0.1rem] text-[0.75rem] font-black uppercase tracking-caps text-text-on-brand">Featured</span>}
        {followed && <FavouriteMark className="text-[0.95rem]" />}
        <span className="ml-auto text-[0.85rem] font-semibold text-text-muted">
          {match.leagueCode} · {formatMatchday(match.matchday)}
        </span>
      </div>
      <div className="mt-[0.7rem] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[0.8rem]">
        <div className="flex min-w-0 flex-col items-center gap-[0.3rem] text-center">
          <TeamMark team={match.home} size="md" />
          <span className="w-full truncate text-[1rem] font-bold">{match.home.shortName}</span>
          <Position standings={standings} teamId={match.home.id} />
        </div>
        <div className="text-center">
          <Countdown to={match.kickoffAt} className="font-display text-[2.2rem] font-black leading-none" />
          <p className="caps-label mt-[0.3rem]">Kick-off {formatKickoffTime(match.kickoffAt)}</p>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-[0.3rem] text-center">
          <TeamMark team={match.away} size="md" />
          <span className="w-full truncate text-[1rem] font-bold">{match.away.shortName}</span>
          <Position standings={standings} teamId={match.away.id} />
        </div>
      </div>
      <div className="mt-[0.6rem] border-t border-border pt-[0.5rem]">
        <OddsLine quotes={quotesFor(markets, "MATCH_RESULT", undefined)} />
      </div>
    </Focusable>
  );
}

function HeadToHead({ h2h, match, failed }: { readonly h2h: HeadToHeadView | undefined; readonly match: MatchSummary; readonly failed: boolean }): React.JSX.Element {
  if (h2h === undefined && failed) return <p className="text-[1rem] text-text-muted">Head to head could not be loaded.</p>;
  if (h2h === undefined) return <Skeleton className="h-[6rem]" />;
  if (h2h.played === 0) return <p className="text-[1rem] text-text-muted">No previous meetings on the platform.</p>;

  const share = (n: number): string => `${String((n / h2h.played) * 100)}%`;

  return (
    <div>
      <div className="flex justify-between text-[1rem] font-bold">
        <span>
          {match.home.code} {h2h.homeWins}
        </span>
        <span className="text-text-muted">Draws {h2h.draws}</span>
        <span>
          {h2h.awayWins} {match.away.code}
        </span>
      </div>
      <div className="mt-[0.3rem] flex h-[0.5rem] gap-[0.15rem] overflow-hidden rounded-full" aria-hidden>
        <span className="bg-brand" style={{ width: share(h2h.homeWins) }} />
        <span className="bg-border-strong" style={{ width: share(h2h.draws) }} />
        <span className="bg-text-secondary" style={{ width: share(h2h.awayWins) }} />
      </div>
      <ul className="mt-[0.6rem] space-y-[0.3rem] text-[0.95rem]">
        {h2h.meetings.slice(0, 3).map((m) => (
          <li key={m.matchId} className="flex justify-between">
            <span className="text-text-muted">{m.leagueCode}</span>
            <span className="font-semibold">
              {m.home.code} <span className="font-display font-black tabular">{m.score.home}–{m.score.away}</span> {m.away.code}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ match, standings, markets }: { readonly match: MatchSummary; readonly standings: StandingsView | undefined; readonly markets: MatchMarketsView | undefined }): React.JSX.Element {
  const h2h = useAsync(() => reads.getHeadToHead(match.id), [match.id], 60_000);
  const home = rowFor(standings, match.home.id);
  const away = rowFor(standings, match.away.id);
  const groups = [
    { title: "Match result", quotes: quotesFor(markets, "MATCH_RESULT", undefined) },
    { title: "Both teams to score", quotes: quotesFor(markets, "BOTH_TEAMS_TO_SCORE", undefined) },
    { title: "Total goals 2.5", quotes: quotesFor(markets, "OVER_UNDER", undefined, 2.5) },
  ].filter((g) => g.quotes.length > 0);

  return (
    <aside aria-label={`${match.home.name} v ${match.away.name}`} className="flex min-h-0 flex-col gap-[1rem] overflow-hidden border border-border bg-surface px-[1.3rem] py-[1rem]">
      <div>
        <p className="caps-label">{match.leagueName}</p>
        <p className="font-display text-[1.5rem] font-black leading-tight">
          {match.home.name} <span className="text-text-muted">v</span> {match.away.name}
        </p>
      </div>
      <section aria-label="League positions">
        <h3 className="caps-label mb-[0.3rem]">League positions</h3>
        {home === undefined || away === undefined ? (
          <p className="text-[1rem] text-text-muted">The table is not available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-[0.6rem] text-[1rem]">
            {[home, away].map((r) => (
              <p key={r.team.id} className="border border-border bg-surface-sunken px-[0.7rem] py-[0.4rem]">
                <span className="block font-bold">{r.team.shortName}</span>
                <span className="tabular text-text-secondary">
                  {ordinal(r.position)} · {r.points} pts · {r.form.join(" ")}
                </span>
              </p>
            ))}
          </div>
        )}
      </section>
      <section aria-label="Head to head">
        <h3 className="caps-label mb-[0.3rem]">Head to head</h3>
        <HeadToHead h2h={h2h.data} match={match} failed={h2h.error !== undefined} />
      </section>
      <section aria-label="Prices, display only" className="min-h-0">
        <h3 className="caps-label mb-[0.3rem]">Prices · display only</h3>
        {groups.length === 0 ? (
          <p className="text-[1rem] text-text-muted">Prices are not open.</p>
        ) : (
          <table className="w-full text-[0.95rem]">
            <tbody>
              {groups.map((g) => (
                <tr key={g.title} className="border-t border-border">
                  <th scope="row" className="py-[0.35rem] text-left font-semibold text-text-secondary">
                    {g.title}
                  </th>
                  {g.quotes.map((q) => (
                    <td key={q.key} className="py-[0.35rem] text-right">
                      <span className="block font-bold">
                        <span className="text-text-muted">{q.label}</span> <span className="font-display font-black tabular">{formatOdds(q.odds)}</span>
                      </span>
                      <span className="block text-[0.75rem] text-text-muted">implied {q.implied}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </aside>
  );
}

export function UpcomingScreen(): React.JSX.Element {
  const favourites = useFavourites();
  const next = useAsync(() => reads.listMatches({ phases: ["BETTING_OPEN", "BETTING_CLOSED", "SCHEDULED"], limit: 9 }), [], 5000);
  const ids = (next.data ?? []).map((m) => m.id).join(",");
  const leagueIds = [...new Set((next.data ?? []).map((m) => m.leagueId))].sort().join(",");
  const tables = useAsync(
    async () => {
      const list = await Promise.all(leagueIds.split(",").filter((id) => id !== "").map((id) => reads.getStandings(id as LeagueId).catch(() => undefined)));

      return new Map(list.flatMap((t) => (t === undefined ? [] : [[t.leagueId as string, t] as const])));
    },
    [leagueIds],
    30_000,
  );
  const markets = useAsync(
    async () => {
      const list = await Promise.all(ids.split(",").filter((id) => id !== "").map((id) => reads.getMatchMarkets(id as MatchId).catch(() => undefined)));

      return new Map(list.flatMap((v) => (v === undefined ? [] : [[v.matchId as string, v] as const])));
    },
    [ids],
    15_000,
  );
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const matches = next.data ?? [];
  const featured: Featured | undefined = featuredMatch(matches, tables.data ?? new Map<string, StandingsView>());
  const focusId = featured?.matchId ?? matches[0]?.id;
  const current = matches.find((m) => m.id === selected) ?? matches.find((m) => m.id === focusId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="caps-label">Coming up</p>
      <h1 className="font-display text-[2.4rem] font-black tracking-tight">Next matches</h1>
      <div className="mt-[0.8rem] grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-[1rem]">
        <div className="grid min-h-0 grid-cols-3 content-start gap-[0.8rem] overflow-y-auto p-[0.4rem]">
          {next.data === undefined && next.error !== undefined ? (
            <ErrorPanel title="The schedule could not be loaded" className="col-span-3" />
          ) : next.data === undefined ? (
            Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[11rem]" />)
          ) : matches.length === 0 ? (
            <p className="col-span-3 py-[4rem] text-center text-[1.3rem] text-text-muted">Nothing scheduled.</p>
          ) : (
            matches.map((m) => (
              <Card
                key={m.id}
                match={m}
                standings={tables.data?.get(m.leagueId)}
                markets={markets.data?.get(m.id)}
                featured={m.id === featured?.matchId}
                followed={follows(favourites, m.home.id, m.away.id)}
                autoFocus={m.id === focusId}
                onFocus={() => {
                  setSelected(m.id);
                }}
              />
            ))
          )}
        </div>
        {current === undefined ? <div className="border border-border bg-surface" /> : <Detail match={current} standings={tables.data?.get(current.leagueId)} markets={markets.data?.get(current.id)} />}
      </div>
      {featured !== undefined && (
        <p className="mt-[0.5rem] text-[0.85rem] text-text-muted">
          Featured: the meeting of the highest-placed teams in the platform's tables ({ordinal(featured.homePosition)} v {ordinal(featured.awayPosition)}).
        </p>
      )}
    </div>
  );
}
