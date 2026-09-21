import { useEffect, useRef } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { LeagueMark, LiveDot, Skeleton, cn, useFlag } from "@betng/ui-web";
import { useLeagues, useMatches } from "../../hooks/queries";
import { paths } from "../../lib/paths";
import { LEAGUE_FILTER_PATHS } from "./nav";

function LiveNow(): React.JSX.Element {
  const live = useMatches({ phases: ["LIVE", "HALFTIME"] });
  const count = live.data?.length;

  return (
    <Link
      to={paths.live}
      aria-label={count === undefined ? "Live now" : `Live now, ${String(count)} ${count === 1 ? "match" : "matches"}`}
      className="flex h-8 shrink-0 items-center gap-2 rounded-sm border border-border bg-surface px-2.5 focus-ring hover:bg-surface-hover"
    >
      <LiveDot className={count === 0 ? "bg-text-muted animate-none" : undefined} />
      <span className="type-caption text-text-primary">Live now</span>
      <span className="type-data min-w-4 text-center font-semibold" data-testid="live-count">
        {count ?? "–"}
      </span>
    </Link>
  );
}

export function LeagueBar(): React.JSX.Element {
  const leagues = useLeagues();
  const liveEnabled = useFlag("liveEnabled");
  const location = useLocation();
  const params = useParams();
  const [search] = useSearchParams();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const filter = LEAGUE_FILTER_PATHS.find((entry) => location.pathname === entry.path);
  const activeId = params["leagueId"] ?? (filter === undefined ? undefined : (search.get("league") ?? undefined));
  const chip = "flex h-8 shrink-0 items-center gap-2 rounded-sm border px-2.5 text-base font-medium focus-ring";
  const on = "border-brand bg-brand-subtle text-text-primary";
  const off = "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary";

  const filterLink = (leagueId: string | undefined): string => {
    const next = new URLSearchParams(search);

    for (const key of ["league", "matchday", "season"]) next.delete(key);
    if (leagueId === undefined) next.delete("view");
    else next.set("league", leagueId);

    const query = next.toString();

    return query === "" ? location.pathname : `${location.pathname}?${query}`;
  };

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  return (
    <nav aria-label="Competitions" className="border-b border-border bg-background">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-2 overflow-x-auto px-4 scrollbar-thin md:px-6 lg:px-8">
        {liveEnabled && <LiveNow />}
        {liveEnabled && <span aria-hidden className="h-5 w-px shrink-0 bg-border" />}
        {leagues.isPending &&
          [0, 1, 2, 3].map((slot) => <Skeleton key={slot} className="h-8 w-32 shrink-0" />)}
        {leagues.isError && <p className="text-sm text-text-muted">Competitions could not be loaded.</p>}
        {filter?.all === true && leagues.data !== undefined && (
          <Link to={filterLink(undefined)} replace aria-current={activeId === undefined ? "page" : undefined} className={cn(chip, activeId === undefined ? on : off)}>
            <span className="whitespace-nowrap">All competitions</span>
          </Link>
        )}
        {leagues.data?.map((league) => {
          const active = league.id === activeId;
          const to = filter === undefined ? paths.league(league.id) : filterLink(league.id);

          return (
            <Link
              key={league.id}
              ref={active ? activeRef : undefined}
              to={to}
              replace={filter !== undefined}
              aria-current={active ? "page" : undefined}
              className={cn(chip, active ? on : off)}
            >
              <LeagueMark slug={league.slug} code={league.code} size={20} />
              <span className="whitespace-nowrap">{league.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
