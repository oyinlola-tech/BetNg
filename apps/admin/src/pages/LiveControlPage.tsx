import { memo } from "react";
import { Link } from "react-router";
import { Radio } from "lucide-react";
import type { MatchSummary } from "@betng/ui-core";
import { EmptyState, ErrorState, SkeletonRows, StatusBadge, cn, useNow } from "@betng/ui-web";
import { useFlashKey } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useLiveMatches } from "../hooks/queries";
import { useConnection } from "../hooks/useAdmin";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { liveClock } from "../lib/format";

function Clock({ kickoffAt }: { readonly kickoffAt: string }): React.JSX.Element {
  const now = useNow(500);

  return <>{liveClock(kickoffAt, now)}</>;
}

const EVENT_LABEL: Readonly<Record<string, string>> = { GOAL: "Goal", YELLOW_CARD: "Yellow", RED_CARD: "Red card", SUBSTITUTION: "Sub", CORNER: "Corner", HALF_TIME: "Half-time", SECOND_HALF: "Second half", KICK_OFF: "Kick-off", FULL_TIME: "Full time", SHOT: "Shot" };

/** Each card owns its own live subscription, so an event re-renders that card and nothing else. */
const LiveCard = memo(function LiveCard({ summary }: { readonly summary: MatchSummary }): React.JSX.Element {
  const live = useLiveMatch(summary.id);
  const match = live.match ?? summary;
  const events = (live.match?.events ?? []).filter((e) => e.kind !== "SHOT").slice(-3).reverse();
  const halftime = match.phase === "HALFTIME";
  const feed = live.connection;
  const flash = useFlashKey(`${String(match.score.home)}-${String(match.score.away)}`);

  return (
    <li>
      <Link to={`/matches/${summary.id}`} className="block rounded-md border border-border bg-surface transition-colors hover:border-border-strong focus-ring">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <span className="truncate text-xs font-semibold uppercase tracking-caps text-text-muted">
            {match.leagueName} · MD {match.matchday}
          </span>
          <span className={cn("mono-id shrink-0 font-semibold tabular", halftime ? "text-warning" : "text-live")}>
            <Clock kickoffAt={match.kickoffAt} />
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
          <div className="min-w-0 space-y-0.5 text-base font-medium">
            <p className="truncate">{match.home.name}</p>
            <p className="truncate">{match.away.name}</p>
          </div>
          <div key={flash} className={cn("space-y-0.5 rounded-xs px-1 text-right font-display text-lg font-bold leading-[21px] tabular", flash > 0 && "flash-cell")}>
            <p>{match.score.home}</p>
            <p>{match.score.away}</p>
          </div>
        </div>
        <ul className="min-h-[58px] space-y-0.5 border-t border-border px-3 py-1.5 text-sm text-text-secondary">
          {events.length === 0 && <li className="text-text-muted">{live.match === undefined ? "Reading match…" : "No events yet"}</li>}
          {events.map((event) => (
            <li key={event.id} className="flex gap-2 truncate">
              <span className="w-7 shrink-0 tabular text-text-muted">{event.minute}'</span>
              <span className={cn("shrink-0 font-medium", event.kind === "GOAL" && "text-text-primary", event.kind === "RED_CARD" && "text-danger")}>{EVENT_LABEL[event.kind] ?? event.kind}</span>
              <span className="truncate text-text-muted">{event.player ?? ""}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <StatusBadge tone={halftime ? "warning" : "live"} pulse={!halftime} className="text-xs">
            {halftime ? "Half-time" : "Live"}
          </StatusBadge>
          <StatusBadge tone={feed === "CONNECTED" ? "success" : feed === "OFFLINE" ? "danger" : "warning"} className="text-xs text-text-secondary">
            {feed === "CONNECTED" ? (live.resyncing ? "Resyncing" : "Feed ok") : feed === "OFFLINE" ? "Feed offline" : "Reconnecting"}
          </StatusBadge>
        </div>
      </Link>
    </li>
  );
}, (previous, next) => previous.summary.id === next.summary.id);

export function LiveControlPage(): React.JSX.Element {
  const live = useLiveMatches();
  const connection = useConnection();
  const matches = live.data;

  return (
    <>
      <PageHeader
        title="Live control"
        description="Every match in play across the platform. Scores, clocks and events stream in; select a match to operate it."
        actions={
          <>
            <StatusBadge tone="live" pulse={matches !== undefined && matches.length > 0}>
              {matches === undefined ? "…" : `${String(matches.length)} in play`}
            </StatusBadge>
            <StatusBadge tone={connection === "CONNECTED" ? "success" : connection === "OFFLINE" ? "danger" : "warning"}>{connection === "CONNECTED" ? "Event stream connected" : connection === "OFFLINE" ? "Event stream offline" : "Event stream reconnecting"}</StatusBadge>
          </>
        }
      />
      {matches === undefined ? (
        live.error !== null ? (
          <ErrorState error={live.error} onRetry={() => void live.refetch()} />
        ) : (
          <SkeletonRows rows={6} />
        )
      ) : matches.length === 0 ? (
        <EmptyState icon={<Radio className="size-5" />} title="No match in play" description="Matchdays kick off every few minutes. This wall fills on its own when the next one starts." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {matches.map((match) => (
            <LiveCard key={match.id} summary={match} />
          ))}
        </ul>
      )}
    </>
  );
}
