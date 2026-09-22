import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { formatMatchday, type LiveMatchSnapshot, type MatchSummary, type Score } from "@betng/ui-core";
import { AnimatedScore, ErrorPanel, FavouriteMark, Focusable, GoalFlash, LiveTag, MatchClock, MiniScoreboard, Skeleton, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { useGoalFlash } from "../hooks/useGoalFlash";
import { useLiveMatches } from "../hooks/useLiveMatch";
import { useMatchAudio } from "../hooks/useMatchAudio";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";
import { headlineOf, isQuietWorthy } from "../lib/commentary";
import { useDisplaySettings } from "../lib/displaySettings";
import { follows, useFavourites } from "../lib/favourites";
import { decideAutoSwitch, detectGoals, IDLE_SWITCH, orderForSplit, type AutoSwitchState } from "../lib/multiview";
import { reads } from "../lib/reads";

export const HOLD_MS = 15_000;

type View = "2" | "3" | "4" | "all";

const VIEWS: readonly { readonly view: View; readonly label: string }[] = [
  { view: "2", label: "2 up" },
  { view: "3", label: "3 up" },
  { view: "4", label: "4 up" },
  { view: "all", label: "All live" },
];

function isView(value: string | null): value is View {
  return value === "2" || value === "3" || value === "4" || value === "all";
}

function Tile({
  summary,
  snapshot,
  size,
  followed,
  autoFocus,
}: {
  readonly summary: MatchSummary;
  readonly snapshot: LiveMatchSnapshot | undefined;
  readonly size: "full" | "split" | "grid";
  readonly followed: boolean;
  readonly autoFocus: boolean;
}): React.JSX.Element {
  const [settings] = useDisplaySettings();
  const match = snapshot?.match;
  const score: Score = match?.score ?? summary.score;
  const flash = useGoalFlash(summary.id, score);
  const last = match?.events.filter((e) => e.side !== undefined && (!settings.quietMode || isQuietWorthy(e.kind))).at(-1);
  const big = size === "full";
  const grid = size === "grid";
  const self = useRef<HTMLButtonElement | HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    const active = document.activeElement;

    if (big && (active === null || active === document.body || !active.isConnected)) self.current?.focus({ preventScroll: true });
  }, [big]);

  return (
    <Focusable
      ref={self}
      to={`/live/${summary.id}`}
      autoFocusOnMount={autoFocus}
      data-tile={summary.id}
      className={cn("relative flex h-full w-full flex-col overflow-hidden border border-border bg-surface text-left", grid ? "px-[0.9rem] py-[0.6rem]" : "px-[1.4rem] py-[1rem]")}
    >
      <div className="flex items-center gap-[0.7rem]">
        <LiveTag phase={match?.phase ?? summary.phase} large={big} />
        <span className={cn("truncate font-semibold text-text-secondary", big ? "text-[1.1rem]" : "text-[0.85rem]")}>
          {summary.leagueCode} · {formatMatchday(summary.matchday)}
        </span>
        {followed && <FavouriteMark className="text-[1rem]" />}
        <MatchClock match={match ?? summary} realtime={match !== undefined} className={cn("ml-auto", big ? "text-[2.2rem]" : grid ? "text-[1.1rem]" : "text-[1.5rem]")} />
      </div>
      <div className={cn("grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center", big ? "gap-[2.4rem]" : "gap-[0.9rem]")}>
        <span className="flex min-w-0 flex-col items-center gap-[0.4rem] text-center">
          <TeamMark team={summary.home} size={big ? "xl" : grid ? "sm" : "lg"} />
          <span className={cn("w-full truncate font-display font-black", big ? "text-[2.4rem]" : grid ? "text-[1rem]" : "text-[1.4rem]")}>{grid ? summary.home.code : summary.home.name}</span>
        </span>
        <span className={cn("whitespace-nowrap font-display font-black leading-none", big ? "text-[9rem]" : grid ? "text-[2.2rem]" : "text-[4.2rem]")}>
          <AnimatedScore value={score.home} />
          <span className="mx-[0.15em] font-sans font-medium text-text-muted">–</span>
          <AnimatedScore value={score.away} />
        </span>
        <span className="flex min-w-0 flex-col items-center gap-[0.4rem] text-center">
          <TeamMark team={summary.away} size={big ? "xl" : grid ? "sm" : "lg"} />
          <span className={cn("w-full truncate font-display font-black", big ? "text-[2.4rem]" : grid ? "text-[1rem]" : "text-[1.4rem]")}>{grid ? summary.away.code : summary.away.name}</span>
        </span>
      </div>
      {!grid && (
        <p className={cn("truncate text-text-secondary", big ? "text-[1.3rem]" : "text-[1rem]")}>
          {last === undefined ? " " : `${String(last.minute)}' ${headlineOf(last.kind)} · ${last.player ?? last.description}`}
        </p>
      )}
      <GoalFlash flash={flash} home={summary.home} away={summary.away} score={score} compact={!big} />
    </Focusable>
  );
}

export function MultiScreen(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const view: View = isView(requested) ? requested : "4";
  const [settings] = useDisplaySettings();
  const favourites = useFavourites();
  const now = useNow(1000);
  const live = useAsync(() => reads.listMatches({ phases: ["LIVE", "HALFTIME"] }), [], 3000);
  const next = useAsync(() => reads.listMatches({ phases: ["BETTING_OPEN", "BETTING_CLOSED", "SCHEDULED"], limit: 4 }), [], 8000);
  const ordered = useMemo(() => orderForSplit(live.data ?? [], favourites), [live.data, favourites]);
  const [switchState, setSwitchState] = useState<AutoSwitchState>(IDLE_SWITCH);
  const count = view === "all" ? 0 : Number(view);
  const shown = ordered.slice(0, count);
  const watched = [...shown.map((m) => m.id), ...(switchState.focusId === undefined ? [] : [switchState.focusId])];
  const snapshots = useLiveMatches(watched);
  const previous = useRef(new Map<string, Score>());
  const merged = ordered.map((m) => ({ id: m.id, score: snapshots.get(m.id)?.match?.score ?? m.score }));
  const signature = merged.map((m) => `${m.id}:${String(m.score.home)}-${String(m.score.away)}`).join("|");
  const latest = useRef(merged);

  latest.current = merged;
  useMatchAudio(watched.map((id) => snapshots.get(id)?.match));

  useEffect(() => {
    const goals = detectGoals(previous.current, latest.current);

    previous.current = new Map(latest.current.map((m) => [m.id, m.score]));
    setSwitchState((s) => decideAutoSwitch(s, goals, Date.now(), { enabled: settings.autoSwitchOnGoal, cooldownMs: settings.autoSwitchCooldownSec * 1000, holdMs: HOLD_MS }));
  }, [signature, now, settings.autoSwitchOnGoal, settings.autoSwitchCooldownSec]);

  const expanded = switchState.focusId === undefined ? undefined : ordered.find((m) => m.id === switchState.focusId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-[0.8rem]">
      <header className="flex items-center gap-[0.6rem]">
        <div className="mr-auto">
          <p className="caps-label">Live now · {ordered.length} in play</p>
          <h1 className="font-display text-[2rem] font-black leading-none tracking-tight">Multi-match</h1>
        </div>
        <p className="mr-[1rem] text-[0.9rem] text-text-muted">
          {settings.autoSwitchOnGoal ? `Full screen on a goal · at most once every ${String(settings.autoSwitchCooldownSec)}s` : "Full screen on a goal is off"}
        </p>
        {VIEWS.map((v) => (
          <Focusable
            key={v.view}
            onClick={() => {
              setParams({ view: v.view }, { replace: true });
            }}
            aria-pressed={v.view === view}
            autoFocusOnMount={v.view === view && expanded === undefined}
            className={cn("px-[1rem] py-[0.5rem] text-[1rem] font-bold", v.view === view ? "bg-brand text-text-on-brand" : "border border-border bg-surface text-text-secondary")}
          >
            {v.label}
          </Focusable>
        ))}
      </header>

      <div className="relative min-h-0 flex-1">
        {live.data === undefined && live.error !== undefined ? (
          <ErrorPanel title="Live matches could not be loaded" className="border border-border bg-surface" />
        ) : live.data === undefined ? (
          <div className="grid h-full grid-cols-2 gap-[0.8rem]">
            <Skeleton className="h-full" />
            <Skeleton className="h-full" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center border border-border bg-surface">
            <p className="font-display text-[2rem] font-bold">No match in play</p>
            <p className="text-[1.1rem] text-text-muted">The next kick-offs are below.</p>
          </div>
        ) : expanded !== undefined ? (
          <div className="h-full" data-expanded={expanded.id}>
            <Tile summary={expanded} snapshot={snapshots.get(expanded.id)} size="full" followed={follows(favourites, expanded.home.id, expanded.away.id)} autoFocus />
          </div>
        ) : view === "all" ? (
          <div className="grid h-full auto-rows-[minmax(0,9rem)] grid-cols-4 content-start gap-[0.7rem] overflow-y-auto p-[0.4rem]">
            {ordered.map((m) => (
              <Tile key={m.id} summary={m} snapshot={undefined} size="grid" followed={follows(favourites, m.home.id, m.away.id)} autoFocus={false} />
            ))}
          </div>
        ) : (
          <div className={cn("grid h-full gap-[0.8rem] p-[0.4rem]", count === 2 && "grid-cols-2", count === 3 && "grid-cols-3", count === 4 && "grid-cols-2 grid-rows-2")}>
            {shown.map((m) => (
              <Tile key={m.id} summary={m} snapshot={snapshots.get(m.id)} size="split" followed={follows(favourites, m.home.id, m.away.id)} autoFocus={false} />
            ))}
          </div>
        )}
      </div>

      <section aria-label="Up next" className="grid grid-cols-4 gap-[0.7rem]">
        {(next.data ?? []).map((m) => (
          <MiniScoreboard key={m.id} match={m} followed={follows(favourites, m.home.id, m.away.id)} />
        ))}
      </section>
    </div>
  );
}
