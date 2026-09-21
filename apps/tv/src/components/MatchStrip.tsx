import type { MatchSummary } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { Focusable } from "./Focusable";
import { LiveTag } from "./LiveTag";

export function MatchStrip({
  matches,
  currentId,
  className,
  autoFocusCurrent = false,
}: {
  readonly matches: readonly MatchSummary[];
  readonly currentId?: string;
  readonly className?: string;
  readonly autoFocusCurrent?: boolean;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Live matches"
      className={cn("-mx-[0.7rem] flex gap-[0.6rem] overflow-x-auto px-[0.7rem] py-[0.7rem]", className)}
    >
      {matches.map((m, i) => {
        const current = m.id === currentId;

        return (
          <Focusable
            key={m.id}
            to={`/live/${m.id}`}
            aria-current={current ? "page" : undefined}
            autoFocusOnMount={autoFocusCurrent && current}
            className={cn(
              "flex shrink-0 items-center gap-[0.8rem] border px-[1rem] py-[0.6rem] text-[1rem] font-semibold",
              current
                ? "border-brand bg-brand-subtle text-text-primary"
                : "border-border bg-surface text-text-secondary",
            )}
          >
            <span className="caps-label tabular">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={cn(current ? "text-text-primary" : "")}>
              {m.home.code}
            </span>
            <span className="font-display text-[1.2rem] font-black tabular text-text-primary">
              {m.score.home}–{m.score.away}
            </span>
            <span>{m.away.code}</span>
            <LiveTag phase={m.phase} />
          </Focusable>
        );
      })}
    </nav>
  );
}
