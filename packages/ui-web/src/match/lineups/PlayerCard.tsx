import type { LineupPlayer, TeamView } from "@betng/ui-core";
import { cn } from "../../lib/cn";

export interface PlayerCardProps {
  readonly player: LineupPlayer;
  readonly team?: Pick<TeamView, "colors"> | undefined;
  readonly className?: string | undefined;
}

export function PlayerCard({
  player,
  team,
  className,
}: PlayerCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex w-16 min-w-0 flex-col items-center gap-1 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "type-data flex size-8 items-center justify-center rounded-full border border-border-strong font-bold",
          team === undefined && "bg-surface text-text-primary",
        )}
        style={
          team === undefined
            ? undefined
            : {
                background: team.colors.primary,
                color: team.colors.onPrimary,
              }
        }
      >
        {player.shirt ?? <span aria-hidden>·</span>}
      </span>
      <span className="type-small w-full truncate font-medium text-text-primary">
        {player.name}
        {player.captain === true && (
          <abbr title="Captain" className="ml-0.5 text-text-muted no-underline">
            (C)
          </abbr>
        )}
      </span>
    </div>
  );
}
