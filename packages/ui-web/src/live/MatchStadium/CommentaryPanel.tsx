import { useMemo } from "react";
import type { PresentationEvent } from "@betng/ui-core";
import { FootballIcon, eventTone } from "../../icons/football";
import { cn } from "../../lib/cn";

/*
 * The match as sentences, newest first. It renders the same event stream the
 * timeline and the pitch render — there is no second list of commentary
 * events to fall out of step with the first.
 *
 * Only decisive events are announced to assistive technology. A live region
 * that spoke every corner would make the page unusable with a screen reader,
 * so ordinary play is present, readable and silent.
 */

export interface CommentaryItemProps {
  readonly event: PresentationEvent;
  readonly animate?: boolean;
  readonly compact?: boolean;
}

export function CommentaryItem({
  event,
  animate = true,
  compact = false,
}: CommentaryItemProps): React.JSX.Element {
  const major = event.severity === "major";

  return (
    <li
      className={cn(
        "flex gap-3 border-b border-border py-2.5 last:border-b-0",
        compact ? "px-3" : "px-4",
        animate && "animate-event-in",
        major && "bg-surface-sunken",
      )}
    >
      <span className="type-data w-8 shrink-0 pt-0.5 text-right text-sm text-text-muted">
        {event.minute}&apos;
      </span>
      <FootballIcon
        kind={event.kind}
        size={18}
        className={cn("mt-0.5 shrink-0", eventTone(event.kind))}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block",
            major ? "type-h3 text-base" : "text-base font-semibold",
          )}
        >
          {event.headline}
        </span>
        {event.description !== "" && (
          <span className="type-small block text-text-secondary">
            {event.description}
          </span>
        )}
      </span>
      {major && (
        <span className="type-data shrink-0 self-start pt-0.5 font-bold tabular">
          {event.score.home}–{event.score.away}
        </span>
      )}
    </li>
  );
}

export interface CommentaryPanelProps {
  readonly events: readonly PresentationEvent[];
  /** The id of the newest event, which is the only one that animates in. */
  readonly latestId?: string | undefined;
  readonly limit?: number | undefined;
  readonly compact?: boolean;
  readonly emptyMessage?: string;
  readonly className?: string | undefined;
}

export function CommentaryPanel({
  events,
  latestId,
  limit,
  compact = false,
  emptyMessage = "Commentary begins at kick-off.",
  className,
}: CommentaryPanelProps): React.JSX.Element {
  const ordered = useMemo(() => {
    const newestFirst = [...events].reverse();

    return limit === undefined ? newestFirst : newestFirst.slice(0, limit);
  }, [events, limit]);

  const announced = useMemo(
    () => [...events].reverse().find((event) => event.announce),
    [events],
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Decisive events only, so a screen reader is not read every pass. */}
      <p aria-live="polite" aria-atomic className="sr-only">
        {announced === undefined
          ? ""
          : `${String(announced.minute)} minutes. ${announced.headline}. ${announced.description}`}
      </p>

      {ordered.length === 0 ? (
        <p
          className={cn(
            "type-small text-text-muted",
            compact ? "px-3 py-4" : "px-4 py-6",
          )}
        >
          {emptyMessage}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {ordered.map((event) => (
            <CommentaryItem
              key={event.id}
              event={event}
              animate={event.id === latestId}
              compact={compact}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
