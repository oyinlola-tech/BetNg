import { useEffect, useRef, useState } from "react";
import type { MatchEventView, MatchView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { isQuietWorthy } from "../lib/commentary";
import { TeamMark } from "./TeamMark";

interface Card {
  readonly key: string;
  readonly kicker: string;
  readonly headline: string;
  readonly detail: string;
  readonly tone: "goal" | "red" | "neutral";
  readonly team?: MatchView["home"];
}

function cardFor(event: MatchEventView, match: MatchView): Card | undefined {
  const team = event.side === "HOME" ? match.home : match.away;
  const score = `${match.home.code} ${String(event.score.home)} – ${String(event.score.away)} ${match.away.code}`;

  switch (event.kind) {
    case "GOAL":
      return {
        key: event.id,
        kicker: `${String(event.minute)}' · ${team.name}`,
        headline: "GOAL",
        detail: `${event.player ?? ""}${event.secondaryPlayer === undefined ? "" : ` · assist ${event.secondaryPlayer}`}`,
        tone: "goal",
        team,
      };
    case "RED_CARD":
      return {
        key: event.id,
        kicker: `${String(event.minute)}' · ${team.name}`,
        headline: "RED CARD",
        detail: event.player ?? "",
        tone: "red",
        team,
      };
    case "KICK_OFF":
      return {
        key: event.id,
        kicker: match.home.stadium,
        headline: "KICK-OFF",
        detail: `${match.home.name} v ${match.away.name}`,
        tone: "neutral",
      };
    case "HALF_TIME":
      return {
        key: event.id,
        kicker: "Half time",
        headline: score,
        detail: "",
        tone: "neutral",
      };
    case "FULL_TIME":
      return {
        key: event.id,
        kicker: "Full time",
        headline: score,
        detail: "",
        tone: "neutral",
      };
    default:
      return undefined;
  }
}

export function BroadcastOverlay({
  match,
  lastEvent,
  quiet = false,
}: {
  readonly match: MatchView;
  readonly lastEvent: MatchEventView | undefined;
  readonly quiet?: boolean;
}): React.JSX.Element | null {
  const [card, setCard] = useState<Card | undefined>(undefined);
  const seen = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (lastEvent === undefined || seen.current === lastEvent.id) return;

    seen.current = lastEvent.id;

    if (quiet && !isQuietWorthy(lastEvent.kind)) return;

    const next = cardFor(lastEvent, match);

    if (next === undefined) return;

    setCard(next);

    const timer = setTimeout(() => {
      setCard((c) => (c?.key === next.key ? undefined : c));
    }, 3600);

    return () => {
      clearTimeout(timer);
    };
  }, [lastEvent, match, quiet]);

  if (card === undefined) return null;

  return (
    <div
      key={card.key}
      role="status"
      aria-live="assertive"
      className={cn(
        "pointer-events-none absolute bottom-[2rem] left-[2rem] flex items-center gap-[1.2rem] overflow-hidden rounded-md pl-[1.4rem] pr-[2rem] py-[1rem] shadow-lg animate-lower-third",
        card.tone === "goal" && "bg-white text-black",
        card.tone === "red" && "bg-danger text-text-on-status",
        card.tone === "neutral" && "bg-black/80 text-white",
      )}
    >
      {card.team !== undefined && <TeamMark team={card.team} size="lg" />}
      <div>
        <p className="text-[0.85rem] font-semibold uppercase tracking-caps opacity-70">
          {card.kicker}
        </p>
        <p className="font-display text-[2.6rem] font-black leading-none tracking-tight">
          {card.headline}
        </p>
        {card.detail !== "" && (
          <p className="mt-[0.2rem] text-[1.1rem] font-medium opacity-85">
            {card.detail}
          </p>
        )}
      </div>
    </div>
  );
}
