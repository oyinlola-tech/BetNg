import {
  ArrowLeftRight,
  CornerDownRight,
  Flag,
  Goal,
  Square,
  Whistle,
} from "lucide-react";
import type {
  MatchEventKind,
  MatchEventView,
  MatchSummary,
} from "@betng/ui-core";
import { cn } from "../lib/cn";
import { EmptyState } from "../ui/States";

export interface MatchTimelineProps {
  readonly match: MatchSummary;
  readonly events: readonly MatchEventView[];
  readonly keyEventsOnly?: boolean;
  readonly limit?: number;
  readonly className?: string;
}

const KEY_KINDS: ReadonlySet<MatchEventKind> = new Set([
  "GOAL",
  "RED_CARD",
  "YELLOW_CARD",
  "SUBSTITUTION",
  "HALF_TIME",
  "FULL_TIME",
  "KICK_OFF",
]);

function EventIcon({
  kind,
}: {
  readonly kind: MatchEventKind;
}): React.JSX.Element {
  switch (kind) {
    case "GOAL":
      return <Goal className="size-4 text-text-primary" />;
    case "YELLOW_CARD":
      return <Square className="size-3.5 fill-warning text-warning" />;
    case "RED_CARD":
      return <Square className="size-3.5 fill-danger text-danger" />;
    case "SUBSTITUTION":
      return <ArrowLeftRight className="size-4 text-text-muted" />;
    case "CORNER":
      return <Flag className="size-3.5 text-text-muted" />;
    case "SHOT":
      return <CornerDownRight className="size-3.5 text-text-muted" />;
    default:
      return <Whistle className="size-4 text-text-muted" />;
  }
}

export function MatchTimeline({
  match,
  events,
  keyEventsOnly = false,
  limit,
  className,
}: MatchTimelineProps): React.JSX.Element {
  let list = keyEventsOnly
    ? events.filter((e) => KEY_KINDS.has(e.kind))
    : events;

  list = [...list].reverse();
  if (limit !== undefined) list = list.slice(0, limit);

  if (list.length === 0) {
    return (
      <EmptyState
        compact
        title="No events yet"
        description="Events appear here as the match unfolds."
        className={className}
      />
    );
  }

  return (
    <ol className={cn("divide-y divide-border", className)}>
      {list.map((event) => {
        const structural = event.side === undefined;
        const goal = event.kind === "GOAL";

        return (
          <li
            key={event.id}
            className={cn(
              "grid grid-cols-[2.5rem_1.5rem_1fr_auto] items-center gap-2 py-2.5",
              goal && "bg-surface-sunken/60 -mx-3 px-3 rounded-sm",
            )}
          >
            <span className="text-sm font-semibold tabular text-text-muted">
              {structural ? "" : `${String(event.minute)}'`}
            </span>
            <span className="flex justify-center">
              <EventIcon kind={event.kind} />
            </span>
            <div className="min-w-0">
              {structural ? (
                <p className="caps-label">{event.description}</p>
              ) : (
                <>
                  <p
                    className={cn(
                      "truncate text-base",
                      goal
                        ? "font-semibold text-text-primary"
                        : "text-text-secondary",
                    )}
                  >
                    {event.player ?? event.description}
                  </p>
                  {event.player !== undefined && (
                    <p className="truncate text-xs text-text-muted">
                      {event.kind === "GOAL" &&
                      event.secondaryPlayer !== undefined
                        ? `Assist · ${event.secondaryPlayer}`
                        : null}
                      {event.kind === "SUBSTITUTION" &&
                      event.secondaryPlayer !== undefined
                        ? `Off · ${event.secondaryPlayer}`
                        : null}
                      {event.kind === "YELLOW_CARD"
                        ? "Yellow card"
                        : event.kind === "RED_CARD"
                          ? "Red card"
                          : null}
                    </p>
                  )}
                </>
              )}
            </div>
            <span className="text-sm font-medium text-text-muted">
              {structural ? (
                <span className="tabular">
                  {event.score.home}–{event.score.away}
                </span>
              ) : (
                <span
                  className={cn(
                    "rounded-xs px-1.5 py-0.5 text-xs font-semibold",
                    event.side === "HOME"
                      ? "bg-surface-sunken"
                      : "bg-surface-sunken",
                  )}
                >
                  {event.side === "HOME" ? match.home.code : match.away.code}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
