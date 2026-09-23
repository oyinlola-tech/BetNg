import type { PresentationEvent } from "@betng/ui-core";
import { FootballIcon } from "../../icons/football";
import { cn } from "../../lib/cn";

/*
 * The moment an important event lands, over the pitch, for as long as the
 * animation queue keeps it on screen. It is a second telling of something the
 * timeline already holds, so losing it costs emphasis and never information.
 *
 * Weight follows severity: a goal takes the pitch, a card or a VAR check takes
 * a band, and ordinary play never appears here at all.
 */

const TONE: Readonly<Record<string, string>> = {
  major: "bg-text-primary text-background",
  medium: "bg-surface-elevated text-text-primary border border-border",
  minor: "bg-surface-elevated text-text-primary border border-border",
};

export interface EventOverlayProps {
  readonly event: PresentationEvent | undefined;
  readonly homeName: string;
  readonly awayName: string;
  readonly reducedMotion?: boolean;
  readonly className?: string | undefined;
}

export function EventOverlay({
  event,
  homeName,
  awayName,
  reducedMotion = false,
  className,
}: EventOverlayProps): React.JSX.Element | null {
  if (event === undefined || event.severity === "minor") return null;

  const major = event.severity === "major";
  const team =
    event.side === undefined
      ? undefined
      : event.side === "HOME"
        ? homeName
        : awayName;

  if (major) {
    return (
      <div
        key={event.id}
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-overlay px-6 text-center",
          !reducedMotion && "animate-fade-in",
          className,
        )}
      >
        <FootballIcon
          kind={event.kind}
          size={40}
          className="text-white"
        />
        <p className="type-h1 text-white md:text-5xl">{event.headline}</p>
        {team !== undefined && (
          <p className="type-h3 text-white/90">{team}</p>
        )}
        <p className="type-data text-white/80">
          {event.minute}&apos; · {event.score.home} – {event.score.away}
        </p>
      </div>
    );
  }

  return (
    <div
      key={event.id}
      className={cn(
        "absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 py-3",
        TONE[event.severity],
        !reducedMotion && "animate-slide-up",
        className,
      )}
    >
      <FootballIcon kind={event.kind} size={20} />
      <span className="type-h3 shrink-0">{event.headline}</span>
      <span className="type-small min-w-0 truncate font-medium">
        {event.description}
      </span>
      <span className="type-data ml-auto shrink-0 text-text-muted">
        {event.minute}&apos;
      </span>
    </div>
  );
}
