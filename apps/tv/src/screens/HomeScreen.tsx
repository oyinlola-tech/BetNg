import { LeagueMark } from "../components/BrandMarks";
import { Link } from "react-router";
import {
  formatBroadcastClock,
  formatMatchday,
  displayClock,
  type MatchSummary,
} from "@betng/ui-core";
import {
  AnimatedScore,
  Countdown,
  Focusable,
  LiveTag,
  ErrorPanel,
  Skeleton,
  TeamMark,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";
import { polledClockNow, useDataHealth } from "../lib/dataHealth";
import { reads } from "../lib/reads";

function Rail({
  title,
  children,
  to,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly to?: string;
}): React.JSX.Element {
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-[0.6rem] flex items-baseline justify-between">
        <h2 className="caps-label text-[0.95rem] text-text-secondary">
          {title}
        </h2>
        {to !== undefined && (
          <Link to={to} className="text-[0.85rem] text-text-muted">
            See all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Hero({ match }: { readonly match: MatchSummary }): React.JSX.Element {
  const now = useNow(500);
  const health = useDataHealth();
  const clock = displayClock(match.clock, polledClockNow(health, now));

  return (
    <Focusable
      to={`/live/${match.id}`}
      autoFocusOnMount
      className="relative block w-full overflow-hidden border border-border bg-surface text-left focus:transform-none!"
    >
      <div className="flex items-center gap-[1rem] border-b border-border px-[1.6rem] py-[0.8rem]">
        <LiveTag phase={match.phase} large />
        <span className="text-[1rem] font-semibold text-text-secondary">
          {match.leagueName} · {formatMatchday(match.matchday)}
        </span>
        <span className="ml-auto font-display text-[1.6rem] font-black tabular text-live">
          {match.phase === "HALFTIME"
            ? "HT"
            : clock === undefined
              ? "LIVE"
              : formatBroadcastClock(clock.minute, clock.second)}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[2rem] px-[2rem] py-[2rem]">
        <HeroSide team={match.home} />
        <p className="whitespace-nowrap font-display text-[6rem] font-black leading-none tabular tracking-tighter">
          <AnimatedScore value={match.score.home} />
          <span className="mx-[0.2em] font-sans font-medium text-text-muted">
            –
          </span>
          <AnimatedScore value={match.score.away} />
        </p>
        <HeroSide team={match.away} />
      </div>
      <p className="absolute bottom-[0.8rem] right-[1.6rem] text-[0.9rem] font-semibold text-text-muted">
        Press OK to watch
      </p>
    </Focusable>
  );
}

function HeroSide({ team }: { readonly team: MatchSummary["home"] }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col items-center gap-[0.7rem] text-center">
      <TeamMark team={team} size="hero" />
      <p className="w-full truncate font-display text-[2rem] font-black leading-none tracking-tight">{team.name}</p>
      <p className="text-[1rem] text-text-muted">{team.city}</p>
    </div>
  );
}

function NextCard({
  match,
}: {
  readonly match: MatchSummary;
}): React.JSX.Element {
  return (
    <Focusable
      to={`/live/${match.id}`}
      className="flex w-full items-center gap-[1rem] border border-border bg-surface px-[1.1rem] py-[0.9rem] text-left"
    >
      <TeamMark team={match.home} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold">
        {match.home.shortName} <span className="text-text-muted">v</span>{" "}
        {match.away.shortName}
      </span>
      <TeamMark team={match.away} size="sm" />
      <Countdown
        to={match.kickoffAt}
        className="ml-[0.6rem] font-display text-[1.4rem] font-black"
      />
    </Focusable>
  );
}

function ResultRow({
  match,
}: {
  readonly match: MatchSummary;
}): React.JSX.Element {
  const hw = match.score.home > match.score.away;
  const aw = match.score.away > match.score.home;

  return (
    <Focusable
      to={`/live/${match.id}`}
      className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-[0.8rem] border border-border bg-surface px-[1.1rem] py-[0.7rem] text-[1.05rem]"
    >
      <span
        className={cn(
          "truncate text-right",
          hw ? "font-bold" : "text-text-secondary",
        )}
      >
        {match.home.shortName}
      </span>
      <span className="rounded-xs bg-surface-sunken px-[0.6rem] py-[0.1rem] font-display text-[1.2rem] font-black tabular">
        {match.score.home}–{match.score.away}
      </span>
      <span
        className={cn("truncate", aw ? "font-bold" : "text-text-secondary")}
      >
        {match.away.shortName}
      </span>
    </Focusable>
  );
}

export function HomeScreen(): React.JSX.Element {
  const live = useAsync(
    () => reads.listMatches({ phases: ["LIVE", "HALFTIME"] }),
    [],
    3000,
  );
  const next = useAsync(
    () =>
      reads.listMatches({
        phases: ["BETTING_OPEN", "BETTING_CLOSED"],
        limit: 5,
      }),
    [],
    5000,
  );
  const results = useAsync(
    () => reads.listMatches({ phases: ["FINISHED", "SETTLED"], limit: 4 }),
    [],
    6000,
  );
  const leagues = useAsync(() => reads.listLeagues(), [], 30_000);
  const featured = live.data?.[0];

  return (
    <div className="grid h-full grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] gap-[1.6rem]">
      <div className="-mx-[1rem] flex min-h-0 flex-col gap-[1.4rem] overflow-y-auto px-[1rem] py-[0.6rem]">
        <Rail title="Live now">
          {featured === undefined && live.error !== undefined ? (
            <ErrorPanel title="Live matches could not be loaded" className="h-[16rem] border border-border bg-surface" />
          ) : live.loading && featured === undefined ? (
            <Skeleton className="h-[16rem]" />
          ) : featured === undefined ? (
            <div className="flex h-[16rem] flex-col items-center justify-center border border-border bg-surface">
              <p className="font-display text-[1.8rem] font-bold">
                No match in play
              </p>
              <p className="text-[1rem] text-text-muted">
                The next kick-off is moments away.
              </p>
            </div>
          ) : (
            <Hero match={featured} />
          )}
        </Rail>
        {live.data !== undefined && live.data.length > 1 && (
          <Rail title="Also live">
            <div className="grid grid-cols-3 gap-[0.8rem]">
              {live.data.slice(1, 7).map((m) => (
                <ResultRow key={m.id} match={m} />
              ))}
            </div>
          </Rail>
        )}
        <Rail title="Competitions" to="/standings">
          <div className="grid grid-cols-4 gap-[0.8rem]">
            {(leagues.data ?? []).map((l) => (
              <Focusable
                key={l.id}
                to={`/standings?league=${l.id}`}
                className="flex w-full items-center gap-[0.8rem] border border-border bg-surface px-[0.9rem] py-[0.7rem] text-left"
              >
                <LeagueMark slug={l.slug} code={l.code} className="size-[2.3rem] shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[0.92rem] leading-tight font-bold">
                    {l.name}
                  </span>
                  <span className="block truncate text-[0.8rem] text-text-muted">
                    {formatMatchday(l.currentMatchday)}
                  </span>
                </span>
              </Focusable>
            ))}
          </div>
        </Rail>
      </div>
      <div className="-mx-[1rem] flex min-h-0 flex-col gap-[1.4rem] overflow-y-auto px-[1rem] py-[0.6rem]">
        <Rail title="Next matches" to="/upcoming">
          <div className="flex flex-col gap-[0.6rem]">
            {next.loading && next.data === undefined ? (
              <Skeleton className="h-[10rem]" />
            ) : (
              (next.data ?? []).map((m) => <NextCard key={m.id} match={m} />)
            )}
          </div>
        </Rail>
        <Rail title="Results" to="/results">
          <div className="flex flex-col gap-[0.6rem]">
            {results.loading && results.data === undefined ? (
              <Skeleton className="h-[10rem]" />
            ) : (
              (results.data ?? []).map((m) => (
                <ResultRow key={m.id} match={m} />
              ))
            )}
          </div>
        </Rail>
      </div>
    </div>
  );
}
