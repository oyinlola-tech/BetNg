import { useEffect, useRef, useState } from "react";
import {
  formatBroadcastClock,
  isInPlay,
  matchClock,
  type MatchEventView,
  type MatchView,
} from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";
import { TeamBadge } from "./TeamBadge";

export interface PitchViewProps {
  readonly match: MatchView;
  readonly lastEvent: MatchEventView | undefined;
  readonly connection: "CONNECTING" | "CONNECTED" | "RECONNECTING" | "OFFLINE";
  readonly className?: string;
}

interface Overlay {
  readonly key: string;
  readonly headline: string;
  readonly detail: string;
  readonly tone: "goal" | "card" | "neutral";
}

function overlayFor(
  event: MatchEventView,
  match: MatchView,
): Overlay | undefined {
  const team = event.side === "HOME" ? match.home : match.away;

  switch (event.kind) {
    case "GOAL":
      return {
        key: event.id,
        headline: "GOAL",
        detail: `${event.player ?? team.name} · ${String(event.minute)}'`,
        tone: "goal",
      };
    case "RED_CARD":
      return {
        key: event.id,
        headline: "RED CARD",
        detail: `${event.player ?? ""} · ${team.shortName}`,
        tone: "card",
      };
    case "KICK_OFF":
      return {
        key: event.id,
        headline: "KICK-OFF",
        detail: match.home.stadium,
        tone: "neutral",
      };
    case "HALF_TIME":
      return {
        key: event.id,
        headline: "HALF TIME",
        detail: `${match.home.shortName} ${String(event.score.home)} – ${String(event.score.away)} ${match.away.shortName}`,
        tone: "neutral",
      };
    case "FULL_TIME":
      return {
        key: event.id,
        headline: "FULL TIME",
        detail: `${match.home.shortName} ${String(event.score.home)} – ${String(event.score.away)} ${match.away.shortName}`,
        tone: "neutral",
      };
    default:
      return undefined;
  }
}

/* Ball drift toward the side with momentum: a presentational hint, never a result. */
function ballPosition(
  match: MatchView,
  second: number,
): { readonly x: number; readonly y: number } {
  const possession = match.stats?.home.possession ?? 50;
  const bias = (possession - 50) / 50;
  const t = second / 60;
  const x = 50 + bias * 22 + Math.sin(t * Math.PI * 2 * 0.9) * 22;
  const y = 50 + Math.cos(t * Math.PI * 2 * 0.6) * 26;

  return { x, y };
}

export function PitchView({
  match,
  lastEvent,
  connection,
  className,
}: PitchViewProps): React.JSX.Element {
  const now = useNow(250);
  const clock = matchClock(match.kickoffAt, now);
  const live = isInPlay(match.phase);
  const [overlay, setOverlay] = useState<Overlay | undefined>(undefined);
  const seen = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (lastEvent === undefined || seen.current === lastEvent.id) return;

    seen.current = lastEvent.id;

    const next = overlayFor(lastEvent, match);

    if (next === undefined) return;

    setOverlay(next);

    const timer = setTimeout(() => {
      setOverlay((current) =>
        current?.key === next.key ? undefined : current,
      );
    }, 3200);

    return () => {
      clearTimeout(timer);
    };
  }, [lastEvent, match]);

  const ball = ballPosition(match, clock.second + clock.minute * 60);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-md bg-[#0F2A1E] text-white",
        className,
      )}
    >
      <svg
        viewBox="0 0 160 90"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <pattern
            id="stripes"
            width="16"
            height="90"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="90" fill="rgba(255,255,255,0.025)" />
          </pattern>
        </defs>
        <rect width="160" height="90" fill="#123726" />
        <rect width="160" height="90" fill="url(#stripes)" />
        <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6">
          <rect x="8" y="6" width="144" height="78" />
          <line x1="80" y1="6" x2="80" y2="84" />
          <circle cx="80" cy="45" r="9" />
          <rect x="8" y="24" width="20" height="42" />
          <rect x="132" y="24" width="20" height="42" />
          <rect x="8" y="35" width="7" height="20" />
          <rect x="145" y="35" width="7" height="20" />
          <path d="M28 37 A9 9 0 0 1 28 53" />
          <path d="M132 37 A9 9 0 0 0 132 53" />
        </g>
        {live && (
          <circle
            cx={8 + (ball.x / 100) * 144}
            cy={6 + (ball.y / 100) * 78}
            r="1.6"
            fill="white"
            style={{
              transition: reduced ? "none" : "cx 250ms linear, cy 250ms linear",
            }}
          />
        )}
      </svg>

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-sm bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
        {live && (
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-live animate-pulse-live"
          />
        )}
        <span className="text-[10px] font-bold uppercase tracking-caps">
          {live
            ? "Live"
            : match.phase === "FINISHED" || match.phase === "SETTLED"
              ? "Full time"
              : "Preview"}
        </span>
        <span className="text-[10px] text-white/70">
          {match.leagueCode} · MD {String(match.matchday).padStart(2, "0")}
        </span>
      </div>

      <div className="absolute right-3 top-3 flex items-center overflow-hidden rounded-sm bg-black/55 text-sm font-bold tabular backdrop-blur-sm">
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <TeamBadge team={match.home} size="xs" />
          {match.home.code}
        </span>
        <span className="bg-white px-2 py-1.5 text-black">
          {match.score.home} – {match.score.away}
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          {match.away.code}
          <TeamBadge team={match.away} size="xs" />
        </span>
        <span
          className={cn(
            "px-2 py-1.5 tabular",
            live ? "text-live" : "text-white/70",
          )}
        >
          {match.phase === "HALFTIME"
            ? "HT"
            : formatBroadcastClock(clock.minute, clock.second)}
        </span>
      </div>

      {connection !== "CONNECTED" && (
        <div
          role="status"
          className="absolute bottom-3 left-3 rounded-sm bg-black/65 px-2.5 py-1.5 text-xs font-semibold backdrop-blur-sm"
        >
          {connection === "OFFLINE"
            ? "Offline · showing last known state"
            : connection === "CONNECTING"
              ? "Connecting…"
              : "Connection lost · reconnecting…"}
        </div>
      )}

      {overlay !== undefined && (
        <div
          key={overlay.key}
          role="status"
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center gap-4 px-5 py-4 animate-slide-up",
            overlay.tone === "goal" && "bg-white text-black",
            overlay.tone === "card" && "bg-danger text-white",
            overlay.tone === "neutral" &&
              "bg-black/75 text-white backdrop-blur-sm",
          )}
        >
          <span className="font-display text-2xl font-black tracking-tight md:text-3xl">
            {overlay.headline}
          </span>
          <span className="text-sm font-medium opacity-80 md:text-base">
            {overlay.detail}
          </span>
        </div>
      )}

      {!live && match.phase !== "FINISHED" && match.phase !== "SETTLED" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-sm bg-black/55 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            The match view opens at kick-off
          </p>
        </div>
      )}
    </div>
  );
}
