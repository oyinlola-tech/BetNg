import { useState } from "react";
import type {
  MatchEventKind,
  MatchEventView,
  MatchSummary,
} from "@betng/ui-core";
import { FootballIcon, Whistle, eventTone } from "../icons";
import { cn } from "../lib/cn";
import { EmptyState } from "../ui";

const PERIOD_LABEL: Readonly<Partial<Record<MatchEventKind, string>>> = {
  KICK_OFF: "Kick-off",
  HALF_TIME: "Half time",
  SECOND_HALF: "Second half",
  FULL_TIME: "Full time",
};

const GOAL_KINDS: ReadonlySet<MatchEventKind> = new Set([
  "GOAL",
  "OWN_GOAL",
  "PENALTY_GOAL",
]);

const KEY_KINDS: ReadonlySet<MatchEventKind> = new Set([
  "GOAL",
  "OWN_GOAL",
  "PENALTY_GOAL",
  "PENALTY_MISSED",
  "RED_CARD",
  "YELLOW_CARD",
  "SUBSTITUTION",
  "VAR",
  "KICK_OFF",
  "HALF_TIME",
  "SECOND_HALF",
  "FULL_TIME",
]);

const KIND_WORD: Readonly<Partial<Record<MatchEventKind, string>>> = {
  OWN_GOAL: "Own goal",
  PENALTY_GOAL: "Penalty",
  PENALTY_MISSED: "Penalty missed",
  YELLOW_CARD: "Yellow card",
  RED_CARD: "Red card",
  VAR: "VAR review",
};

export interface MatchTimelineProps {
  readonly match: Pick<MatchSummary, "home" | "away">;
  readonly events: readonly MatchEventView[];
  readonly keyEventsOnly?: boolean;
  /** Keeps the most recent `limit` events. */
  readonly limit?: number | undefined;
  readonly newestFirst?: boolean;
  readonly label?: string;
  readonly className?: string | undefined;
}

export function MatchTimeline({
  match,
  events,
  keyEventsOnly = false,
  limit,
  newestFirst = true,
  label = "Match timeline",
  className,
}: MatchTimelineProps): React.JSX.Element {
  const [initialIds] = useState(() => new Set(events.map((e) => e.id)));

  let list = [...events].sort((a, b) => a.sequence - b.sequence);

  if (keyEventsOnly) list = list.filter((e) => KEY_KINDS.has(e.kind));
  if (limit !== undefined) list = list.slice(Math.max(0, list.length - limit));
  if (newestFirst) list.reverse();

  if (list.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Whistle size={20} />}
        title="No events yet"
        description="Events appear here as the platform reports them."
        className={className}
      />
    );
  }

  return (
    <ol
      aria-label={label}
      reversed={newestFirst}
      className={cn("flex flex-col", className)}
    >
      {list.map((event) =>
        PERIOD_LABEL[event.kind] === undefined ? (
          <EventRow
            key={event.id}
            event={event}
            match={match}
            fresh={!initialIds.has(event.id)}
          />
        ) : (
          <PeriodDivider
            key={event.id}
            event={event}
            fresh={!initialIds.has(event.id)}
          />
        ),
      )}
    </ol>
  );
}

function PeriodDivider({
  event,
  fresh,
}: {
  readonly event: MatchEventView;
  readonly fresh: boolean;
}): React.JSX.Element {
  const withScore = event.kind === "HALF_TIME" || event.kind === "FULL_TIME";

  return (
    <li
      data-kind={event.kind}
      className={cn(
        "flex items-center gap-3 py-2",
        fresh && "animate-event-in",
      )}
    >
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span className="type-caption inline-flex items-center gap-1.5">
        <FootballIcon kind={event.kind} size={14} />
        {PERIOD_LABEL[event.kind]}
        {withScore && (
          <span className="tabular text-text-secondary">
            {event.score.home}–{event.score.away}
          </span>
        )}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </li>
  );
}

function detailChips(
  detail: MatchEventView["detail"],
): readonly { readonly key: string; readonly text: string }[] {
  if (detail === undefined) return [];

  return Object.entries(detail).flatMap(([key, value]) => {
    if (value === false || value === "") return [];

    const words = key
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase();

    return [{ key, text: value === true ? words : `${words}: ${String(value)}` }];
  });
}

function EventRow({
  event,
  match,
  fresh,
}: {
  readonly event: MatchEventView;
  readonly match: Pick<MatchSummary, "home" | "away">;
  readonly fresh: boolean;
}): React.JSX.Element {
  const goal = GOAL_KINDS.has(event.kind);
  const away = event.side === "AWAY";
  const team =
    event.side === undefined ? undefined : away ? match.away : match.home;
  const substitution = event.kind === "SUBSTITUTION";
  const chips = detailChips(event.detail);
  const kindWord = KIND_WORD[event.kind];

  return (
    <li
      data-kind={event.kind}
      data-side={event.side}
      className={cn(
        "grid grid-cols-[2.5rem_1.5rem_minmax(0,1fr)] items-start gap-x-2 border-b border-border py-2.5 last:border-0",
        "md:grid-cols-[minmax(0,1fr)_2.5rem_1.5rem_minmax(0,1fr)]",
        fresh && "animate-event-in",
      )}
    >
      <span className="type-data text-text-muted md:col-start-2 md:row-start-1 md:text-right">
        {event.minute}&apos;
      </span>
      <span className="flex h-5 items-center justify-center md:col-start-3 md:row-start-1">
        <FootballIcon
          kind={event.kind}
          size={16}
          className={eventTone(event.kind)}
        />
      </span>
      <div
        className={cn(
          "min-w-0 md:row-start-1",
          away ? "md:col-start-4" : "md:col-start-1 md:text-right",
        )}
      >
        <p
          className={cn(
            "type-body",
            goal ? "font-semibold text-text-primary" : "text-text-secondary",
          )}
        >
          {team !== undefined && (
            <span className="type-caption mr-1.5 rounded-xs bg-surface-sunken px-1 py-0.5 md:hidden">
              <span aria-hidden>{team.code}</span>
              <span className="sr-only">{team.name}</span>
            </span>
          )}
          {team !== undefined && (
            <span className="sr-only max-md:hidden">{team.name}: </span>
          )}
          {substitution && event.player !== undefined
            ? `In: ${event.player}`
            : (event.player ?? event.description)}
          {goal && (
            <span className="type-data ml-2 font-bold text-text-primary">
              {event.score.home}–{event.score.away}
            </span>
          )}
        </p>
        {substitution && event.secondaryPlayer !== undefined && (
          <p className="type-small text-text-muted">
            Out: {event.secondaryPlayer}
          </p>
        )}
        {!substitution && event.player !== undefined && (
          <p className="type-small text-text-muted">
            {[
              kindWord,
              goal && event.secondaryPlayer !== undefined
                ? `Assist: ${event.secondaryPlayer}`
                : undefined,
              kindWord === undefined && !goal ? event.description : undefined,
            ]
              .filter((part) => part !== undefined)
              .join(" · ")}
          </p>
        )}
        {chips.length > 0 && (
          <ul
            className={cn(
              "mt-1 flex flex-wrap gap-1",
              !away && "md:justify-end",
            )}
          >
            {chips.map((chip) => (
              <li
                key={chip.key}
                className="type-small rounded-xs bg-surface-sunken px-1.5 py-0.5 text-text-muted"
              >
                {chip.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
