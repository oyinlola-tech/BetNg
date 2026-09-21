import { useEffect, useRef, useState } from "react";
import {
  displayClock,
  formatBroadcastClock,
  formatMatchday,
  isFinished,
  isInPlay,
  type MatchEventKind,
  type MatchEventView,
  type MatchView,
} from "@betng/ui-core";
import { cn } from "../lib/cn";
import { STATE_WORD } from "../match/matchState";
import { useMatchNow } from "../match/useMatchNow";
import { TeamCrest } from "../teams";
import { LiveDot } from "./LiveDot";

const OVERLAY_MS = 3200;

export interface PitchViewProps {
  readonly match: MatchView;
  readonly lastEvent: MatchEventView | undefined;
  readonly connection: "CONNECTING" | "CONNECTED" | "RECONNECTING" | "OFFLINE";
  readonly now?: number | undefined;
  readonly className?: string | undefined;
}

interface Overlay {
  readonly key: string;
  readonly headline: string;
  readonly detail: string;
  readonly tone: "goal" | "card" | "neutral";
}

const OVERLAY_TONE: Readonly<Record<Overlay["tone"], string>> = {
  goal: "bg-text-primary text-background",
  card: "bg-danger text-text-on-status",
  neutral: "border-t border-border bg-surface-elevated text-text-primary",
};

const HEADLINES: Readonly<
  Partial<
    Record<
      MatchEventKind,
      { readonly headline: string; readonly tone: Overlay["tone"] }
    >
  >
> = {
  GOAL: { headline: "GOAL", tone: "goal" },
  PENALTY_GOAL: { headline: "GOAL · PENALTY", tone: "goal" },
  OWN_GOAL: { headline: "OWN GOAL", tone: "goal" },
  PENALTY_MISSED: { headline: "PENALTY MISSED", tone: "neutral" },
  RED_CARD: { headline: "RED CARD", tone: "card" },
  VAR: { headline: "VAR REVIEW", tone: "neutral" },
  KICK_OFF: { headline: "KICK-OFF", tone: "neutral" },
  HALF_TIME: { headline: "HALF TIME", tone: "neutral" },
  SECOND_HALF: { headline: "SECOND HALF", tone: "neutral" },
  FULL_TIME: { headline: "FULL TIME", tone: "neutral" },
};

function overlayFor(
  event: MatchEventView,
  match: MatchView,
): Overlay | undefined {
  const spec = HEADLINES[event.kind];

  if (spec === undefined) return undefined;

  const scoreline = `${match.home.shortName} ${String(event.score.home)} – ${String(event.score.away)} ${match.away.shortName}`;
  const team =
    event.side === undefined
      ? undefined
      : event.side === "HOME"
        ? match.home
        : match.away;
  const detail =
    event.side === undefined
      ? event.kind === "KICK_OFF"
        ? match.home.stadium
        : scoreline
      : [event.player ?? team?.name, `${String(event.minute)}'`, team?.shortName]
          .filter((part) => part !== undefined)
          .join(" · ");

  return { key: event.id, headline: spec.headline, detail, tone: spec.tone };
}

/*
 * The ball only ever sits where the laws of the game put it after a reported
 * event: the centre spot, a goal mouth, a corner arc, a penalty spot. Home
 * attacks right. Events without an inherent location leave it where it was.
 */
function ballSpot(
  event: MatchEventView,
): { readonly x: number; readonly y: number } | undefined {
  const right = event.side === "HOME";

  switch (event.kind) {
    case "KICK_OFF":
    case "SECOND_HALF":
    case "OWN_GOAL":
      return { x: 80, y: 45 };
    case "GOAL":
      return event.side === undefined ? undefined : { x: right ? 150 : 10, y: 45 };
    case "PENALTY_GOAL":
    case "PENALTY_MISSED":
      return event.side === undefined ? undefined : { x: right ? 138 : 22, y: 45 };
    case "CORNER":
      return event.side === undefined ? undefined : { x: right ? 151 : 9, y: 7 };
    default:
      return undefined;
  }
}

export function PitchView({
  match,
  lastEvent,
  connection,
  now,
  className,
}: PitchViewProps): React.JSX.Element {
  const live = isInPlay(match.phase);
  const finished = isFinished(match.phase);
  const current = useMatchNow(match.phase === "LIVE", now, 500);
  const clock = displayClock(match.clock, current);
  const [overlay, setOverlay] = useState<Overlay | undefined>(undefined);
  const seen = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (lastEvent === undefined || seen.current === lastEvent.id) return;

    seen.current = lastEvent.id;

    const next = overlayFor(lastEvent, match);

    if (next === undefined) return;

    setOverlay(next);

    const timer = setTimeout(() => {
      setOverlay((shown) => (shown?.key === next.key ? undefined : shown));
    }, OVERLAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [lastEvent, match]);

  const ball = [...match.events]
    .sort((a, b) => b.sequence - a.sequence)
    .map(ballSpot)
    .find((spot) => spot !== undefined);

  const clockText =
    match.phase === "HALFTIME"
      ? "HT"
      : finished
        ? "FT"
        : match.phase !== "LIVE"
          ? ""
          : clock === undefined
            ? "LIVE"
            : match.clock?.minuteLengthMs === undefined
              ? clock.label
              : formatBroadcastClock(clock.minute, clock.second);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-md border border-border bg-surface-sunken",
        className,
      )}
    >
      <svg
        viewBox="0 0 160 90"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <g className="fill-none stroke-border-strong" strokeWidth="0.6">
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
        {live && ball !== undefined && (
          <circle
            r="1.8"
            className="fill-text-primary transition-transform duration-[var(--bn-duration-slow)]"
            style={{
              transform: `translate(${String(ball.x)}px, ${String(ball.y)}px)`,
            }}
          />
        )}
      </svg>

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-sm border border-border bg-surface-elevated px-2.5 py-1.5">
        {match.phase === "LIVE" && <LiveDot />}
        <span className="type-caption text-text-primary">
          {STATE_WORD[match.phase]}
        </span>
        <span className="type-small text-text-muted">
          {match.leagueCode} · {formatMatchday(match.matchday)}
        </span>
      </div>

      <div className="type-data absolute right-3 top-3 flex items-center overflow-hidden rounded-sm border border-border bg-surface-elevated font-bold">
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <TeamCrest team={match.home} size={20} decorative />
          {match.home.code}
        </span>
        <span className="bg-text-primary px-2 py-1.5 text-background">
          {match.score.home} – {match.score.away}
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          {match.away.code}
          <TeamCrest team={match.away} size={20} decorative />
        </span>
        {clockText !== "" && (
          <span
            className={cn(
              "px-2 py-1.5",
              live ? "text-live" : "text-text-muted",
            )}
          >
            {clockText}
          </span>
        )}
      </div>

      {connection !== "CONNECTED" && (
        <div
          role="status"
          className="type-small absolute bottom-3 left-3 rounded-sm border border-border bg-surface-elevated px-2.5 py-1.5 font-semibold text-text-primary"
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
            OVERLAY_TONE[overlay.tone],
          )}
        >
          <span className="type-h2 md:type-h1">{overlay.headline}</span>
          <span className="type-body font-medium">{overlay.detail}</span>
        </div>
      )}

      {!live && !finished && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <p className="type-body rounded-sm border border-border bg-surface-elevated px-4 py-2 text-center font-medium text-text-primary">
            {match.phase === "POSTPONED" ||
            match.phase === "CANCELLED" ||
            match.phase === "SUSPENDED"
              ? (match.statusReason ?? STATE_WORD[match.phase])
              : "The match view opens at kick-off"}
          </p>
        </div>
      )}
    </div>
  );
}
