import { useEffect } from "react";
import { Navigate, useParams } from "react-router";
import {
  formatBroadcastClock,
  formatMatchday,
  isInPlay,
  displayClock,
  type MatchEventView,
} from "@betng/ui-core";
import {
  AnimatedScore,
  BroadcastOverlay,
  Countdown,
  Focusable,
  GoalFlash,
  FootballIcon,
  iconForEvent,
  LiveTag,
  MatchStrip,
  Pitch,
  Skeleton,
  StatRow,
  TeamMark,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { useGoalFlash } from "../hooks/useGoalFlash";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { useMatchAudio } from "../hooks/useMatchAudio";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";
import { freshness, liveClockNow, useDataHealth } from "../lib/dataHealth";
import { clockTime } from "../components/ConnectionPill";
import { useDisplaySettings } from "../lib/displaySettings";
import { reads } from "../lib/reads";
import { dataSource } from "../services/dataSource";

const KEY_EVENTS = new Set<MatchEventView["kind"]>([
  "GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
  "HALF_TIME",
  "FULL_TIME",
]);

function eventLabel(e: MatchEventView): string {
  switch (e.kind) {
    case "GOAL":
      return "GOAL";
    case "YELLOW_CARD":
      return "YELLOW";
    case "RED_CARD":
      return "RED";
    case "SUBSTITUTION":
      return "SUB";
    case "HALF_TIME":
      return "HT";
    case "FULL_TIME":
      return "FT";
    default:
      return e.kind;
  }
}

export function LiveScreen(): React.JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const { match, lastEvent, connection, error } = useLiveMatch(matchId);
  const [settings] = useDisplaySettings();
  const flash = useGoalFlash(matchId, match?.score);
  const live = useAsync(
    () => reads.listMatches({ phases: ["LIVE", "HALFTIME"] }),
    [],
    4000,
  );
  const next = useAsync(
    () =>
      reads.listMatches({
        phases: ["BETTING_OPEN", "BETTING_CLOSED"],
        limit: 1,
      }),
    [],
    5000,
  );
  const now = useNow(250);
  const health = useDataHealth();

  useMatchAudio([match]);

  useEffect(() => {
    if (matchId !== undefined) dataSource.recordView(matchId as never);
  }, [matchId]);

  if (matchId === undefined) return <Navigate to="/" replace />;

  if (error !== undefined && match === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center border border-border bg-surface">
        <p className="font-display text-[2rem] font-bold">Match unavailable</p>
        <p className="text-[1.1rem] text-text-muted">{error}</p>
      </div>
    );
  }

  if (match === undefined) {
    return (
      <div className="grid h-full grid-rows-[1fr_auto] gap-[1rem]" aria-busy>
        <Skeleton className="h-full" />
        <Skeleton className="h-[12rem]" />
      </div>
    );
  }

  const stale = freshness(health, now, true) === "stale";
  const clock = displayClock(match.clock, liveClockNow(health.realtimeDownSince, now));
  const inPlay = isInPlay(match.phase);
  const events = match.events
    .filter((e) => KEY_EVENTS.has(e.kind))
    .slice(-5)
    .reverse();
  const upNext = next.data?.[0];

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-[1rem]">
      <div className="relative min-h-0 overflow-hidden rounded-md border border-border bg-black">
        <Pitch match={match} className="absolute inset-0" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-[1.4rem]">
          <div className="flex items-center gap-[0.8rem] rounded-md bg-black/60 px-[1rem] py-[0.6rem] text-white backdrop-blur-sm">
            <LiveTag phase={match.phase} />
            <span className="text-[0.95rem] font-semibold">
              {match.leagueCode} · {formatMatchday(match.matchday)}
            </span>
          </div>
          <div className={cn("flex items-stretch overflow-hidden rounded-md bg-black/70 text-white backdrop-blur-sm", stale && "opacity-60")} aria-describedby={stale ? "tv-live-stale" : undefined}>
            <span className="flex items-center gap-[0.7rem] px-[1.2rem] py-[0.7rem] font-display text-[1.7rem] font-black">
              <TeamMark team={match.home} size="md" />
              {match.home.code}
            </span>
            <span className="flex items-center bg-white px-[1.2rem] font-display text-[2.4rem] font-black tabular text-black">
              <AnimatedScore value={match.score.home} />
              <span className="mx-[0.3em]">–</span>
              <AnimatedScore value={match.score.away} />
            </span>
            <span className="flex items-center gap-[0.7rem] px-[1.2rem] py-[0.7rem] font-display text-[1.7rem] font-black">
              {match.away.code}
              <TeamMark team={match.away} size="md" />
            </span>
            <span
              className={cn(
                "flex items-center border-l border-white/15 px-[1.2rem] font-display text-[1.7rem] font-black tabular",
                inPlay && !stale ? "text-live" : "text-white/70",
              )}
            >
              {match.phase === "HALFTIME"
                ? "HT"
                : clock === undefined
                  ? inPlay
                    ? "LIVE"
                    : ""
                  : formatBroadcastClock(clock.minute, clock.second)}
            </span>
          </div>
        </div>
        {!inPlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-[5rem] text-white">
            {match.phase === "FINISHED" || match.phase === "SETTLED" ? (
              <>
                <p className="caps-label text-white/70">Full time</p>
                <p className="mt-[0.4rem] font-display text-[7rem] font-black leading-none tabular">
                  {match.score.home} – {match.score.away}
                </p>
                <p className="mt-[0.6rem] text-[1.6rem] font-bold">
                  {match.home.name} <span className="text-white/60">v</span>{" "}
                  {match.away.name}
                </p>
                <Focusable to={`/replay/${match.id}`} autoFocusOnMount className="mt-[1.2rem] bg-white px-[1.4rem] py-[0.6rem] text-[1.1rem] font-bold text-black">
                  Replay the recorded timeline
                </Focusable>
              </>
            ) : (
              <>
                <p className="caps-label text-white/70">Kick-off in</p>
                <Countdown
                  to={match.kickoffAt}
                  className="mt-[0.4rem] font-display text-[6rem] font-black leading-none"
                />
                <p className="mt-[0.6rem] text-[1.6rem] font-bold">
                  {match.home.name} <span className="text-white/60">v</span>{" "}
                  {match.away.name}
                </p>
              </>
            )}
          </div>
        )}
        {(connection !== "CONNECTED" || stale) && (
          <div
            id="tv-live-stale"
            role="status"
            className="absolute bottom-[1.4rem] right-[1.4rem] rounded-md bg-warning px-[1rem] py-[0.6rem] text-[1rem] font-bold text-text-on-status"
          >
            {stale
              ? `Out of date · live updates stopped at ${clockTime(health.realtimeDownSince ?? now)}`
              : connection === "OFFLINE" || connection === "FAILED"
                ? "Connection lost · showing last known state"
                : connection === "CONNECTING"
                  ? "Connecting…"
                  : "Reconnecting…"}
          </div>
        )}
        <GoalFlash flash={flash} home={match.home} away={match.away} score={match.score} />
        <BroadcastOverlay match={match} lastEvent={lastEvent} quiet={settings.quietMode} />
      </div>

      <div className="grid grid-cols-[1.3fr_1fr_0.9fr] gap-[1rem]">
        <section
          aria-label="Live events"
          className="border border-border bg-surface px-[1.2rem] py-[0.9rem]"
        >
          <h2 className="caps-label mb-[0.5rem]">Live events</h2>
          {events.length === 0 ? (
            <p className="text-[1rem] text-text-muted">
              Nothing yet — kick-off is the first entry.
            </p>
          ) : (
            <ol className="space-y-[0.35rem]">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[2.6rem_1.6rem_4.2rem_1fr_auto] items-center gap-[0.8rem] text-[1.05rem]"
                >
                  <span className="font-display font-black tabular text-text-muted">
                    {e.side === undefined ? "" : `${String(e.minute)}'`}
                  </span>
                  <FootballIcon name={iconForEvent(e.kind)} className="size-[1.5rem] text-text-secondary" />
                  <span
                    className={cn(
                      "rounded-xs px-[0.4rem] text-center text-[0.75rem] font-black tracking-caps",
                      e.kind === "GOAL" && "bg-text-primary text-background",
                      e.kind === "YELLOW_CARD" && "bg-warning text-text-on-status",
                      e.kind === "RED_CARD" && "bg-danger text-text-on-status",
                      (e.kind === "SUBSTITUTION" || e.side === undefined) &&
                        "bg-surface-sunken text-text-secondary",
                    )}
                  >
                    {eventLabel(e)}
                  </span>
                  <span className="truncate font-semibold">
                    {e.player ?? e.description}
                  </span>
                  <span className="text-[0.9rem] text-text-muted">
                    {e.side === "HOME"
                      ? match.home.code
                      : e.side === "AWAY"
                        ? match.away.code
                        : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section
          aria-label="Match statistics"
          className="border border-border bg-surface px-[1.2rem] py-[0.9rem]"
        >
          <h2 className="caps-label mb-[0.5rem]">Match stats</h2>
          {match.stats === undefined ? (
            <p className="text-[1rem] text-text-muted">
              Available from kick-off.
            </p>
          ) : (
            <div className="space-y-[0.6rem]">
              <StatRow
                label="Possession"
                home={match.stats.home.possession}
                away={match.stats.away.possession}
                percent
              />
              <StatRow
                label="Shots"
                home={match.stats.home.shots}
                away={match.stats.away.shots}
              />
              <StatRow
                label="On target"
                home={match.stats.home.shotsOnTarget}
                away={match.stats.away.shotsOnTarget}
              />
              <StatRow
                label="Corners"
                home={match.stats.home.corners}
                away={match.stats.away.corners}
              />
            </div>
          )}
        </section>
        <section
          aria-label="Next match"
          className="flex flex-col border border-border bg-surface px-[1.2rem] py-[0.9rem]"
        >
          <h2 className="caps-label mb-[0.5rem]">Next match</h2>
          {upNext === undefined ? (
            <p className="text-[1rem] text-text-muted">Schedule updating…</p>
          ) : (
            <div className="flex flex-1 flex-col justify-between">
              <div className="space-y-[0.5rem]">
                <p className="flex items-center gap-[0.6rem] text-[1.2rem] font-bold">
                  <TeamMark team={upNext.home} size="sm" />
                  {upNext.home.name}
                </p>
                <p className="flex items-center gap-[0.6rem] text-[1.2rem] font-bold">
                  <TeamMark team={upNext.away} size="sm" />
                  {upNext.away.name}
                </p>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-[0.9rem] text-text-muted">
                  {upNext.leagueCode} · {formatMatchday(upNext.matchday)}
                </span>
                <Countdown
                  to={upNext.kickoffAt}
                  className="font-display text-[2.2rem] font-black leading-none"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {live.data !== undefined && live.data.length > 0 && (
        <MatchStrip matches={live.data} currentId={match.id} autoFocusCurrent />
      )}
    </div>
  );
}
