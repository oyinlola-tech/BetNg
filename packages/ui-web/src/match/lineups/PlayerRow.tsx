import type { LineupPlayer } from "@betng/ui-core";
import { Substitution } from "../../icons";
import { cn } from "../../lib/cn";

export interface PlayerRowProps {
  readonly player: LineupPlayer;
  readonly className?: string | undefined;
}

export function PlayerRow({
  player,
  className,
}: PlayerRowProps): React.JSX.Element {
  return (
    <li className={cn("flex items-center gap-2 py-1.5", className)}>
      <span className="type-data w-6 shrink-0 text-right text-text-muted">
        {player.shirt ?? <span className="sr-only">No shirt number</span>}
      </span>
      <span className="type-body min-w-0 flex-1 truncate text-text-primary">
        {player.name}
        {player.captain === true && (
          <abbr
            title="Captain"
            className="type-caption ml-1.5 rounded-xs bg-surface-sunken px-1 py-0.5 no-underline"
          >
            C
          </abbr>
        )}
      </span>
      {player.substitutedMinute !== undefined && (
        <span className="type-small inline-flex shrink-0 items-center gap-1 tabular text-text-muted">
          <Substitution size={14} title="Substituted" />
          {player.substitutedMinute}&apos;
        </span>
      )}
      {player.position !== undefined && (
        <span className="type-caption w-6 shrink-0 text-right">
          {player.position}
        </span>
      )}
    </li>
  );
}
