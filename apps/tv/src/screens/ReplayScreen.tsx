import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { MatchId } from "@betng/contracts";
import { formatMatchday, isFinished } from "@betng/ui-core";
import { AnimatedScore, ErrorPanel, Focusable, FootballIcon, iconForEvent, Skeleton, TeamMark, VirtualList } from "../components";
import { useAsync } from "../hooks/useAsync";
import { headlineOf, severityOf } from "../lib/commentary";
import { cn } from "../lib/cn";
import { reads } from "../lib/reads";
import { inSequence, MS_PER_MINUTE, replayScore, replaySchedule, revealedAt } from "../lib/replay";

const SPEEDS = [1, 2, 4] as const;

/* Plays back the platform's stored timeline of a completed match. Nothing is simulated: order, minutes, players and scores are the recorded ones. */
export function ReplayScreen(): React.JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const match = useAsync(() => (matchId === undefined ? Promise.reject(new Error("No match")) : reads.getMatch(matchId as MatchId)), [matchId]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [elapsed, setElapsed] = useState(0);
  const events = useMemo(() => inSequence(match.data?.events ?? []), [match.data]);
  const schedule = useMemo(() => replaySchedule(events, MS_PER_MINUTE), [events]);
  const end = schedule.at(-1) ?? 0;

  useEffect(() => {
    if (!playing) return;

    let last = Date.now();
    const timer = setInterval(() => {
      const t = Date.now();
      const step = Math.max(0, t - last) * speed;

      last = t;
      setElapsed((e) => Math.min(end, e + step));
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [playing, speed, end]);

  useEffect(() => {
    if (end > 0 && elapsed >= end) setPlaying(false);
  }, [elapsed, end]);

  if (matchId === undefined) return <Navigate to="/results" replace />;

  if (match.data === undefined && match.error !== undefined) return <ErrorPanel title="This replay could not be loaded" className="border border-border bg-surface" />;

  if (match.data === undefined) return <Skeleton className="h-full" />;

  const m = match.data;

  if (!isFinished(m.phase)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[1rem] border border-border bg-surface">
        <p className="font-display text-[2rem] font-bold">Replay is available once the platform completes the match</p>
        <Focusable to={`/live/${m.id}`} autoFocusOnMount className="bg-brand px-[1.2rem] py-[0.5rem] text-[1.05rem] font-bold text-text-on-brand">
          Watch the match
        </Focusable>
      </div>
    );
  }

  const revealed = revealedAt(schedule, elapsed);
  const score = replayScore(events, revealed);
  const current = revealed === 0 ? undefined : events[revealed - 1];
  const shown = events.slice(0, revealed);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-[1rem]">
      <section aria-label="Replay" data-revealed={revealed} className="flex min-h-0 flex-col border border-border bg-surface">
        <div className="flex items-center gap-[0.8rem] border-b border-border px-[1.4rem] py-[0.7rem]">
          <span className="rounded-xs bg-surface-sunken px-[0.6rem] py-[0.15rem] font-display text-[0.9rem] font-black uppercase tracking-caps text-text-secondary">Replay</span>
          <span className="text-[0.95rem] font-semibold text-text-secondary">
            {m.leagueName} · {formatMatchday(m.matchday)} · recorded platform timeline
          </span>
          <span className="ml-auto font-display text-[2rem] font-black tabular text-text-secondary">{current === undefined ? "0'" : `${String(current.minute)}'`}</span>
        </div>
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[2rem] px-[2rem]">
          <div className="flex min-w-0 flex-col items-center gap-[0.5rem] text-center">
            <TeamMark team={m.home} size="hero" />
            <p className="w-full truncate font-display text-[2rem] font-black">{m.home.name}</p>
          </div>
          <p className="whitespace-nowrap font-display text-[7rem] font-black leading-none">
            <AnimatedScore value={score.home} />
            <span className="mx-[0.15em] font-sans font-medium text-text-muted">–</span>
            <AnimatedScore value={score.away} />
          </p>
          <div className="flex min-w-0 flex-col items-center gap-[0.5rem] text-center">
            <TeamMark team={m.away} size="hero" />
            <p className="w-full truncate font-display text-[2rem] font-black">{m.away.name}</p>
          </div>
        </div>
        <p role="status" aria-live="polite" className="px-[1.4rem] text-center text-[1.4rem] font-bold">
          {current === undefined ? "Kick-off" : `${headlineOf(current.kind)} · ${current.player ?? current.description}`}
        </p>
        <div className="mx-[1.4rem] mt-[0.8rem] h-[0.5rem] overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          <div className="h-full bg-brand" style={{ width: `${String(end === 0 ? 100 : (elapsed / end) * 100)}%` }} />
        </div>
        <div className="flex items-center gap-[0.6rem] px-[1.4rem] py-[0.9rem]">
          <Focusable
            autoFocusOnMount
            aria-label={playing ? "Pause replay" : "Play replay"}
            onClick={() => {
              if (!playing && elapsed >= end) setElapsed(0);
              setPlaying((p) => !p);
            }}
            className="inline-flex items-center gap-[0.5rem] bg-brand px-[1.2rem] py-[0.5rem] text-[1.05rem] font-bold text-text-on-brand"
          >
            {playing ? <Pause className="size-[1.1rem]" aria-hidden /> : <Play className="size-[1.1rem]" aria-hidden />}
            {playing ? "Pause" : "Play"}
          </Focusable>
          <Focusable
            aria-label="Restart replay"
            onClick={() => {
              setElapsed(0);
              setPlaying(true);
            }}
            className="inline-flex items-center gap-[0.5rem] border border-border-strong bg-surface-sunken px-[1.2rem] py-[0.5rem] text-[1.05rem] font-bold"
          >
            <RotateCcw className="size-[1.1rem]" aria-hidden />
            Restart
          </Focusable>
          <Focusable
            aria-label={`Replay speed ${String(speed)} times`}
            onClick={() => {
              setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length] ?? 1);
            }}
            className="border border-border-strong bg-surface-sunken px-[1.2rem] py-[0.5rem] text-[1.05rem] font-bold tabular"
          >
            Speed ×{speed}
          </Focusable>
          <span className="ml-auto text-[0.95rem] text-text-muted">
            Final score {m.score.home}–{m.score.away} · {events.length} recorded events
          </span>
        </div>
      </section>
      <section aria-label="Replay timeline" className="flex min-h-0 flex-col border border-border bg-surface">
        <h2 className="caps-label border-b border-border px-[1.2rem] py-[0.6rem]">Timeline</h2>
        {events.length === 0 ? (
          <p className="px-[1.2rem] py-[1rem] text-[1.05rem] text-text-muted">The platform has no recorded events for this match.</p>
        ) : (
          <VirtualList
            label="Recorded events"
            items={shown}
            keyOf={(e) => e.id}
            heightOf={(e) => (severityOf(e.kind) === "major" ? 3.4 : 2.4)}
            {...(shown.length === 0 ? {} : { anchor: shown.length - 1 })}
            className="flex-1 p-[0.6rem]"
            render={(e) => (
              <div className={cn("grid h-full grid-cols-[3rem_1.6rem_1fr_auto] items-center gap-[0.7rem] border-b border-border px-[0.6rem]", severityOf(e.kind) === "major" && "bg-surface-elevated")}>
                <span className="font-display font-black tabular text-text-muted">{e.minute}'</span>
                <FootballIcon name={iconForEvent(e.kind)} className="size-[1.4rem] text-text-secondary" />
                <span className={cn("truncate", severityOf(e.kind) === "major" ? "text-[1.3rem] font-black" : "text-[1rem]")}>
                  {headlineOf(e.kind)}
                  {e.player === undefined ? "" : ` · ${e.player}`}
                </span>
                <span className="font-display font-black tabular">
                  {e.score.home}–{e.score.away}
                </span>
              </div>
            )}
          />
        )}
      </section>
    </div>
  );
}
