import { memo } from "react";
import { Link } from "react-router";
import { Radio } from "lucide-react";
import { displayClock, type MatchSummary } from "@betng/ui-core";
import { EmptyState, ErrorBoundary, ErrorState, FootballIcon, PageSkeleton, StaleBadge, StatusBadge, cn, emptyPresets, useNow } from "@betng/ui-web";
import { useFlashKey } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useLiveMatches } from "../hooks/queries";
import { useConnection } from "../hooks/useAdmin";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { formatCount, humanise } from "../lib/format";

/* The minute is the platform's report. A live match with no reported clock says LIVE and nothing more. */
function Clock({ match }: { readonly match: MatchSummary }): React.JSX.Element {
  const now = useNow(1000);

  return <>{displayClock(match.clock, now)?.label ?? "LIVE"}</>;
}

/** Each card owns its live subscription, so an event re-renders that card and nothing else. */
const LiveCard = memo(
  function LiveCard({ summary }: { readonly summary: MatchSummary }): React.JSX.Element {
    const live = useLiveMatch(summary.id);
    const match = live.match ?? summary;
    const events = (live.match?.events ?? []).filter((e) => e.kind !== "SHOT").slice(-3).reverse();
    const halftime = match.phase === "HALFTIME";
    const flash = useFlashKey(`${String(match.score.home)}-${String(match.score.away)}`);
    const disconnected = live.connection !== "CONNECTED";

    return (
      <li>
        <Link to={`/matches/${summary.id}`} className="block rounded-md border border-border bg-surface transition-colors hover:border-border-strong focus-ring">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
            <span className="truncate text-xs font-semibold uppercase tracking-caps text-text-muted">
              {match.leagueName} · MD {match.matchday}
            </span>
            <span className={cn("mono-id shrink-0 font-semibold", halftime ? "text-text-secondary" : "text-live")}>
              <Clock match={match} />
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
          <ul className="min-h-[62px] space-y-0.5 border-t border-border px-3 py-1.5 text-sm text-text-secondary">
            {events.length === 0 && <li className="text-text-muted">{live.match === undefined ? "Reading match" : "No events yet"}</li>}
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-2 truncate">
                <span className="w-7 shrink-0 tabular text-text-muted">{event.minute}'</span>
                <FootballIcon kind={event.kind} className="size-3.5 shrink-0" aria-hidden />
                <span className={cn("shrink-0 font-medium", event.kind === "GOAL" && "text-text-primary")}>{humanise(event.kind)}</span>
                <span className="truncate text-text-muted">{event.player ?? ""}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
            <StatusBadge status={halftime ? "HALFTIME" : "LIVE"} pulse={!halftime} className="text-xs">
              {halftime ? "Half-time" : "Live"}
            </StatusBadge>
            {disconnected ? <StaleBadge updatedAt={live.syncedAt} /> : <span className="text-xs text-text-muted">{live.resyncing ? "Resyncing" : "Up to date"}</span>}
          </div>
        </Link>
      </li>
    );
  },
  (previous, next) => previous.summary.id === next.summary.id,
);

export function LiveControlPage(): React.JSX.Element {
  const live = useLiveMatches();
  const connection = useConnection();
  const matches = live.data;

  return (
    <>
      <PageHeader
        title="Live control"
        description="Every match in play across the platform. Scores, clocks and events are the platform's; select a match to operate it."
        actions={
          <>
            <StatusBadge status="LIVE" pulse={matches !== undefined && matches.length > 0}>
              {matches === undefined ? "Reading" : `${formatCount(matches.length)} in play`}
            </StatusBadge>
            <StatusBadge status={connection === "CONNECTED" ? "ONLINE" : connection === "OFFLINE" || connection === "FAILED" ? "OFFLINE" : "PENDING"}>
              {connection === "CONNECTED" ? "Event stream connected" : connection === "OFFLINE" ? "Event stream offline" : connection === "FAILED" ? "Event stream unavailable" : "Event stream connecting"}
            </StatusBadge>
          </>
        }
      />
      {matches === undefined ? (
        live.error !== null ? (
          <ErrorState error={live.error} onRetry={() => void live.refetch()} />
        ) : (
          <PageSkeleton />
        )
      ) : matches.length === 0 ? (
        <EmptyState icon={<Radio className="size-5" />} title={emptyPresets.noLiveMatches.title} description={emptyPresets.noLiveMatches.description} />
      ) : (
        <ErrorBoundary scope="feature">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {matches.map((match) => (
              <LiveCard key={match.id} summary={match} />
            ))}
          </ul>
        </ErrorBoundary>
      )}
    </>
  );
}
